"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { parseBRL } from "@/lib/money";
import { syncOrganizationNotifications } from "@/lib/notifications/server";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/lib/supabase/types";

const budgetValueSchema = z.object({
  chartAccountId: z.string().uuid("Conta inválida."),
  month: z.number().int().min(1).max(12),
  amount: z.string().trim(),
});

const saveBudgetSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  versionId: z.string().uuid().nullable().optional(),
  values: z.array(budgetValueSchema).max(2000, "Orçamento muito grande para salvar de uma vez."),
});

const createBudgetVersionSchema = saveBudgetSchema.extend({
  name: z
    .string()
    .trim()
    .min(2, "Informe um nome para a nova versão.")
    .max(80, "Use um nome de versão mais curto."),
  sourceVersionId: z.string().uuid().nullable().optional(),
});

export type SaveBudgetResult =
  | { ok: true; message: string; versionId: string }
  | { ok: false; error: string };

export async function saveBudget(
  input: z.infer<typeof saveBudgetSchema>,
): Promise<SaveBudgetResult> {
  const parsed = saveBudgetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) {
    return { ok: false, error: "Organização não encontrada." };
  }

  const versionId = await ensureBudgetVersion({
    organizationId,
    year: parsed.data.year,
    versionId: parsed.data.versionId ?? null,
  });

  if (!versionId) {
    return { ok: false, error: "Não foi possível preparar a versão do orçamento." };
  }

  const rows: TablesInsert<"budget_values">[] = parsed.data.values.map((value) => ({
    organization_id: organizationId,
    budget_version_id: versionId,
    chart_account_id: value.chartAccountId,
    month: value.month,
    amount: Number(parseBRL(value.amount)),
  }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("budget_values")
      .upsert(rows, { onConflict: "budget_version_id,chart_account_id,month" });

    if (error) {
      return { ok: false, error: "Não foi possível salvar o orçamento. Tente novamente." };
    }
  }

  await syncOrganizationNotifications();
  revalidatePath("/orcamento");
  revalidatePath("/orcamento/editor");
  revalidatePath("/");
  return { ok: true, message: "Orçamento salvo.", versionId };
}

export async function createBudgetVersion(
  input: z.infer<typeof createBudgetVersionSchema>,
): Promise<SaveBudgetResult> {
  const parsed = createBudgetVersionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) {
    return { ok: false, error: "Organização não encontrada." };
  }

  const { data: versionId, error: versionError } = await supabase.rpc("create_budget_version", {
    p_year: parsed.data.year,
    p_name: parsed.data.name,
    p_source_version_id: parsed.data.sourceVersionId ?? null,
  });

  if (versionError || !versionId) {
    const isDuplicate = versionError?.code === "23505";
    return {
      ok: false,
      error: isDuplicate
        ? "Já existe uma versão com esse nome para o ano selecionado."
        : "Não foi possível criar a nova versão. Tente novamente.",
    };
  }

  const rows: TablesInsert<"budget_values">[] = parsed.data.values.map((value) => ({
    organization_id: organizationId,
    budget_version_id: versionId,
    chart_account_id: value.chartAccountId,
    month: value.month,
    amount: Number(parseBRL(value.amount)),
  }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("budget_values")
      .upsert(rows, { onConflict: "budget_version_id,chart_account_id,month" });

    if (error) {
      return {
        ok: false,
        error:
          "A versão foi criada, mas não foi possível salvar todos os valores editados. Abra a versão e tente salvar novamente.",
      };
    }
  }

  await syncOrganizationNotifications();
  revalidatePath("/orcamento");
  revalidatePath("/orcamento/editor");
  revalidatePath("/");
  return { ok: true, message: "Nova versão criada.", versionId };
}

async function ensureBudgetVersion({
  organizationId,
  year,
  versionId,
}: {
  organizationId: string;
  year: number;
  versionId: string | null;
}): Promise<string | null> {
  const supabase = await createClient();

  if (versionId) {
    const { data, error } = await supabase
      .from("budget_versions")
      .select("id")
      .eq("id", versionId)
      .eq("organization_id", organizationId)
      .single();
    return error ? null : (data?.id ?? null);
  }

  const { data: existing, error: existingError } = await supabase
    .from("budget_versions")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("year", year)
    .eq("status", "active")
    .maybeSingle();

  if (existingError) {
    return null;
  }
  if (existing?.id) {
    return existing.id;
  }

  const { data, error } = await supabase
    .from("budget_versions")
    .insert({
      organization_id: organizationId,
      year,
      name: "v1 - Janeiro",
      status: "active",
    })
    .select("id")
    .single();

  return error ? null : (data?.id ?? null);
}

async function getCurrentOrganizationId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  return data?.organization_id ?? null;
}
