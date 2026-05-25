"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const organizationSettingsSchema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome completo.").max(120, "Nome muito longo."),
  organization_name: z
    .string()
    .trim()
    .min(2, "Informe o nome da clínica.")
    .max(140, "Nome da clínica muito longo."),
  locale: z.enum(["pt-BR"]),
  timezone: z.enum(["America/Sao_Paulo"]),
  currency: z.enum(["BRL"]),
});

export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>;

export type SettingsActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function updateOrganizationSettings(
  input: OrganizationSettingsInput,
): Promise<SettingsActionResult> {
  const parsed = organizationSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return { ok: false, error: "Organização não encontrada." };
  }

  const { error: updateProfileError } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name })
    .eq("id", user.id);

  if (updateProfileError) {
    return { ok: false, error: "Não foi possível salvar seu perfil." };
  }

  const { error: updateOrganizationError } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.organization_name,
      locale: parsed.data.locale,
      timezone: parsed.data.timezone,
      currency: parsed.data.currency,
    })
    .eq("id", profile.organization_id);

  if (updateOrganizationError) {
    return { ok: false, error: "Não foi possível salvar os dados da clínica." };
  }

  revalidatePath("/configuracoes");
  revalidatePath("/", "layout");
  return { ok: true, message: "Configurações salvas." };
}
