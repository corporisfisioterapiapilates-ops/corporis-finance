"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const accountSchema = z.object({
  name: z.string().min(1, "Informe o nome da conta."),
  type: z.enum(["checking", "savings", "cash"]),
  bank_name: z.string().optional(),
  color: z.string().optional(),
  opening_balance: z.string().default("0"),
  opening_balance_date: z.string().optional(),
});

const onboardingSchema = z.object({
  orgName: z.string().min(1, "Informe o nome da clínica."),
  fullName: z.string().optional(),
  account: accountSchema,
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type OnboardingResult = { ok: true } | { ok: false; error: string };

export async function completeOnboarding(input: OnboardingInput): Promise<OnboardingResult> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const supabase = await createClient();
  const { account, orgName, fullName } = parsed.data;

  const { error } = await supabase.rpc("complete_onboarding", {
    p_org_name: orgName,
    p_full_name: fullName ?? "",
    p_account: {
      name: account.name,
      type: account.type,
      bank_name: account.bank_name ?? "",
      color: account.color ?? "",
      opening_balance: account.opening_balance,
      opening_balance_date: account.opening_balance_date ?? "",
    },
  });

  if (error) {
    return {
      ok: false,
      error:
        error.message === "Onboarding já concluído"
          ? "Sua clínica já foi configurada."
          : "Não foi possível concluir a configuração. Tente novamente.",
    };
  }

  return { ok: true };
}
