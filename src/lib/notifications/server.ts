import { addDays, format, startOfDay, subDays } from "date-fns";

import { generateNotifications } from "@/lib/notifications/generate";
import { createClient } from "@/lib/supabase/server";
import type { Tables, TablesInsert } from "@/lib/supabase/types";

export type SidebarNotification = Pick<
  Tables<"notifications">,
  | "id"
  | "type"
  | "severity"
  | "title"
  | "body"
  | "action_label"
  | "action_href"
  | "read_at"
  | "created_at"
>;

export type SidebarNotificationsState = {
  notifications: SidebarNotification[];
  unreadCount: number;
};

export async function syncOrganizationNotifications(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  const organizationId = profile?.organization_id;
  if (!organizationId) return;

  const today = startOfDay(new Date());
  const todayIso = format(today, "yyyy-MM-dd");
  const dueEndIso = format(addDays(today, 7), "yyyy-MM-dd");
  const projectionStartIso = format(subDays(today, 120), "yyyy-MM-dd");
  const projectionEndIso = format(addDays(today, 90), "yyyy-MM-dd");
  const monthKey = format(today, "yyyy-MM");
  const year = Number(monthKey.slice(0, 4));

  const [
    { data: invoices },
    { data: dueTransactions },
    { data: imports },
    { data: accounts },
    { data: projectionTransactions },
    { data: budgetAccounts },
    { data: budgetTransactions },
    { data: budgetVersion },
  ] = await Promise.all([
    supabase
      .from("credit_card_invoices")
      .select("id,organization_id,due_date,status,total_amount,accounts(name)")
      .eq("organization_id", organizationId)
      .gte("due_date", todayIso)
      .lte("due_date", dueEndIso)
      .in("status", ["open", "closed", "partially_paid"]),
    supabase
      .from("transactions")
      .select("id,organization_id,cash_date,status,type,amount,description")
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .gte("cash_date", todayIso)
      .lte("cash_date", dueEndIso),
    supabase
      .from("imports")
      .select("id,organization_id,filename,status,error_message")
      .eq("organization_id", organizationId)
      .in("status", ["reviewing", "failed"])
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("accounts")
      .select("id,type,opening_balance,is_active")
      .eq("organization_id", organizationId),
    supabase
      .from("transactions")
      .select(
        "id,account_id,category_id,amount,cash_date,description,status,transfer_direction,type",
      )
      .eq("organization_id", organizationId)
      .gte("cash_date", projectionStartIso)
      .lte("cash_date", projectionEndIso),
    supabase
      .from("chart_of_accounts")
      .select("id,parent_id,code,name,nature,display_order,is_active")
      .eq("organization_id", organizationId)
      .order("display_order", { ascending: true }),
    supabase
      .from("transactions")
      .select("category_id,amount,cash_date,status,type")
      .eq("organization_id", organizationId)
      .gte("cash_date", `${monthKey}-01`)
      .lte("cash_date", `${monthKey}-31`),
    supabase
      .from("budget_versions")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("year", year)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  const { data: budgetValues } = budgetVersion?.id
    ? await supabase
        .from("budget_values")
        .select("chart_account_id,month,amount")
        .eq("organization_id", organizationId)
        .eq("budget_version_id", budgetVersion.id)
    : { data: [] };

  const generated = generateNotifications({
    organizationId,
    today,
    invoices: (invoices ?? []).map((invoice) => ({
      ...invoice,
      accounts: Array.isArray(invoice.accounts) ? (invoice.accounts[0] ?? null) : invoice.accounts,
    })),
    transactions: dueTransactions ?? [],
    imports: imports ?? [],
    budget:
      budgetAccounts && budgetValues
        ? {
            monthKey,
            accounts: budgetAccounts,
            budgetValues,
            transactions: budgetTransactions ?? [],
          }
        : undefined,
    projection:
      accounts && projectionTransactions
        ? {
            accounts,
            transactions: projectionTransactions,
          }
        : undefined,
  });

  await dismissResolvedNotifications(generated.map((notification) => notification.dedupe_key));

  if (generated.length === 0) return;

  const { error } = await supabase
    .from("notifications")
    .upsert(generated as TablesInsert<"notifications">[], {
      onConflict: "organization_id,dedupe_key",
    });

  if (error) {
    console.warn("notification sync failed", error);
  }
}

async function dismissResolvedNotifications(activeDedupeKeys: string[]) {
  const supabase = await createClient();
  const { data: activeNotifications } = await supabase
    .from("notifications")
    .select("id,dedupe_key,type")
    .is("dismissed_at", null)
    .in("type", [
      "invoice_due",
      "pending_transaction_due",
      "budget_overrun",
      "cash_risk",
      "import_review",
      "import_failed",
    ])
    .limit(200);

  const activeKeys = new Set(activeDedupeKeys);
  const resolvedIds =
    activeNotifications
      ?.filter((notification) => !activeKeys.has(notification.dedupe_key))
      .map((notification) => notification.id) ?? [];

  if (resolvedIds.length === 0) return;

  const { error } = await supabase
    .from("notifications")
    .update({ dismissed_at: new Date().toISOString() })
    .in("id", resolvedIds);

  if (error) {
    console.warn("resolved notification cleanup failed", error);
  }
}

export async function getSidebarNotifications(): Promise<SidebarNotificationsState> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [{ data: notifications }, { count }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id,type,severity,title,body,action_label,action_href,read_at,created_at")
      .is("dismissed_at", null)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null)
      .is("dismissed_at", null)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`),
  ]);

  return {
    notifications: notifications ?? [],
    unreadCount: count ?? 0,
  };
}
