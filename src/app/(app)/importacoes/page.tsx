import { ImportsUploadManager } from "@/components/imports/imports-upload-manager";
import { createClient } from "@/lib/supabase/server";

export default async function ImportacoesPage() {
  const supabase = await createClient();
  const [
    { data: accounts, error: accountsError },
    { data: imports, error: importsError },
    { data: categories, error: categoriesError },
  ] = await Promise.all([
    supabase.from("accounts").select("*").eq("is_active", true).order("created_at"),
    supabase.from("imports").select("*").order("created_at", { ascending: false }).limit(80),
    supabase.from("chart_of_accounts").select("*").eq("is_active", true).order("display_order"),
  ]);

  const error = accountsError || importsError || categoriesError;

  return (
    <div className="flex flex-col gap-lg">
      {error ? (
        <div className="rounded-lg border border-danger/30 bg-danger-soft px-md py-sm text-body-sm text-danger">
          Não foi possível carregar a área de importações. Tente novamente.
        </div>
      ) : null}
      <ImportsUploadManager
        accounts={accounts ?? []}
        categories={categories ?? []}
        imports={imports ?? []}
      />
    </div>
  );
}
