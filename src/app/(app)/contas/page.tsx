import { AccountsManager } from "@/components/accounts/accounts-manager";
import { createClient } from "@/lib/supabase/server";

export default async function UcontasPage() {
  const supabase = await createClient();
  const [{ data: accounts, error }, { data: transactions }] = await Promise.all([
    supabase.from("accounts").select("*").order("created_at", { ascending: true }),
    supabase.from("transactions").select("*").order("cash_date", { ascending: false }),
  ]);

  return (
    <div className="flex flex-col gap-lg">
      <div>
        <h1 className="font-display text-display-2 lowercase text-ink">Contas e Cartões</h1>
        <p className="mt-xs text-body text-ink-secondary">
          Saldos iniciais, contas bancárias e cartões usados no fluxo de caixa.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-danger/30 bg-danger-soft px-md py-sm text-body-sm text-danger">
          Não foi possível carregar as contas. Tente novamente.
        </div>
      ) : (
        <AccountsManager accounts={accounts ?? []} transactions={transactions ?? []} />
      )}
    </div>
  );
}
