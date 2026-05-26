"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/lib/supabase/types";

const natureSchema = z.enum(["income", "expense", "transfer", "calculated"]);
const costClassificationSchema = z.enum(["fixed", "variable"]).nullable();

const updateChartAccountSchema = z.object({
  id: z.string().uuid("Conta inválida."),
  name: z.string().trim().min(1, "Informe o nome da conta.").max(120, "Nome muito longo."),
  nature: natureSchema,
  cost_classification: costClassificationSchema,
  is_active: z.boolean(),
});

const createChildSchema = z.object({
  parentId: z.string().uuid("Conta pai inválida."),
  name: z.string().trim().min(1, "Informe o nome da nova conta.").max(120, "Nome muito longo."),
});

const deleteChartAccountSchema = z.object({
  id: z.string().uuid("Conta inválida."),
});

export type ChartAccountActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function updateChartAccount(
  input: z.infer<typeof updateChartAccountSchema>,
): Promise<ChartAccountActionResult> {
  const parsed = updateChartAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const payload: TablesUpdate<"chart_of_accounts"> = {
    name: parsed.data.name,
    nature: parsed.data.nature,
    cost_classification: parsed.data.cost_classification,
    is_active: parsed.data.is_active,
  };

  const { error } = await supabase
    .from("chart_of_accounts")
    .update(payload)
    .eq("id", parsed.data.id);

  if (error) {
    return { ok: false, error: "Não foi possível salvar a conta. Tente novamente." };
  }

  revalidatePath("/plano-de-contas");
  return { ok: true, message: "Conta salva." };
}

export async function createChartAccountChild(
  input: z.infer<typeof createChildSchema>,
): Promise<ChartAccountActionResult> {
  const parsed = createChildSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data: parent, error: parentError } = await supabase
    .from("chart_of_accounts")
    .select("id, organization_id, code, nature, dfc_group")
    .eq("id", parsed.data.parentId)
    .single();

  if (parentError || !parent) {
    return { ok: false, error: "Conta pai não encontrada." };
  }

  const { data: siblings, error: siblingsError } = await supabase
    .from("chart_of_accounts")
    .select("code, display_order")
    .eq("parent_id", parent.id)
    .order("display_order", { ascending: true });

  if (siblingsError) {
    return { ok: false, error: "Não foi possível calcular o próximo código." };
  }

  const nextIndex =
    (siblings ?? []).reduce((max, sibling) => {
      const lastSegment = sibling.code.split(".").at(-1);
      const value = lastSegment ? Number.parseInt(lastSegment, 10) : 0;
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0) + 1;

  const nextCode = `${parent.code}.${String(nextIndex).padStart(2, "0")}`;
  const nextDisplayOrder =
    (siblings ?? []).reduce((max, sibling) => Math.max(max, sibling.display_order), 0) + 1;
  const childNature = getChildNature(parent.nature, parent.code);

  const { error } = await supabase.from("chart_of_accounts").insert({
    organization_id: parent.organization_id,
    parent_id: parent.id,
    code: nextCode,
    name: parsed.data.name,
    nature: childNature,
    dfc_group: parent.dfc_group,
    cost_classification: childNature === "income" ? "variable" : null,
    display_order: nextDisplayOrder,
  });

  if (error) {
    return { ok: false, error: "Não foi possível criar a conta filha." };
  }

  revalidatePath("/plano-de-contas");
  return { ok: true, message: "Conta filha criada." };
}

export async function deleteChartAccount(
  input: z.infer<typeof deleteChartAccountSchema>,
): Promise<ChartAccountActionResult> {
  const parsed = deleteChartAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data: account, error: accountError } = await supabase
    .from("chart_of_accounts")
    .select("id, organization_id, name")
    .eq("id", parsed.data.id)
    .single();

  if (accountError || !account) {
    return { ok: false, error: "Conta não encontrada." };
  }

  const { data: allAccounts, error: accountsError } = await supabase
    .from("chart_of_accounts")
    .select("id, parent_id")
    .eq("organization_id", account.organization_id);

  if (accountsError) {
    return { ok: false, error: "Não foi possível validar as subcontas." };
  }

  const descendantIds = collectDescendantIds(allAccounts ?? [], account.id);

  const { count: transactionCount, error: transactionsError } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .in("category_id", descendantIds);

  if (transactionsError) {
    return { ok: false, error: "Não foi possível verificar lançamentos vinculados." };
  }

  if ((transactionCount ?? 0) > 0) {
    return {
      ok: false,
      error: `Não é possível excluir "${account.name}": há ${transactionCount} lançamento(s) vinculado(s).`,
    };
  }

  if (descendantIds.length > 1) {
    return {
      ok: false,
      error: "Esta conta possui subcontas. Exclua ou reorganize as subcontas antes.",
    };
  }

  const { error } = await supabase.from("chart_of_accounts").delete().eq("id", account.id);

  if (error) {
    return { ok: false, error: "Não foi possível excluir a conta. Verifique vínculos existentes." };
  }

  revalidatePath("/plano-de-contas");
  return { ok: true, message: "Conta excluída." };
}

function getChildNature(parentNature: string, parentCode: string): "income" | "expense" {
  if (parentNature === "income") {
    return "income";
  }

  if (parentNature === "expense") {
    return "expense";
  }

  const group = parentCode.split(".")[0];
  if (group === "1") {
    return "income";
  }

  return "expense";
}

function collectDescendantIds(
  accounts: Array<{ id: string; parent_id: string | null }>,
  rootId: string,
) {
  const childrenByParent = new Map<string, string[]>();
  for (const account of accounts) {
    if (!account.parent_id) {
      continue;
    }

    const children = childrenByParent.get(account.parent_id) ?? [];
    children.push(account.id);
    childrenByParent.set(account.parent_id, children);
  }

  const ids = [rootId];
  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index];
    if (!id) {
      continue;
    }

    ids.push(...(childrenByParent.get(id) ?? []));
  }

  return ids;
}
