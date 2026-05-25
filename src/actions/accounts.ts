"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const accountTypeSchema = z.enum(["checking", "savings", "cash", "credit_card"]);

const accountSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Informe o nome da conta.").max(80, "Nome muito longo."),
  type: accountTypeSchema,
  bank_name: z.string().trim().optional(),
  color: z.string().trim().optional(),
  opening_balance: z.string().regex(/^-?\d+(\.\d{1,2})?$/, "Saldo inválido."),
  opening_balance_date: z.string().optional(),
  credit_limit: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Limite inválido.")
    .optional(),
  closing_day: z.number().int().min(1).max(31).nullable(),
  due_day: z.number().int().min(1).max(31).nullable(),
  default_payment_account_id: z.string().uuid().nullable(),
  is_active: z.boolean(),
});

export type AccountInput = z.infer<typeof accountSchema>;
export type AccountActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function saveAccount(input: AccountInput): Promise<AccountActionResult> {
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return { ok: false, error: "Organização não encontrada." };
  }

  const account = parsed.data;
  const isCreditCard = account.type === "credit_card";
  const payload = {
    organization_id: profile.organization_id,
    name: account.name,
    type: account.type,
    bank_name: account.bank_name || null,
    color: account.color || null,
    opening_balance: Number(account.opening_balance),
    opening_balance_date: account.opening_balance_date || null,
    credit_limit: isCreditCard ? Number(account.credit_limit || "0.00") : null,
    closing_day: isCreditCard ? account.closing_day : null,
    due_day: isCreditCard ? account.due_day : null,
    default_payment_account_id: isCreditCard ? account.default_payment_account_id : null,
    is_active: account.is_active,
  };

  const { error } = account.id
    ? await supabase.from("accounts").update(payload).eq("id", account.id)
    : await supabase.from("accounts").insert(payload);

  if (error) {
    return { ok: false, error: "Não foi possível salvar a conta. Tente novamente." };
  }

  revalidatePath("/contas");
  return { ok: true, message: account.id ? "Conta atualizada." : "Conta criada." };
}
