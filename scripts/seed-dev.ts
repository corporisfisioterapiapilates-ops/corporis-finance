import { createClient } from "@supabase/supabase-js";
import { addDays, endOfMonth, format, startOfMonth, subMonths } from "date-fns";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_EMAIL = process.env.SEED_USER_EMAIL ?? "pferrazlarissa@gmail.com";
const SEED_PREFIX = "seed-dev-v1";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Preencha NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type Account = {
  id: string;
  name: string;
  type: string;
  organization_id: string;
};

type Category = {
  id: string;
  code: string;
  name: string;
};

type SeedTransaction = {
  organization_id: string;
  account_id: string;
  category_id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  event_date: string;
  cash_date: string;
  status: "cleared" | "pending";
  source: "manual" | "recurring";
  external_id: string;
  notes: string;
};

async function main() {
  const orgId = await resolveOrganizationId();
  const [{ data: accounts, error: accountsError }, { data: categories, error: categoriesError }] =
    await Promise.all([
      supabase.from("accounts").select("id,name,type,organization_id").eq("organization_id", orgId),
      supabase.from("chart_of_accounts").select("id,code,name").eq("organization_id", orgId),
    ]);

  if (accountsError) throw accountsError;
  if (categoriesError) throw categoriesError;
  if (!accounts?.length) {
    throw new Error("Nenhuma conta encontrada. Complete o onboarding antes de rodar o seed.");
  }

  const account = pickPrimaryAccount(accounts);
  const categoriesByCode = new Map((categories ?? []).map((category) => [category.code, category]));
  const transactions = buildTransactions({
    orgId,
    accountId: account.id,
    category: (code) => getCategory(categoriesByCode, code),
  });

  const { error: deleteError } = await supabase
    .from("transactions")
    .delete()
    .like("external_id", `${SEED_PREFIX}-%`);

  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase.from("transactions").insert(transactions);
  if (insertError) throw insertError;

  const totals = transactions.reduce(
    (summary, transaction) => {
      summary[transaction.type] += transaction.amount;
      return summary;
    },
    { expense: 0, income: 0 },
  );

  console.log(
    JSON.stringify(
      {
        organizationId: orgId,
        account: account.name,
        inserted: transactions.length,
        income: totals.income.toFixed(2),
        expense: totals.expense.toFixed(2),
      },
      null,
      2,
    ),
  );
}

async function resolveOrganizationId(): Promise<string> {
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) throw usersError;

  const targetUser = users.users.find((user) => user.email === TARGET_EMAIL);
  if (targetUser) {
    const { data: targetProfile, error: targetProfileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", targetUser.id)
      .maybeSingle();

    if (targetProfileError) throw targetProfileError;
    if (targetProfile?.organization_id) return targetProfile.organization_id;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id")
    .not("organization_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (profileError) throw profileError;
  if (profile?.organization_id) return profile.organization_id;

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (orgError) throw orgError;
  if (!org?.id) {
    throw new Error("Nenhuma organização encontrada. Complete o onboarding antes de rodar o seed.");
  }

  return org.id;
}

function pickPrimaryAccount(accounts: Account[]): Account {
  const account =
    accounts.find((account) => account.type === "checking") ??
    accounts.find((account) => account.type !== "credit_card") ??
    accounts[0];

  if (!account) {
    throw new Error("Nenhuma conta encontrada para receber os lançamentos de seed.");
  }

  return account;
}

function getCategory(categoriesByCode: Map<string, Category>, code: string): Category {
  const category = categoriesByCode.get(code);
  if (!category) {
    throw new Error(`Categoria ${code} não encontrada no plano de contas.`);
  }
  return category;
}

function buildTransactions({
  orgId,
  accountId,
  category,
}: {
  orgId: string;
  accountId: string;
  category: (code: string) => Category;
}): SeedTransaction[] {
  const today = new Date();
  const months = Array.from({ length: 6 }, (_, index) => startOfMonth(subMonths(today, 5 - index)));
  const transactions: SeedTransaction[] = [];

  months.forEach((monthDate, monthIndex) => {
    const monthKey = format(monthDate, "yyyy-MM");
    const factor = 0.92 + monthIndex * 0.035;
    const entries = monthlyEntries(monthDate, factor);

    entries.forEach((entry, entryIndex) => {
      const selectedCategory = category(entry.categoryCode);
      transactions.push({
        organization_id: orgId,
        account_id: accountId,
        category_id: selectedCategory.id,
        type: entry.type,
        amount: roundMoney(entry.amount),
        description: entry.description,
        event_date: entry.date,
        cash_date: entry.date,
        status: entry.status,
        source: entry.recurring ? "recurring" : "manual",
        external_id: `${SEED_PREFIX}-${monthKey}-${String(entryIndex + 1).padStart(2, "0")}`,
        notes: "Lançamento gerado automaticamente para validação visual e funcional.",
      });
    });
  });

  return transactions;
}

function monthlyEntries(monthDate: Date, factor: number) {
  const lastDay = endOfMonth(monthDate).getDate();
  const at = (day: number) => format(addDays(monthDate, Math.min(day, lastDay) - 1), "yyyy-MM-dd");

  return [
    income("1.01", "Mensalidades Pilates", at(5), 6800 * factor, true),
    income("1.01", "Pacotes Pilates - alunas avulsas", at(18), 3600 * factor, false),
    income("1.02", "Atendimentos de Fisioterapia", at(8), 7200 * factor, false),
    income("1.03", "Fisio Pélvica", at(12), 4200 * factor, false),
    income("1.04", "Sessões de Taping", at(16), 1100 * factor, false),
    income("1.05", "Primeiras consultas", at(22), 1900 * factor, false),
    income("1.06", "Combos Corporis", at(27), 2600 * factor, false),
    expense("2.01", "Simples Nacional", at(20), 1850 * factor, true),
    expense("3.02", "Lavanderia de toalhas", at(7), 1300 * factor, true),
    expense("3.03", "Materiais para atendimentos", at(11), 1450 * factor, false),
    expense("4.01.01", "Salários equipe", at(5), 7800 * factor, true),
    expense("4.01.06", "FGTS equipe", at(7), 624 * factor, true),
    expense("4.01.07", "INSS patronal", at(20), 980 * factor, true),
    expense("4.01.13", "Pró-labore sócia", at(10), 4200 * factor, true),
    expense("4.02.01", "Aluguel e condomínio", at(6), 3200 * factor, true),
    expense("4.02.02", "Luz, água e gás", at(15), 520 * factor, true),
    expense("4.02.03", "Telefone e internet", at(17), 190 * factor, true),
    expense("4.02.04", "Contabilidade", at(10), 690 * factor, true),
    expense("4.02.07", "Sistemas de gestão", at(12), 360 * factor, true),
    expense("4.02.09", "Material de limpeza", at(21), 280 * factor, false),
    expense("4.03.07", "Assessoria de marketing", at(14), 1250 * factor, true),
    expense("4.03.09", "Anúncios Meta Ads", at(25), 780 * factor, false),
    expense("5.02", "Tarifas bancárias", at(28), 115 * factor, true),
    expense("7.06", "Melhoria de software", at(23), 900 * factor, false),
  ];
}

function income(
  categoryCode: string,
  description: string,
  date: string,
  amount: number,
  recurring: boolean,
) {
  return entry("income", categoryCode, description, date, amount, recurring);
}

function expense(
  categoryCode: string,
  description: string,
  date: string,
  amount: number,
  recurring: boolean,
) {
  return entry("expense", categoryCode, description, date, amount, recurring);
}

function entry(
  type: "income" | "expense",
  categoryCode: string,
  description: string,
  date: string,
  amount: number,
  recurring: boolean,
) {
  return {
    type,
    categoryCode,
    description,
    date,
    amount,
    recurring,
    status: date > format(new Date(), "yyyy-MM-dd") ? ("pending" as const) : ("cleared" as const),
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
