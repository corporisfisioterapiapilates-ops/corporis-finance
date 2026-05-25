"use client";

import { AlertTriangle, CalendarClock, Download, ShieldCheck, TrendingUp } from "lucide-react";
import type * as React from "react";
import { useMemo, useState } from "react";

import { ProjectionBalanceChartLoader } from "@/components/projection/projection-balance-chart-loader";
import type { ProjectionScenario, ProjectionSummary } from "@/lib/dfc/projection";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

type ProjectionManagerProps = {
  projections: Record<ProjectionScenario, ProjectionSummary>;
};

const SCENARIOS: Array<{ id: ProjectionScenario; label: string }> = [
  { id: "conservative", label: "Conservador" },
  { id: "realistic", label: "Realista" },
  { id: "optimistic", label: "Otimista" },
];

export function ProjectionManager({ projections }: ProjectionManagerProps) {
  const [scenario, setScenario] = useState<ProjectionScenario>("realistic");
  const projection = projections[scenario];
  const balance30 = Number(projection.balance30);
  const balance60 = Number(projection.balance60);
  const balance90 = Number(projection.balance90);
  const currentBalance = Number(projection.currentBalance);
  const minBalance = Number(projection.minProjectedBalance);
  const minimumBalance = Number(projection.minimumBalance);
  const visibleDays = projection.days.slice(0, 30);

  const csvHref = useMemo(() => {
    const header = ["Data", "Entradas", "Saídas", "Saldo"];
    const rows = projection.days.map((day) => [day.date, day.income, day.expense, day.balance]);
    return `data:text/csv;charset=utf-8,${encodeURIComponent(
      [header, ...rows].map((row) => row.join(";")).join("\n"),
    )}`;
  }, [projection.days]);

  return (
    <div className="-m-[32px] flex flex-col">
      <header className="flex h-16 shrink-0 items-center gap-md border-b border-line bg-base px-lg">
        <h1 className="font-display text-[22px] lowercase text-ink">projeção de caixa</h1>
        <div className="ml-auto flex items-center gap-sm">
          <div className="flex rounded-lg bg-sunken p-1">
            {SCENARIOS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setScenario(item.id)}
                className={cn(
                  "h-8 rounded-md px-md text-body-sm transition",
                  scenario === item.id
                    ? "bg-surface font-medium text-ink shadow-sm-warm"
                    : "text-ink-tertiary hover:text-ink",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <a
            href={csvHref}
            download={`projecao-caixa-${scenario}.csv`}
            className="inline-flex h-9 items-center gap-xs rounded-lg border border-line bg-surface px-md text-body-sm text-ink-secondary shadow-sm-warm transition hover:bg-sunken"
          >
            <Download size={15} strokeWidth={1.5} />
            Exportar
          </a>
        </div>
      </header>

      <main className="flex flex-col gap-lg p-lg">
        <section className="grid gap-md lg:grid-cols-4">
          <KpiCard
            label="Saldo hoje"
            value={currentBalance}
            helper="Base para a projeção"
            tone="orange"
          />
          <KpiCard
            label="Saldo em 30 dias"
            value={balance30}
            helper={deltaLabel(balance30, currentBalance)}
            tone={balance30 >= currentBalance ? "success" : "danger"}
          />
          <KpiCard
            label="Saldo em 60 dias"
            value={balance60}
            helper={deltaLabel(balance60, currentBalance)}
            tone={balance60 >= currentBalance ? "success" : "danger"}
          />
          <KpiCard
            label="Saldo em 90 dias"
            value={balance90}
            helper={deltaLabel(balance90, currentBalance)}
            tone={balance90 >= currentBalance ? "success" : "danger"}
          />
        </section>

        <section className="grid gap-lg xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-xl border border-line bg-surface p-lg shadow-sm-warm">
            <div className="mb-lg flex items-start justify-between gap-md">
              <div>
                <h2 className="font-display text-[18px] lowercase text-ink">projeção de saldo</h2>
                <p className="mt-xs text-body-sm text-ink-tertiary">
                  Realizado recente + próximos 90 dias no cenário {scenarioLabel(scenario)}
                </p>
              </div>
              <div className="rounded-md bg-sunken px-sm py-xs text-meta text-ink-tertiary">
                Saldo mínimo: {formatBRL(minimumBalance)}
              </div>
            </div>
            <ProjectionBalanceChartLoader
              chart={projection.chart}
              minimumBalance={minimumBalance}
            />
          </div>

          <aside className="flex flex-col gap-md">
            <div className="rounded-xl border border-line bg-surface p-lg shadow-sm-warm">
              <h2 className="font-display text-[17px] lowercase text-ink">próximos compromissos</h2>
              <div className="mt-md flex flex-col">
                {projection.upcoming.length > 0 ? (
                  projection.upcoming.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-sm border-b border-line/70 py-sm last:border-b-0"
                    >
                      <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-orange-soft text-orange">
                        <span className="text-body-sm font-bold leading-none">{item.day}</span>
                        <span className="text-[9px] uppercase leading-none">{item.month}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-sm font-medium text-ink">{item.title}</p>
                        <p className="text-meta text-ink-tertiary">
                          {item.type === "income" ? "Entrada prevista" : "Saída prevista"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "tnum shrink-0 text-body-sm font-medium",
                          item.type === "income" ? "text-green-strong" : "text-danger",
                        )}
                      >
                        {item.type === "income" ? "+" : "-"}
                        {formatBRL(item.amount)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg bg-sunken px-md py-sm text-body-sm text-ink-tertiary">
                    Nenhum lançamento pendente nos próximos 90 dias.
                  </p>
                )}
              </div>
            </div>

            <AlertCard
              tone={
                projection.risk === "high"
                  ? "danger"
                  : projection.risk === "medium"
                    ? "warning"
                    : "success"
              }
              title={projection.risk === "high" ? "Risco de saldo negativo" : "Caixa monitorado"}
            >
              O menor saldo projetado é {formatBRL(minBalance)} em{" "}
              {formatDateLabel(projection.minProjectedDate)}.
            </AlertCard>
            <AlertCard tone="warning" title="Média histórica gradual">
              Lançamentos pendentes pesam primeiro; médias dos últimos 90 dias entram após 30 dias.
            </AlertCard>
          </aside>
        </section>

        <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm-warm">
          <div className="border-b border-line bg-base px-lg py-md">
            <h2 className="font-display text-[18px] lowercase text-ink">fluxo diário projetado</h2>
            <p className="mt-xs text-body-sm text-ink-tertiary">
              Primeiros 30 dias do cenário {scenarioLabel(scenario)}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <TableHead className="text-left">Data</TableHead>
                  <TableHead>Entradas</TableHead>
                  <TableHead>Saídas</TableHead>
                  <TableHead>Estimado</TableHead>
                  <TableHead>Saldo</TableHead>
                </tr>
              </thead>
              <tbody>
                {visibleDays.map((day) => (
                  <tr key={day.date} className="hover:bg-base">
                    <td className="border-b border-line px-md py-sm text-body-sm font-medium text-ink">
                      {day.label}
                    </td>
                    <TableCell tone="success">{formatBRL(day.income)}</TableCell>
                    <TableCell tone="danger">{formatBRL(day.expense)}</TableCell>
                    <TableCell>
                      {Number(day.estimatedIncome) + Number(day.estimatedExpense) > 0
                        ? formatBRL(Number(day.estimatedIncome) + Number(day.estimatedExpense))
                        : "-"}
                    </TableCell>
                    <TableCell className="font-medium text-ink">{formatBRL(day.balance)}</TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function KpiCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: number;
  helper: string;
  tone: "orange" | "success" | "danger" | "warning";
}) {
  return (
    <article
      className={cn(
        "rounded-xl border border-line border-t-[3px] bg-surface p-lg shadow-sm-warm",
        tone === "orange" && "border-t-orange",
        tone === "success" && "border-t-green",
        tone === "danger" && "border-t-danger",
        tone === "warning" && "border-t-beige",
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
          tone === "warning" && "text-ink",
          tone === "orange" && "text-ink",
        )}
      >
        {formatBRL(value)}
      </p>
      <p className="mt-xs flex items-center gap-xs text-body-sm text-ink-tertiary">
        <TrendingUp size={12} strokeWidth={1.5} />
        {helper}
      </p>
    </article>
  );
}

function AlertCard({
  tone,
  title,
  children,
}: {
  tone: "success" | "warning" | "danger";
  title: string;
  children: React.ReactNode;
}) {
  const Icon =
    tone === "success" ? ShieldCheck : tone === "warning" ? CalendarClock : AlertTriangle;
  return (
    <div
      className={cn(
        "flex gap-sm rounded-xl border p-md",
        tone === "success" && "border-green/40 bg-green-soft",
        tone === "warning" && "border-beige/60 bg-warning-soft",
        tone === "danger" && "border-danger/30 bg-danger-soft",
      )}
    >
      <Icon
        size={16}
        strokeWidth={1.5}
        className={cn(
          "mt-[2px] shrink-0",
          tone === "success" && "text-green-strong",
          tone === "warning" && "text-[#9F7E3D]",
          tone === "danger" && "text-danger",
        )}
      />
      <div>
        <p className="text-body-sm font-medium text-ink">{title}</p>
        <p className="mt-xs text-body-sm leading-relaxed text-ink-secondary">{children}</p>
      </div>
    </div>
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

function TableCell({
  children,
  tone,
  className,
}: {
  children: React.ReactNode;
  tone?: "success" | "danger";
  className?: string;
}) {
  return (
    <td
      className={cn(
        "tnum border-b border-line px-md py-sm text-right text-body-sm text-ink-secondary",
        tone === "success" && "text-green-strong",
        tone === "danger" && "text-danger",
        className,
      )}
    >
      {children}
    </td>
  );
}

function deltaLabel(value: number, current: number): string {
  const delta = value - current;
  const sign = delta >= 0 ? "+" : "-";
  return `${sign}${formatBRL(Math.abs(delta))} contra hoje`;
}

function scenarioLabel(scenario: ProjectionScenario): string {
  if (scenario === "conservative") return "conservador";
  if (scenario === "optimistic") return "otimista";
  return "realista";
}

function formatDateLabel(isoDate: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  })
    .format(new Date(`${isoDate}T12:00:00`))
    .replace(".", "");
}
