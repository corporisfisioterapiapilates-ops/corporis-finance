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

  const { error } = await supabase.from("chart_of_accounts").insert({
    organization_id: parent.organization_id,
    parent_id: parent.id,
    code: nextCode,
    name: parsed.data.name,
    nature: parent.nature === "income" ? "income" : "expense",
    dfc_group: parent.dfc_group,
    cost_classification: parent.nature === "income" ? "variable" : null,
    display_order: nextDisplayOrder,
  });

  if (error) {
    return { ok: false, error: "Não foi possível criar a conta filha." };
  }

  revalidatePath("/plano-de-contas");
  return { ok: true, message: "Conta filha criada." };
}
