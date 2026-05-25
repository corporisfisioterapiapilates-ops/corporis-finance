import { BudgetManager } from "@/components/budget/budget-manager";
import { createClient } from "@/lib/supabase/server";

type BudgetEditorPageProps = {
  searchParams?: Promise<{ year?: string | string[]; version?: string | string[] }>;
};

export default async function OrcamentoEditorPage({ searchParams }: BudgetEditorPageProps) {
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const selectedYearParam = Array.isArray(params?.year) ? params?.year[0] : params?.year;
  const selectedVersionParam = Array.isArray(params?.version)
    ? params?.version[0]
    : params?.version;
  const selectedYear = Number(selectedYearParam) || currentYear;
  const supabase = await createClient();

  const [{ data: accounts, error: accountsError }, { data: versions, error: versionsError }] =
    await Promise.all([
      supabase
        .from("chart_of_accounts")
        .select("id,parent_id,code,name,nature,display_order,is_active")
        .order("display_order", { ascending: true }),
      supabase
        .from("budget_versions")
        .select("id,name,status,year,created_at")
        .eq("year", selectedYear)
        .order("created_at", { ascending: false }),
    ]);

  const safeVersions = versions ?? [];
  const selectedVersion =
    safeVersions.find((version) => version.id === selectedVersionParam) ??
    safeVersions.find((version) => version.status === "active") ??
    safeVersions[0] ??
    null;

  const { data: values, error: valuesError } = selectedVersion
    ? await supabase
        .from("budget_values")
        .select("chart_account_id,month,amount")
        .eq("budget_version_id", selectedVersion.id)
    : { data: [], error: null };

  const loadError = accountsError || versionsError || valuesError;

  return (
    <div>
      {loadError ? (
        <div className="mb-md rounded-lg border border-danger/30 bg-danger-soft px-md py-sm text-body-sm text-danger">
          Não foi possível carregar o orçamento agora. Tente novamente em instantes.
        </div>
      ) : null}
      <BudgetManager
        accounts={accounts ?? []}
        values={values ?? []}
        versions={safeVersions}
        selectedYear={selectedYear}
        selectedVersionId={selectedVersion?.id ?? null}
      />
    </div>
  );
}
