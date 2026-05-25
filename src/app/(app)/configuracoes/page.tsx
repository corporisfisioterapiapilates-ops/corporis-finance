import { SettingsManager } from "@/components/settings/settings-manager";
import { createClient } from "@/lib/supabase/server";

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, organizations(id,name,locale,timezone,currency)")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  return (
    <SettingsManager
      email={user?.email ?? ""}
      fullName={profile?.full_name ?? ""}
      organization={{
        name: profile?.organizations?.name ?? "Corporis Finance",
        locale: profile?.organizations?.locale ?? "pt-BR",
        timezone: profile?.organizations?.timezone ?? "America/Sao_Paulo",
        currency: profile?.organizations?.currency ?? "BRL",
      }}
    />
  );
}
