import Link from "next/link";
import { TransactionsManager } from "@/components/transactions/transactions-manager";
import { createClient } from "@/lib/supabase/server";

type LancamentosPageProps = {
  searchParams?: Promise<{ novo?: string | string[]; importacao?: string | string[] }>;
};

export default async function UlancamentosPage({ searchParams }: LancamentosPageProps) {
  const params = await searchParams;
  const shouldOpenNew = (Array.isArray(params?.novo) ? params?.novo[0] : params?.novo) === "1";
  const importParam = Array.isArray(params?.importacao)
    ? params?.importacao[0]
    : params?.importacao;
  const importId = importParam && /^[0-9a-f-]{36}$/i.test(importParam) ? importParam : null;
  const supabase = await createClient();
  const { data: filterImport } = importId
    ? await supabase.from("imports").select("filename").eq("id", importId).maybeSingle()
    : { data: null };
  const [
    { data: transactions, error: transactionsError },
    { data: accounts },
    { data: categories },
  ] = await Promise.all([
    (importId
      ? supabase.from("transactions").select("*,attachments(*)").eq("import_id", importId)
      : supabase.from("transactions").select("*,attachments(*)")
    ).order("cash_date", { ascending: false }),
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

      {importId ? (
        <div className="flex flex-wrap items-center gap-sm rounded-lg border border-line bg-beige-soft px-md py-sm text-body-sm text-ink">
          <span>
            Mostrando só os lançamentos do arquivo{" "}
            <strong>{filterImport?.filename ?? "removido"}</strong>. Você pode editar ou excluir
            cada linha.
          </span>
          <Link href="/lancamentos" className="ml-auto text-orange underline">
            Ver todos os lançamentos
          </Link>
        </div>
      ) : null}

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
