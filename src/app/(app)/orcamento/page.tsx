import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import {
  type BudgetVsActualKpi,
  type BudgetVsActualRow,
  calculateBudgetVsActual,
} from "@/lib/dfc/budget-vs-actual";
import { formatBRL } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type BudgetPageProps = {
  searchParams?: Promise<{ month?: string | string[] }>;
};

export default async function OrcamentoPage({ searchParams }: BudgetPageProps) {
  const params = await searchParams;
  const monthParam = Array.isArray(params?.month) ? params?.month[0] : params?.month;
  const monthKey = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthKey();
  const selectedYear = Number(monthKey.slice(0, 4));
  const supabase = await createClient();

  const [
    { data: accounts, error: accountsError },
    { data: transactions, error: transactionsError },
    { data: versions, error: versionsError },
  ] = await Promise.all([
    supabase
      .from("chart_of_accounts")
      .select("id,parent_id,code,name,nature,display_order,is_active")
      .order("display_order", { ascending: true }),
    supabase
      .from("transactions")
      .select("category_id,amount,cash_date,status,type")
      .gte("cash_date", `${monthKey}-01`)
      .lt("cash_date", nextMonthStart(monthKey)),
    supabase
      .from("budget_versions")
      .select("id,name,status,year,created_at")
      .eq("year", selectedYear)
      .order("created_at", { ascending: false }),
  ]);

  const selectedVersion =
    versions?.find((version) => version.status === "active") ?? versions?.[0] ?? null;
  const { data: budgetValues, error: budgetError } = selectedVersion
    ? await supabase
        .from("budget_values")
        .select("chart_account_id,month,amount")
        .eq("budget_version_id", selectedVersion.id)
        .eq("month", Number(monthKey.slice(5, 7)))
    : { data: [], error: null };

  const loadError = accountsError || transactionsError || versionsError || budgetError;
  const comparison = calculateBudgetVsActual({
    accounts: accounts ?? [],
    budgetValues: budgetValues ?? [],
    transactions: transactions ?? [],
    monthKey,
  });

  return (
    <div className="-m-[32px] flex flex-col">
      <header className="flex h-16 shrink-0 items-center gap-md border-b border-line bg-base px-lg">
        <h1 className="font-display text-[22px] lowercase text-ink">orçado x realizado</h1>
        <div className="ml-auto flex items-center gap-sm">
          <Link
            href={comparison.previousHref}
            aria-label="Mês anterior"
            className="inline-flex size-8 items-center justify-center rounded-md border border-line bg-surface text-ink-secondary transition hover:bg-sunken"
          >
            <ChevronLeft size={15} strokeWidth={1.5} />
          </Link>
          <div className="min-w-[150px] rounded-md border border-line bg-surface px-md py-[7px] text-center text-body-sm font-medium capitalize text-ink shadow-sm-warm">
            {comparison.monthLabel}
          </div>
          <Link
            href={comparison.nextHref}
            aria-label="Próximo mês"
            className="inline-flex size-8 items-center justify-center rounded-md border border-line bg-surface text-ink-secondary transition hover:bg-sunken"
          >
            <ChevronRight size={15} strokeWidth={1.5} />
          </Link>
          <Link
            href={`/orcamento/editor?year=${selectedYear}`}
            className="inline-flex h-9 items-center gap-xs rounded-lg border border-orange px-md text-body-sm font-medium text-orange transition hover:bg-orange-soft"
          >
            <Pencil size={15} strokeWidth={1.5} />
            Editar orçamento
          </Link>
          <a
            href={toCsvHref(comparison.rows)}
            download={`orcado-realizado-${monthKey}.csv`}
            className="inline-flex h-9 items-center gap-xs rounded-lg border border-line bg-surface px-md text-body-sm text-ink-secondary shadow-sm-warm transition hover:bg-sunken"
          >
            <Download size={15} strokeWidth={1.5} />
            Exportar
          </a>
        </div>
      </header>

      <main className="flex flex-col gap-lg p-lg">
        {loadError ? (
          <div className="rounded-lg border border-danger/30 bg-danger-soft px-md py-sm text-body-sm text-danger">
            Não foi possível carregar o comparativo agora. Tente novamente em instantes.
          </div>
        ) : null}

        {!selectedVersion ? (
          <div className="rounded-lg border border-beige/40 bg-beige-soft px-md py-sm text-body-sm text-[#9F7E3D]">
            Nenhuma versão de orçamento encontrada para {selectedYear}. Use o editor para salvar a
            primeira versão.
          </div>
        ) : null}

        <section className="grid gap-md lg:grid-cols-4">
          <KpiCard
            label="Receita realizada"
            kpi={comparison.income}
            tone="success"
            helper="meta de receita"
          />
          <KpiCard
            label="Despesas realizadas"
            kpi={comparison.expenses}
            tone="danger"
            helper="limite de despesa"
          />
          <KpiCard
            label="Resultado realizado"
            kpi={comparison.result}
            tone="orange"
            helper="resultado previsto"
          />
          <article className="rounded-xl border border-line border-t-[3px] border-t-beige bg-surface p-lg shadow-sm-warm">
            <p className="mb-xs text-label font-medium uppercase tracking-[0.07em] text-ink-tertiary">
              Aderência global
            </p>
            <div className="flex items-end gap-xs">
              <p className="font-display text-[28px] leading-none text-ink">
                {comparison.adherencePercent}%
              </p>
              <p className="text-body-sm text-ink-tertiary">das categorias</p>
            </div>
            <p className="mt-xs text-body-sm text-ink-tertiary">
              {comparison.alertRows.length} itens acima de 10%
            </p>
            <Gauge percent={comparison.adherencePercent} tone="beige" />
          </article>
        </section>

        <section className="grid gap-lg xl:grid-cols-[minmax(0,1fr)_420px]">
          <ComparisonTable rows={comparison.rows} />
          <Alerts rows={comparison.alertRows} />
        </section>
      </main>
    </div>
  );
}

function KpiCard({
  label,
  kpi,
  tone,
  helper,
}: {
  label: string;
  kpi: BudgetVsActualKpi;
  tone: "success" | "danger" | "orange";
  helper: string;
}) {
  const actual = Number(kpi.actual);
  const budget = Number(kpi.budget);
  const percent = budget === 0 ? 0 : Math.min(120, Math.round((actual / budget) * 100));
  const Icon = kpi.favorable === false ? TrendingDown : TrendingUp;

  return (
    <article
      className={cn(
        "rounded-xl border border-line border-t-[3px] bg-surface p-lg shadow-sm-warm",
        tone === "success" && "border-t-green",
        tone === "danger" && "border-t-danger",
        tone === "orange" && "border-t-orange",
      )}
    >
      <p className="mb-xs text-label font-medium uppercase tracking-[0.07em] text-ink-tertiary">
        {label}
      </p>
      <p
        className={cn(
          "font-display text-[28px] leading-none",
          tone === "success" && "text-green-strong",
          tone === "danger" && "text-danger",
          tone === "orange" && "text-ink",
        )}
      >
        {formatBRL(kpi.actual)}
      </p>
      <p className="mt-xs text-body-sm text-ink-tertiary">Orçado: {formatBRL(kpi.budget)}</p>
      <Gauge percent={percent} tone={kpi.favorable === false ? "danger" : "success"} />
      <p
        className={cn(
          "mt-xs flex items-center gap-xs text-meta font-medium",
          kpi.favorable === false ? "text-danger" : "text-green-strong",
        )}
      >
        <Icon size={12} strokeWidth={2} />
        {formatPercent(kpi.variancePercent)} em relação ao {helper}
      </p>
    </article>
  );
}

function ComparisonTable({ rows }: { rows: BudgetVsActualRow[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm-warm">
      <div className="border-b border-line px-lg py-md">
        <h2 className="font-display text-[18px] lowercase text-ink">comparativo por conta</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-separate border-spacing-0">
          <thead>
            <tr>
              <TableHead className="text-left">Conta</TableHead>
              <TableHead>Orçado</TableHead>
              <TableHead>Realizado</TableHead>
              <TableHead>Variação R$</TableHead>
              <TableHead>Variação %</TableHead>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={cn(row.depth === 0 ? "bg-sunken" : "bg-surface hover:bg-base")}
              >
                <td
                  className={cn(
                    "border-b border-line px-md py-sm text-body-sm text-ink",
                    row.depth === 0 && "font-medium uppercase tracking-[0.06em]",
                  )}
                  style={{ paddingLeft: 18 + row.depth * 18 }}
                >
                  {row.code} {row.name}
                </td>
                <TableCell>{formatBRL(row.budget)}</TableCell>
                <TableCell>{formatBRL(row.actual)}</TableCell>
                <TableCell>
                  <Variance value={row.variance} favorable={row.favorable} />
                </TableCell>
                <TableCell>
                  <PercentChip value={row.variancePercent} favorable={row.favorable} />
                </TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Alerts({ rows }: { rows: BudgetVsActualRow[] }) {
  return (
    <aside className="rounded-xl border border-line bg-surface p-lg shadow-sm-warm">
      <h2 className="font-display text-[18px] lowercase text-ink">alertas de desvio</h2>
      <p className="mt-xs text-body-sm text-ink-tertiary">Itens com variação superior a 10%</p>
      <div className="mt-md flex flex-col gap-sm">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-green/40 bg-green-soft px-md py-sm text-body-sm text-green-strong">
            Nenhum desvio crítico neste período.
          </div>
        ) : (
          rows.map((row) => {
            const Icon = row.favorable
              ? TrendingUp
              : row.favorable === false
                ? TrendingDown
                : Target;
            return (
              <div
                key={row.id}
                className={cn(
                  "flex items-center gap-md rounded-lg border px-md py-sm",
                  row.favorable
                    ? "border-green/40 bg-green-soft"
                    : "border-danger/30 bg-danger-soft",
                )}
              >
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                    row.favorable
                      ? "border-green/50 text-green-strong"
                      : "border-danger/30 text-danger",
                  )}
                >
                  <Icon size={16} strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-medium text-ink">
                    {row.code} {row.name}
                  </p>
                  <p className="text-meta text-ink-tertiary">
                    Realizado {formatBRL(row.actual)} · Orçado {formatBRL(row.budget)}
                  </p>
                </div>
                <div className="text-right">
                  <PercentChip value={row.variancePercent} favorable={row.favorable} />
                  <p className="text-meta text-ink-tertiary">{formatBRL(row.variance)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

function TableHead({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "border-b border-line bg-sunken px-md py-sm text-right text-label font-medium uppercase tracking-[0.08em] text-ink-tertiary",
        className,
      )}
    >
      {children}
    </th>
  );
}

function TableCell({ children }: { children: React.ReactNode }) {
  return (
    <td className="tnum border-b border-line px-md py-sm text-right text-body-sm text-ink">
      {children}
    </td>
  );
}

function Variance({ value, favorable }: { value: string; favorable: boolean | null }) {
  return (
    <span
      className={cn(
        favorable == null && "text-ink-tertiary",
        favorable === true && "text-green-strong",
        favorable === false && "text-danger",
      )}
    >
      {Number(value) > 0 ? "+" : ""}
      {formatBRL(value)}
    </span>
  );
}

function PercentChip({ value, favorable }: { value: string | null; favorable: boolean | null }) {
  if (!value) return <span className="text-meta text-ink-tertiary">-</span>;
  const Icon = Number(value) >= 0 ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-end gap-[3px] text-body-sm font-medium",
        favorable == null && "text-ink-tertiary",
        favorable === true && "text-green-strong",
        favorable === false && "text-danger",
      )}
    >
      <Icon size={12} strokeWidth={2.5} />
      {formatPercent(value)}
    </span>
  );
}

function Gauge({ percent, tone }: { percent: number; tone: "success" | "danger" | "beige" }) {
  return (
    <div className="mt-sm h-2 overflow-hidden rounded-full bg-sunken">
      <div
        className={cn(
          "h-full rounded-full",
          tone === "success" && "bg-green",
          tone === "danger" && "bg-danger",
          tone === "beige" && "bg-beige",
        )}
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  );
}

function formatPercent(value: string | null): string {
  if (!value) return "0,0%";
  const number = Number(value);
  return `${number > 0 ? "+" : ""}${number.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonthStart(monthKey: string): string {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const next = new Date(year, month, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
}

function toCsvHref(rows: BudgetVsActualRow[]): string {
  const header = ["Conta", "Orçado", "Realizado", "Variação R$", "Variação %"];
  const body = rows.map((row) => [
    `${row.code} ${row.name}`,
    row.budget,
    row.actual,
    row.variance,
    row.variancePercent ?? "",
  ]);
  const csv = [header, ...body]
    .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";"))
    .join("\n");
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}
