import {
  ArrowDownCircle,
  ArrowRight,
  ArrowUpCircle,
  BarChart2,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Landmark,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { DashboardChartsLoader } from "@/components/dashboard/dashboard-charts-loader";
import { Badge } from "@/components/ui/badge";
import { calculateDashboardSummary, type DashboardSummary } from "@/lib/dashboard/calculate";
import { formatDate } from "@/lib/date";
import { formatBRL } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type DashboardPageProps = {
  searchParams?: Promise<{ month?: string | string[] }>;
};

type Account = Tables<"accounts">;
type Category = Tables<"chart_of_accounts">;

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const selectedMonth = Array.isArray(params?.month) ? params?.month[0] : params?.month;
  const supabase = await createClient();
  const [
    { data: accounts, error: accountsError },
    { data: transactions, error: transactionsError },
    { data: categories, error: categoriesError },
  ] = await Promise.all([
    supabase.from("accounts").select("*").order("created_at", { ascending: true }),
    supabase.from("transactions").select("*").order("cash_date", { ascending: false }),
    supabase.from("chart_of_accounts").select("*").order("display_order", { ascending: true }),
  ]);

  const loadError = accountsError || transactionsError || categoriesError;
  const summary = calculateDashboardSummary({
    accounts: accounts ?? [],
    transactions: transactions ?? [],
    categories: categories ?? [],
    selectedMonth: selectedMonth ?? "",
  });

  return (
    <div className="-m-[32px] flex flex-col gap-lg">
      <PeriodSelector summary={summary} />

      {loadError ? (
        <div className="rounded-lg border border-danger/30 bg-danger-soft px-md py-sm text-body-sm text-danger">
          Não foi possível carregar o dashboard agora. Tente novamente em instantes.
        </div>
      ) : null}

      <section className="grid gap-md md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Saldo Total"
          value={formatBRL(summary.kpis.totalBalance.value)}
          delta={summary.kpis.totalBalance.delta}
          previousLabel={summary.period.previousMonthLabel}
          tone="orange"
          icon={Landmark}
        />
        <KpiCard
          label="Entradas do Mês"
          value={formatBRL(summary.kpis.income.value)}
          delta={summary.kpis.income.delta}
          previousLabel={summary.period.previousMonthLabel}
          tone="success"
          icon={ArrowDownCircle}
        />
        <KpiCard
          label="Saídas do Mês"
          value={`-${formatBRL(summary.kpis.expense.value)}`}
          delta={summary.kpis.expense.delta}
          previousLabel={summary.period.previousMonthLabel}
          tone="danger"
          icon={ArrowUpCircle}
          deltaDangerWhenPositive
        />
        <KpiCard
          label="Resultado do Mês"
          value={formatBRL(summary.kpis.result.value)}
          delta={summary.kpis.result.delta}
          previousLabel={summary.period.previousMonthLabel}
          tone="beige"
          icon={BarChart2}
        />
      </section>

      <DashboardChartsLoader
        monthlyFlow={summary.monthlyFlow}
        balanceEvolution={summary.balanceEvolution}
        expensesByGroup={summary.expensesByGroup}
        periodLabel={summary.period.label}
      />

      <section className="grid gap-md xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_340px]">
        <LatestTransactions
          transactions={summary.latestTransactions}
          accounts={accounts ?? []}
          categories={categories ?? []}
        />
        <UpcomingList summary={summary} />
        <AccountsList summary={summary} />
      </section>
    </div>
  );
}

function PeriodSelector({ summary }: { summary: DashboardSummary }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-md">
      <div>
        <p className="text-body-sm text-ink-tertiary">Período atual</p>
        <p className="mt-xs text-body font-medium text-ink">{summary.period.label}</p>
      </div>
      <div className="flex flex-wrap items-center gap-sm">
        <IconLink href={summary.period.previousMonthHref} label="Mês anterior">
          <ChevronLeft size={14} strokeWidth={2} />
        </IconLink>
        <div className="rounded-md border border-line bg-surface px-md py-[7px] text-body-sm font-medium text-ink shadow-sm-warm">
          {summary.period.shortLabel}
        </div>
        <IconLink href={summary.period.nextMonthHref} label="Próximo mês">
          <ChevronRight size={14} strokeWidth={2} />
        </IconLink>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-xs rounded-md border border-line bg-surface px-md py-[7px] text-body-sm text-orange transition hover:bg-sunken"
        >
          <Calendar size={14} strokeWidth={1.5} />
          Mês atual
        </Link>
      </div>
    </div>
  );
}

function IconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex size-8 items-center justify-center rounded-md border border-line bg-surface text-ink-secondary transition hover:bg-sunken"
    >
      {children}
    </Link>
  );
}

function KpiCard({
  label,
  value,
  delta,
  previousLabel,
  tone,
  icon: Icon,
  deltaDangerWhenPositive = false,
}: {
  label: string;
  value: string;
  delta: number | null;
  previousLabel: string;
  tone: "orange" | "success" | "danger" | "beige";
  icon: typeof Landmark;
  deltaDangerWhenPositive?: boolean;
}) {
  const toneClass = {
    orange: "border-t-orange text-orange bg-orange-soft",
    success: "border-t-green text-success bg-success-soft",
    danger: "border-t-danger text-danger bg-danger-soft",
    beige: "border-t-beige text-[#B8914E] bg-beige-soft",
  }[tone];
  const [borderClass, iconTextClass, iconBgClass] = toneClass.split(" ");
  const deltaTone =
    delta == null || delta === 0
      ? "text-ink-tertiary"
      : deltaDangerWhenPositive && delta > 0
        ? "text-danger"
        : delta > 0
          ? "text-success"
          : "text-danger";

  return (
    <article
      className={cn(
        "rounded-xl border border-line border-t-[3px] bg-surface p-lg shadow-sm-warm",
        borderClass,
      )}
    >
      <div className="mb-md flex items-center justify-between gap-md">
        <p className="text-label font-medium uppercase text-ink-tertiary">{label}</p>
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-lg",
            iconBgClass,
            iconTextClass,
          )}
        >
          <Icon size={16} strokeWidth={1.5} />
        </div>
      </div>
      <p
        className={cn(
          "tnum font-display text-[28px] leading-none min-[1400px]:text-[30px]",
          tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-ink",
        )}
      >
        {value}
      </p>
      <div className="mt-sm flex items-center gap-xs">
        <span className={cn("text-body-sm font-medium", deltaTone)}>
          {delta == null ? "sem base" : `${delta > 0 ? "+" : ""}${delta.toLocaleString("pt-BR")}%`}
        </span>
        <span className="text-body-sm text-ink-tertiary">vs. {previousLabel}</span>
      </div>
    </article>
  );
}

function LatestTransactions({
  transactions,
  accounts,
  categories,
}: {
  transactions: DashboardSummary["latestTransactions"];
  accounts: Account[];
  categories: Category[];
}) {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return (
    <section className="rounded-xl border border-line bg-surface p-lg shadow-sm-warm">
      <div className="mb-md flex items-center justify-between gap-md">
        <h2 className="font-display text-h3 lowercase text-ink">últimos lançamentos</h2>
        <Link href="/lancamentos" className="flex items-center gap-xs text-meta text-orange">
          Ver todos
          <ArrowRight size={12} strokeWidth={2} />
        </Link>
      </div>
      <div>
        {transactions.length > 0 ? (
          transactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              account={accountById.get(transaction.account_id)}
              category={
                transaction.category_id ? categoryById.get(transaction.category_id) : undefined
              }
            />
          ))
        ) : (
          <EmptyState>Nenhum lançamento registrado ainda.</EmptyState>
        )}
      </div>
    </section>
  );
}

function TransactionRow({
  transaction,
  account,
  category,
}: {
  transaction: DashboardSummary["latestTransactions"][number];
  account?: Account;
  category?: Category;
}) {
  const isIncome = transaction.type === "income";
  const isExpense = transaction.type === "expense";
  const amount = `${isIncome ? "+" : isExpense ? "-" : ""}${formatBRL(transaction.amount)}`;

  return (
    <div className="flex items-center gap-md border-b border-line py-md last:border-b-0">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          isIncome
            ? "bg-success-soft text-success"
            : isExpense
              ? "bg-danger-soft text-danger"
              : "bg-sunken text-ink-secondary",
        )}
      >
        {isIncome ? (
          <ArrowDownCircle size={16} strokeWidth={1.5} />
        ) : isExpense ? (
          <ArrowUpCircle size={16} strokeWidth={1.5} />
        ) : (
          <Wallet size={16} strokeWidth={1.5} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-sm font-medium text-ink">{transaction.description}</p>
        <div className="mt-xs flex flex-wrap items-center gap-sm">
          {category ? (
            <Badge variant={isIncome ? "success" : "danger"} className="py-[3px] text-[10px]">
              {category.name}
            </Badge>
          ) : null}
          <span className="text-meta text-ink-tertiary">
            {account?.name ?? "Conta"} · {formatDate(transaction.cash_date, "dd/MM")}
          </span>
        </div>
      </div>
      <span
        className={cn(
          "tnum shrink-0 text-body font-medium",
          isIncome ? "text-success" : isExpense ? "text-danger" : "text-ink-secondary",
        )}
      >
        {amount}
      </span>
    </div>
  );
}

function UpcomingList({ summary }: { summary: DashboardSummary }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-lg shadow-sm-warm">
      <div className="mb-md flex items-center justify-between gap-md">
        <h2 className="font-display text-h3 lowercase text-ink">próximos vencimentos</h2>
        <Badge variant="warning">{summary.upcoming.length} pendentes</Badge>
      </div>
      {summary.upcoming.length > 0 ? (
        summary.upcoming.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-md border-b border-line py-md last:border-b-0"
          >
            <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-orange-soft text-orange">
              <span className="text-body font-bold leading-none">{item.day}</span>
              <span className="text-[9px] uppercase tracking-wider">{item.month}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-body-sm font-medium text-ink">{item.title}</p>
              <p className="mt-xs truncate text-meta text-ink-tertiary">
                {item.subtitle || "Lançamento pendente"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="tnum text-body-sm font-medium text-danger">{formatBRL(item.amount)}</p>
              <Badge variant={item.daysUntil <= 10 ? "warning" : "neutral"} className="mt-xs">
                {item.daysUntil === 0 ? "hoje" : `${item.daysUntil} dias`}
              </Badge>
            </div>
          </div>
        ))
      ) : (
        <EmptyState>Nenhum vencimento pendente no horizonte.</EmptyState>
      )}
    </section>
  );
}

function AccountsList({ summary }: { summary: DashboardSummary }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-lg shadow-sm-warm">
      <div className="mb-md flex items-center justify-between gap-md">
        <h2 className="font-display text-h3 lowercase text-ink">contas e cartões</h2>
        <Link href="/contas" className="flex items-center gap-xs text-meta text-orange">
          Gerenciar
          <ArrowRight size={12} strokeWidth={2} />
        </Link>
      </div>
      <div className="flex flex-col gap-sm">
        {summary.accounts.length > 0 ? (
          summary.accounts.map((account) => <AccountMiniCard key={account.id} account={account} />)
        ) : (
          <EmptyState>Nenhuma conta ativa cadastrada.</EmptyState>
        )}
      </div>
    </section>
  );
}

function AccountMiniCard({ account }: { account: DashboardSummary["accounts"][number] }) {
  const isCreditCard = account.type === "credit_card";
  const balance = Number(account.balance);
  return (
    <article
      className={cn(
        "flex items-center gap-md rounded-lg border border-line bg-surface p-md shadow-sm-warm",
        isCreditCard && "border-danger/20",
      )}
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          isCreditCard ? "bg-danger-soft text-danger" : "bg-beige-soft text-[#B8914E]",
        )}
      >
        {isCreditCard ? (
          <CreditCard size={18} strokeWidth={1.5} />
        ) : (
          <Building2 size={18} strokeWidth={1.5} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-sm font-medium text-ink">{account.name}</p>
        <p className="mt-xs truncate text-meta text-ink-tertiary">
          {isCreditCard
            ? `Fatura · vence dia ${account.dueDay ?? "—"}`
            : accountTypeLabel(account.type)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={cn(
            "tnum text-body-sm font-medium",
            isCreditCard || balance < 0 ? "text-danger" : "text-success",
          )}
        >
          {formatBRL(account.balance)}
        </p>
        {isCreditCard ? (
          <p className="mt-xs text-[10px] text-ink-tertiary">
            lim. {formatBRL(account.creditLimit ?? 0)}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[120px] items-center justify-center rounded-lg bg-base px-md text-center text-body-sm text-ink-tertiary">
      {children}
    </div>
  );
}

function accountTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    checking: "Conta Corrente",
    savings: "Poupança",
    cash: "Caixa Físico",
    credit_card: "Cartão de Crédito",
  };
  return labels[type] ?? "Conta";
}
