import { ChartOfAccountsManager } from "@/components/chart-of-accounts/chart-of-accounts-manager";
import { createClient } from "@/lib/supabase/server";

export default async function UplanoUdeUcontasPage() {
  const supabase = await createClient();
  const { data: accounts, error } = await supabase
    .from("chart_of_accounts")
    .select("*")
    .order("display_order", { ascending: true })
    .order("code", { ascending: true });

  return (
    <div className="flex flex-col gap-lg">
      <div>
        <h1 className="font-display text-display-2 lowercase text-ink">Plano de Contas</h1>
        <p className="mt-xs text-body text-ink-secondary">
          Estrutura do DFC Corporis com grupos, contas e classificações de custo.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-danger/30 bg-danger-soft px-md py-sm text-body-sm text-danger">
          Não foi possível carregar o plano de contas. Tente novamente.
        </div>
      ) : (
        <ChartOfAccountsManager accounts={accounts ?? []} />
      )}
    </div>
  );
}
