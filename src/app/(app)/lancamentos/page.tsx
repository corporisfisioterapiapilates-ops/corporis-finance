import { TransactionsManager } from "@/components/transactions/transactions-manager";
import { createClient } from "@/lib/supabase/server";

type LancamentosPageProps = {
  searchParams?: Promise<{ novo?: string | string[] }>;
};

export default async function UlancamentosPage({ searchParams }: LancamentosPageProps) {
  const params = await searchParams;
  const shouldOpenNew = (Array.isArray(params?.novo) ? params?.novo[0] : params?.novo) === "1";
  const supabase = await createClient();
  const [
    { data: transactions, error: transactionsError },
    { data: accounts },
    { data: categories },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("*,attachments(*)")
      .order("cash_date", { ascending: false }),
    supabase.from("accounts").select("*").eq("is_active", true).order("created_at"),
    supabase.from("chart_of_accounts").select("*").eq("is_active", true).order("display_order"),
  ]);

  return (
    <div className="flex flex-col gap-lg">
      <div>
        <h1 className="font-display text-display-2 lowercase text-ink">Lançamentos</h1>
        <p className="mt-xs text-body text-ink-secondary">
          Registre entradas, saídas e transferências em regime de caixa.
        </p>
      </div>

      {transactionsError ? (
        <div className="rounded-lg border border-danger/30 bg-danger-soft px-md py-sm text-body-sm text-danger">
          Não foi possível carregar os lançamentos. Tente novamente.
        </div>
      ) : (
        <TransactionsManager
          transactions={transactions ?? []}
          accounts={accounts ?? []}
          categories={categories ?? []}
          initialOpen={shouldOpenNew}
        />
      )}
    </div>
  );
}
