"use client";

import { BarChart2, ChevronRight, Download, Table, UnfoldVertical } from "lucide-react";
import { useMemo, useState } from "react";

import { DfcChartLoader } from "@/components/dfc/dfc-chart-loader";
import { Button } from "@/components/ui/button";
import type { DFCResult, DFCRow } from "@/lib/dfc";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

type DFCManagerProps = {
  result: DFCResult;
  verticalResult: DFCResult;
  selectedYear: number;
  selectedMode: DFCPeriodMode;
  availableYears: number[];
};

type ViewMode = "table" | "chart";
export type DFCPeriodMode = "mensal" | "trimestral" | "anual" | "custom";

export function DFCManager({
  result,
  verticalResult,
  selectedYear,
  selectedMode,
  availableYears,
}: DFCManagerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [showVertical, setShowVertical] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const displayResult = showVertical ? verticalResult : result;
  const visibleRows = useMemo(
    () => displayResult.rows.filter((row) => isRowVisible(row, displayResult.rows, expanded)),
    [displayResult, expanded],
  );

  function toggle(rowId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }

  function expandAll() {
    setExpanded(
      new Set(displayResult.rows.filter((row) => row.isCollapsible).map((row) => row.id)),
    );
  }

  function exportCsv() {
    const headers = ["Categoria", ...displayResult.months.map((month) => month.label), "Total"];
    const lines = [
      headers.join(";"),
      ...displayResult.rows.map((row) =>
        [
          row.label,
          ...displayResult.months.map((month) =>
            formatValue(row.values[month.key] ?? "0", showVertical),
          ),
          formatValue(row.total, showVertical),
        ].join(";"),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dfc-${selectedYear}${showVertical ? "-av" : ""}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="-m-[32px] flex flex-col gap-lg">
      <header className="flex flex-wrap items-center gap-md">
        <div className="min-w-[220px] flex-1">
          <h1 className="font-display text-display-2 lowercase text-ink">DFC</h1>
          <p className="mt-xs text-body text-ink-secondary">
            Demonstrativo de Fluxo de Caixa em regime de caixa.
          </p>
        </div>

        <div className="flex rounded-lg bg-sunken p-[3px]">
          {[
            ["mensal", "Mensal"],
            ["trimestral", "Trimestral"],
            ["anual", "Anual"],
            ["custom", "Personalizado"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                window.location.href = `/dfc?year=${selectedYear}&mode=${key}`;
              }}
              className={cn(
                "rounded-md px-md py-[7px] text-body-sm text-ink-tertiary transition",
                key === selectedMode && "bg-surface font-medium text-ink shadow-sm-warm",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          value={selectedYear}
          onChange={(event) => {
            window.location.href = `/dfc?year=${event.target.value}&mode=${selectedMode}`;
          }}
          className="rounded-md border border-line bg-surface px-sm py-[7px] text-body-sm text-ink outline-none focus:border-orange focus:shadow-focus-orange"
        >
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <div className="flex overflow-hidden rounded-md border border-line bg-surface">
          <button
            type="button"
            aria-label="Tabela"
            onClick={() => setViewMode("table")}
            className={cn(
              "flex size-8 items-center justify-center text-ink-tertiary",
              viewMode === "table" && "bg-orange text-white",
            )}
          >
            <Table size={15} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label="Gráfico"
            onClick={() => setViewMode("chart")}
            className={cn(
              "flex size-8 items-center justify-center text-ink-tertiary",
              viewMode === "chart" && "bg-orange text-white",
            )}
          >
            <BarChart2 size={15} strokeWidth={1.5} />
          </button>
        </div>

        <Button type="button" variant="ghost" className="border border-line" onClick={exportCsv}>
          <Download size={14} strokeWidth={1.5} />
          Exportar
        </Button>
      </header>

      <section className="grid gap-md lg:grid-cols-2 xl:grid-cols-5">
        <DfcKpi
          label="Receita Bruta (Ano)"
          value={formatBRL(result.metrics.grossRevenue)}
          tone="success"
        />
        <DfcKpi
          label="Desp. Totais (Ano)"
          value={formatBRL(result.metrics.totalExpenses)}
          tone="danger"
        />
        <DfcKpi
          label="Resultado Líq. (Ano)"
          value={formatBRL(result.metrics.netResult)}
          tone="neutral"
        />
        <DfcKpi
          label="Margem Líquida"
          value={`${Number(result.metrics.netMargin).toLocaleString("pt-BR")} %`}
          tone="beige"
        />
        <DfcKpi
          label="Saldo Atual"
          value={formatBRL(result.metrics.endingBalance)}
          tone="success"
        />
      </section>

      <DfcChartLoader result={result} />

      <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm-warm">
        <div className="flex flex-wrap items-center gap-sm border-b border-line bg-base px-lg py-md">
          <div className="text-body-sm font-medium text-ink">Competência {selectedYear}</div>
          <div className="ml-auto flex flex-wrap items-center gap-sm">
            <label className="flex items-center gap-xs text-body-sm text-ink-secondary">
              <input
                type="checkbox"
                checked={showVertical}
                onChange={(event) => setShowVertical(event.target.checked)}
                className="size-4 accent-orange"
              />
              AV%
            </label>
            <Button
              type="button"
              variant="ghost"
              className="border border-line"
              onClick={expandAll}
            >
              <UnfoldVertical size={13} strokeWidth={1.5} />
              Expandir tudo
            </Button>
          </div>
        </div>

        {viewMode === "chart" ? (
          <div className="p-lg">
            <DfcChartLoader result={result} expanded />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="min-w-[280px] rounded-tl-lg border-b border-line bg-sunken px-lg py-sm text-left text-label font-medium uppercase text-ink-tertiary">
                    Categoria
                  </th>
                  {displayResult.months.map((month) => (
                    <th
                      key={month.key}
                      className="min-w-[100px] border-b border-line bg-sunken px-md py-sm text-right text-label font-medium uppercase text-ink-tertiary"
                    >
                      {month.label}
                    </th>
                  ))}
                  <th className="min-w-[110px] rounded-tr-lg border-b border-line bg-sunken px-md py-sm text-right text-label font-medium uppercase text-ink-tertiary">
                    Total Ano
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <DfcTableRow
                    key={row.id}
                    row={row}
                    months={displayResult.months}
                    expanded={expanded.has(row.id)}
                    showVertical={showVertical}
                    onToggle={() => toggle(row.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function DfcKpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "danger" | "neutral" | "beige";
}) {
  const border = {
    success: "border-t-green text-success",
    danger: "border-t-danger text-danger",
    neutral: "border-t-orange text-ink",
    beige: "border-t-beige text-ink",
  }[tone];

  return (
    <article
      className={cn(
        "rounded-xl border border-line border-t-[3px] bg-surface px-lg py-md shadow-sm-warm",
        border,
      )}
    >
      <div className="mb-xs text-label font-medium uppercase text-ink-tertiary">{label}</div>
      <div className="tnum font-display text-h2 leading-tight">{value}</div>
    </article>
  );
}

function DfcTableRow({
  row,
  months,
  expanded,
  showVertical,
  onToggle,
}: {
  row: DFCRow;
  months: DFCResult["months"];
  expanded: boolean;
  showVertical: boolean;
  onToggle: () => void;
}) {
  const isTotal = row.kind === "total";
  const isBalance = row.kind === "balance";
  const isCalculated = row.kind === "calculated";
  const isGroup = row.kind === "group";
  const negative = Number(row.total) < 0;

  return (
    <tr
      className={cn(
        isGroup && "bg-[#F7F5F2] hover:bg-[#ECEAE5]",
        row.kind === "subgroup" && "bg-base hover:bg-sunken",
        row.kind === "account" && "hover:bg-base",
        isCalculated && "bg-sunken",
        isTotal && "bg-ink text-white",
        isBalance && "bg-[#2E2822] text-[#EAD7AC]",
      )}
    >
      <td
        className={cn(
          "border-b border-line px-md py-sm text-body-sm",
          row.kind === "account" && "border-[#F5F4F0]",
          isGroup && "text-label font-semibold uppercase tracking-wider text-ink",
          row.kind === "subgroup" && "font-medium text-ink-secondary",
          isCalculated && "font-semibold text-ink",
          (isTotal || isBalance) && "border-transparent font-semibold",
        )}
        style={{ paddingLeft: row.kind === "account" ? 52 : row.kind === "subgroup" ? 34 : 18 }}
      >
        <button
          type="button"
          onClick={row.isCollapsible ? onToggle : undefined}
          className={cn(
            "flex items-center gap-sm text-left",
            row.isCollapsible && "cursor-pointer",
          )}
        >
          {row.isCollapsible ? (
            <ChevronRight
              size={14}
              strokeWidth={2}
              className={cn("text-ink-tertiary transition-transform", expanded && "rotate-90")}
            />
          ) : (
            <span className="w-[14px]" />
          )}
          {row.color ? (
            <span className="font-bold" style={{ color: row.color }}>
              ▌
            </span>
          ) : null}
          <span>{row.label}</span>
        </button>
      </td>
      {months.map((month) => (
        <td
          key={month.key}
          className={cn(
            "tnum border-b border-line px-md py-sm text-right text-body-sm",
            negative ? "text-danger" : "text-ink",
            (isCalculated || isGroup) && "font-semibold",
            isTotal && "border-transparent text-white",
            isBalance && "border-transparent text-[#EAD7AC]",
          )}
        >
          {formatValue(row.values[month.key] ?? "0", showVertical)}
        </td>
      ))}
      <td
        className={cn(
          "tnum border-b border-line px-md py-sm text-right text-body-sm font-semibold",
          negative ? "text-danger" : "text-success",
          isTotal && "border-transparent text-green",
          isBalance && "border-transparent text-tangerine",
        )}
      >
        {formatValue(row.total, showVertical)}
      </td>
    </tr>
  );
}

function formatValue(value: string | number, vertical: boolean): string {
  if (vertical) {
    return `${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  }
  const numeric = Number(value);
  if (numeric === 0) {
    return "—";
  }
  return numeric < 0 ? `-${formatBRL(Math.abs(numeric))}` : formatBRL(numeric);
}

function isRowVisible(row: DFCRow, rows: DFCRow[], expanded: Set<string>): boolean {
  if (!row.parentId) {
    return true;
  }

  const byId = new Map(rows.map((item) => [item.id, item]));
  let current: DFCRow | undefined = row;
  while (current?.parentId) {
    if (!expanded.has(current.parentId)) {
      return false;
    }
    current = byId.get(current.parentId);
  }
  return true;
}
