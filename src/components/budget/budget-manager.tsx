"use client";

import { Decimal } from "decimal.js";
import {
  BarChart2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Divide,
  Download,
  GitBranch,
  Layers,
  Percent,
  Plus,
  Save,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";

import { createBudgetVersion, saveBudget } from "@/actions/budget";
import { formatBRL, parseBRL } from "@/lib/money";
import type { Tables } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type BudgetAccount = Pick<
  Tables<"chart_of_accounts">,
  "id" | "parent_id" | "code" | "name" | "nature" | "display_order" | "is_active"
>;
type BudgetValue = Pick<Tables<"budget_values">, "chart_account_id" | "month" | "amount">;
type BudgetVersion = Pick<
  Tables<"budget_versions">,
  "id" | "name" | "status" | "year" | "created_at"
>;

type BudgetManagerProps = {
  accounts: BudgetAccount[];
  values: BudgetValue[];
  versions: BudgetVersion[];
  selectedYear: number;
  selectedVersionId: string | null;
};

type BudgetRow = {
  id: string;
  account: BudgetAccount;
  depth: number;
  hasChildren: boolean;
  isEditable: boolean;
  monthly: Record<number, Decimal>;
  total: Decimal;
};

const MONTHS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

export function BudgetManager({
  accounts,
  values,
  versions,
  selectedYear,
  selectedVersionId,
}: BudgetManagerProps) {
  const router = useRouter();
  const [cellValues, setCellValues] = useState(() => buildInitialCellValues(values));
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [showZero, setShowZero] = useState(true);
  const [batchOpen, setBatchOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [newVersionName, setNewVersionName] = useState(() =>
    buildDefaultVersionName(versions.length),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedVersion = versions.find((version) => version.id === selectedVersionId) ?? null;
  const rows = useMemo(() => buildBudgetRows(accounts, cellValues), [accounts, cellValues]);
  const visibleRows = useMemo(
    () =>
      rows.filter((row) => {
        if (isHiddenByCollapsedParent(row, rows, collapsed)) return false;
        if (showZero || row.hasChildren) return true;
        return !row.total.isZero();
      }),
    [rows, collapsed, showZero],
  );
  const editableRows = rows.filter((row) => row.isEditable);
  const selectedRow = editableRows.find((row) => row.id === selectedAccountId) ?? editableRows[0];
  const incomeTotal = rows
    .filter((row) => row.account.parent_id === null && row.account.code === "1")
    .reduce((sum, row) => sum.plus(row.total), new Decimal(0));
  const expenseTotal = rows
    .filter((row) => row.account.parent_id === null && row.account.code !== "1")
    .reduce((sum, row) => sum.plus(row.total.abs()), new Decimal(0));
  const projectedResult = incomeTotal.minus(expenseTotal);

  function updateCell(accountId: string, month: number, value: string) {
    setCellValues((current) => ({ ...current, [cellKey(accountId, month)]: value }));
    setSelectedAccountId(accountId);
    setMessage(null);
  }

  function normalizeCell(accountId: string, month: number) {
    setCellValues((current) => ({
      ...current,
      [cellKey(accountId, month)]: formatInputValue(
        parseBRL(current[cellKey(accountId, month)] ?? ""),
      ),
    }));
  }

  function toggleGroup(accountId: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  }

  function applyBatch(mode: "replicate" | "distribute" | "increase" | "history") {
    if (!selectedRow) return;
    setCellValues((current) => {
      const next = { ...current };
      if (mode === "replicate") {
        const january = next[cellKey(selectedRow.id, 1)] ?? "";
        for (let month = 2; month <= 12; month++) next[cellKey(selectedRow.id, month)] = january;
      }
      if (mode === "distribute") {
        const total = selectedRow.total.abs().div(12).toFixed(2);
        for (let month = 1; month <= 12; month++)
          next[cellKey(selectedRow.id, month)] = formatInputValue(total);
      }
      if (mode === "increase") {
        for (let month = 1; month <= 12; month++) {
          const key = cellKey(selectedRow.id, month);
          next[key] = formatInputValue(new Decimal(parseBRL(next[key] ?? "")).mul(1.05).toFixed(2));
        }
      }
      if (mode === "history") {
        const base = selectedRow.account.nature === "income" ? "36000.00" : "4200.00";
        for (let month = 1; month <= 12; month++)
          next[cellKey(selectedRow.id, month)] = formatInputValue(base);
      }
      return next;
    });
    setBatchOpen(false);
    setMessage("Valores aplicados na linha selecionada.");
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveBudget({
        year: selectedYear,
        versionId: selectedVersionId,
        values: serializeBudgetValues(editableRows, cellValues),
      });
      setMessage(result.ok ? result.message : result.error);
    });
  }

  function handleCreateVersion() {
    startTransition(async () => {
      const result = await createBudgetVersion({
        year: selectedYear,
        name: newVersionName,
        sourceVersionId: selectedVersionId,
        versionId: selectedVersionId,
        values: serializeBudgetValues(editableRows, cellValues),
      });
      setMessage(result.ok ? result.message : result.error);
      if (result.ok) {
        setNewVersionOpen(false);
        setVersionOpen(false);
        router.push(`/orcamento/editor?year=${selectedYear}&version=${result.versionId}`);
        router.refresh();
      }
    });
  }

  function exportCsv() {
    const header = ["Conta", ...MONTHS, "Total"];
    const lines = visibleRows.map((row) => [
      `${row.account.code} ${row.account.name}`,
      ...MONTHS.map((_, index) => row.monthly[index + 1]?.toFixed(2) ?? "0.00"),
      row.total.toFixed(2),
    ]);
    const csv = [header, ...lines].map((line) => line.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `orcamento-${selectedYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="-m-[32px] flex h-screen flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center gap-md border-b border-line bg-base px-lg">
        <div className="flex flex-1 items-center gap-md">
          <h1 className="font-display text-[22px] lowercase text-ink">orçamento anual</h1>
          <YearSwitcher selectedYear={selectedYear} />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setVersionOpen((open) => !open)}
            className="inline-flex items-center gap-xs rounded-full border border-beige/40 bg-beige-soft px-sm py-xs text-body-sm font-medium text-[#9F7E3D] transition hover:bg-beige/20"
          >
            <GitBranch size={14} strokeWidth={1.5} />
            {selectedVersion
              ? `${selectedVersion.name} (${selectedVersion.status})`
              : "v1 - Janeiro (nova)"}
            <ChevronDown size={14} strokeWidth={1.5} />
          </button>
          {versionOpen ? (
            <div className="absolute right-0 top-full z-50 mt-xs w-72 overflow-hidden rounded-xl border border-line bg-surface shadow-md-warm">
              <p className="border-b border-line px-md py-sm text-label font-medium uppercase text-ink-tertiary">
                Versões do orçamento
              </p>
              {versions.length === 0 ? (
                <p className="px-md py-sm text-body-sm text-ink-secondary">
                  Nenhuma versão salva ainda.
                </p>
              ) : (
                versions.map((version) => (
                  <Link
                    key={version.id}
                    href={`/orcamento/editor?year=${version.year}&version=${version.id}`}
                    className="flex items-center justify-between px-md py-sm text-body-sm transition hover:bg-sunken"
                  >
                    <span
                      className={cn(version.id === selectedVersionId && "font-medium text-ink")}
                    >
                      {version.name}
                    </span>
                    <span className="rounded-full bg-green-soft px-xs py-[2px] text-[10px] font-medium text-green-strong">
                      {version.status}
                    </span>
                  </Link>
                ))
              )}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex h-9 items-center gap-xs rounded-lg border border-line bg-surface px-md text-body-sm text-ink-secondary shadow-sm-warm transition hover:bg-sunken"
        >
          <Download size={16} strokeWidth={1.5} />
          Exportar
        </button>
        <button
          type="button"
          onClick={() => {
            setNewVersionName(buildDefaultVersionName(versions.length));
            setNewVersionOpen(true);
          }}
          className="inline-flex h-9 items-center gap-xs rounded-lg border border-orange px-md text-body-sm font-medium text-orange transition hover:bg-orange-soft"
        >
          <Plus size={16} strokeWidth={1.5} />
          Nova versão
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex h-9 items-center gap-xs rounded-lg bg-orange px-md text-body-sm font-medium text-white transition hover:bg-orange-hover disabled:opacity-60"
        >
          <Save size={16} strokeWidth={1.5} />
          {isPending ? "Salvando" : "Salvar"}
        </button>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-md border-b border-line bg-surface px-lg py-sm">
        <QuickTotal label="Receita Orçada (anual)" value={incomeTotal} tone="success" />
        <Divider />
        <QuickTotal label="Despesas Orçadas (anual)" value={expenseTotal} tone="danger" />
        <Divider />
        <QuickTotal label="Resultado Projetado" value={projectedResult} tone="ink" />
        {message ? <p className="text-body-sm text-ink-secondary">{message}</p> : null}

        <div className="ml-auto flex items-center gap-sm">
          <div className="relative">
            <button
              type="button"
              onClick={() => setBatchOpen((open) => !open)}
              className="inline-flex h-8 items-center gap-xs rounded-lg border border-line bg-sunken px-md text-body-sm text-ink-secondary transition hover:text-ink"
            >
              <Layers size={16} strokeWidth={1.5} />
              Ações em lote
              <ChevronDown size={14} strokeWidth={1.5} />
            </button>
            {batchOpen ? (
              <div className="absolute right-0 top-full z-50 mt-xs w-72 overflow-hidden rounded-lg border border-line bg-surface shadow-[0_8px_24px_rgba(58,53,48,0.12)]">
                <p className="border-b border-line px-md py-sm text-label font-medium uppercase text-ink-tertiary">
                  {selectedRow ? selectedRow.account.name : "Selecione uma conta"}
                </p>
                <BatchButton
                  icon={Copy}
                  title="Replicar para todos os meses"
                  onClick={() => applyBatch("replicate")}
                />
                <BatchButton
                  icon={Divide}
                  title="Distribuir total igualmente"
                  onClick={() => applyBatch("distribute")}
                />
                <BatchButton
                  icon={Percent}
                  title="Aplicar 5% de ajuste"
                  onClick={() => applyBatch("increase")}
                />
                <BatchButton
                  icon={BarChart2}
                  title="Usar média histórica"
                  onClick={() => applyBatch("history")}
                />
              </div>
            ) : null}
          </div>

          <label className="flex cursor-pointer select-none items-center gap-xs text-body-sm text-ink-secondary">
            <span className="relative h-5 w-9">
              <input
                type="checkbox"
                checked={showZero}
                onChange={(event) => setShowZero(event.target.checked)}
                className="peer sr-only"
              />
              <span className="absolute inset-0 rounded-full bg-line transition peer-checked:bg-orange" />
              <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
            </span>
            Mostrar zerados
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="grid min-w-[1600px] grid-cols-[280px_repeat(12,minmax(90px,1fr))_110px]">
          <HeaderCell className="sticky left-0 top-0 z-30 text-left">Conta</HeaderCell>
          {MONTHS.map((month) => (
            <HeaderCell key={month}>{month}</HeaderCell>
          ))}
          <HeaderCell className="bg-green-soft text-green-strong">Total</HeaderCell>

          {visibleRows.map((row) => (
            <BudgetGridRow
              key={row.id}
              row={row}
              collapsed={collapsed.has(row.id)}
              selected={selectedAccountId === row.id}
              onToggle={() => toggleGroup(row.id)}
              onSelect={() => row.isEditable && setSelectedAccountId(row.id)}
              cellValues={cellValues}
              onChange={updateCell}
              onBlur={normalizeCell}
            />
          ))}
        </div>
      </div>

      {newVersionOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-md">
          <div className="w-full max-w-md rounded-2xl bg-surface p-lg shadow-lg-warm">
            <div className="mb-md flex items-center justify-between">
              <h2 className="font-display text-[20px] lowercase text-ink">
                nova versão do orçamento
              </h2>
              <button
                type="button"
                onClick={() => setNewVersionOpen(false)}
                className="text-ink-tertiary transition hover:text-ink"
                aria-label="Fechar"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            <p className="mb-md text-body-sm text-ink-secondary">
              {selectedVersion ? (
                <>
                  A versão atual <strong>{selectedVersion.name}</strong> será arquivada. A nova
                  versão herdará os valores atuais e poderá ser editada independentemente.
                </>
              ) : (
                "A primeira versão será criada com os valores atuais do editor."
              )}
            </p>

            <label
              htmlFor="new-budget-version-name"
              className="mb-xs block text-label font-medium uppercase tracking-[0.08em] text-ink-tertiary"
            >
              Nome da nova versão
            </label>
            <input
              id="new-budget-version-name"
              value={newVersionName}
              onChange={(event) => setNewVersionName(event.target.value)}
              placeholder="ex: v2 - Revisão Junho"
              className="mb-md w-full rounded-lg border border-line bg-surface px-md py-[10px] text-body-sm text-ink transition placeholder:text-ink-tertiary focus:border-orange focus:shadow-focus-orange focus:outline-none"
            />

            <div className="flex gap-sm">
              <button
                type="button"
                onClick={() => setNewVersionOpen(false)}
                className="h-10 flex-1 rounded-lg border border-line text-body-sm text-ink-secondary transition hover:bg-sunken"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateVersion}
                disabled={isPending}
                className="h-10 flex-1 rounded-lg bg-orange text-body-sm font-medium text-white transition hover:bg-orange-hover disabled:opacity-60"
              >
                {isPending ? "Criando" : "Criar versão"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BudgetGridRow({
  row,
  collapsed,
  selected,
  onToggle,
  onSelect,
  cellValues,
  onChange,
  onBlur,
}: {
  row: BudgetRow;
  collapsed: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  cellValues: Record<string, string>;
  onChange: (accountId: string, month: number, value: string) => void;
  onBlur: (accountId: string, month: number) => void;
}) {
  const isRoot = row.depth === 0;
  const labelClass = cn(
    "sticky left-0 z-10 flex h-full items-center gap-xs border-r border-b border-line px-md",
    isRoot
      ? "bg-sunken text-label font-medium uppercase tracking-[0.08em] text-ink-secondary"
      : "bg-surface text-body-sm text-ink",
    selected && "bg-[#FFFBF5] shadow-[inset_3px_0_0_#F08353]",
  );

  return (
    <>
      <div className={labelClass} style={{ paddingLeft: isRoot ? 16 : 16 + row.depth * 14 }}>
        {row.hasChildren ? (
          <button
            type="button"
            onClick={onToggle}
            className="text-ink-tertiary transition hover:text-ink"
          >
            <ChevronDown
              size={14}
              strokeWidth={2}
              className={cn("transition-transform", collapsed && "-rotate-90")}
            />
          </button>
        ) : (
          <span className="w-[14px]" />
        )}
        {isRoot ? (
          <span className={cn("size-2 rounded-full", rootDotClass(row.account.code))} />
        ) : null}
        <button type="button" onClick={onSelect} className="truncate text-left">
          {row.account.code}. {row.account.name}
        </button>
      </div>

      {MONTHS.map((_, index) => {
        const month = index + 1;
        return (
          <div
            key={month}
            className={cn(
              "h-[38px] border-r border-b border-line",
              isRoot || row.hasChildren ? "bg-sunken" : "bg-surface",
              selected && "bg-[#FFFBF5]",
            )}
          >
            {row.isEditable ? (
              <input
                value={cellValues[cellKey(row.id, month)] ?? ""}
                onFocus={onSelect}
                onChange={(event) => onChange(row.id, month, event.target.value)}
                onBlur={() => onBlur(row.id, month)}
                placeholder="0,00"
                className="tnum h-full w-full bg-transparent px-sm text-right text-[13px] text-ink outline-none transition hover:bg-sunken focus:bg-[#FFFBF8] focus:shadow-[inset_0_0_0_2px_#F08353]"
              />
            ) : (
              <p className="tnum flex h-full items-center justify-end px-sm text-[13px] font-medium text-ink">
                {formatGridValue(row.monthly[month] ?? new Decimal(0), row.account.nature)}
              </p>
            )}
          </div>
        );
      })}

      <div className="tnum flex h-[38px] items-center justify-end border-r border-b border-line bg-[#F7FAF4] px-sm text-[13px] font-medium text-ink">
        {formatGridValue(row.total, row.account.nature)}
      </div>
    </>
  );
}

function YearSwitcher({ selectedYear }: { selectedYear: number }) {
  return (
    <div className="flex items-center gap-xs rounded-lg border border-line bg-sunken px-sm py-xs">
      <Link
        href={`/orcamento/editor?year=${selectedYear - 1}`}
        className="text-ink-tertiary transition hover:text-ink"
      >
        <ChevronLeft size={16} strokeWidth={1.5} />
      </Link>
      <span className="min-w-12 text-center text-body-sm font-medium text-ink">{selectedYear}</span>
      <Link
        href={`/orcamento/editor?year=${selectedYear + 1}`}
        className="text-ink-tertiary transition hover:text-ink"
      >
        <ChevronRight size={16} strokeWidth={1.5} />
      </Link>
    </div>
  );
}

function HeaderCell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky top-0 z-20 border-r border-b-2 border-line-strong bg-sunken px-sm py-sm text-right text-label font-medium uppercase tracking-[0.08em] text-ink-tertiary",
        className,
      )}
    >
      {children}
    </div>
  );
}

function QuickTotal({
  label,
  value,
  tone,
}: {
  label: string;
  value: Decimal;
  tone: "success" | "danger" | "ink";
}) {
  return (
    <div>
      <p className="mb-[2px] text-label font-medium uppercase text-ink-tertiary">{label}</p>
      <p
        className={cn(
          "tnum text-body-sm font-medium",
          tone === "success" && "text-green-strong",
          tone === "danger" && "text-danger",
          tone === "ink" && "text-ink",
        )}
      >
        {formatBRL(value.toFixed(2))}
      </p>
    </div>
  );
}

function Divider() {
  return <div className="h-8 w-px bg-line" />;
}

function BatchButton({
  icon: Icon,
  title,
  onClick,
}: {
  icon: typeof Copy;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-sm px-md py-sm text-left text-body-sm text-ink transition hover:bg-sunken"
    >
      <Icon size={16} strokeWidth={1.5} className="text-ink-secondary" />
      <span className="font-medium">{title}</span>
    </button>
  );
}

function buildInitialCellValues(values: BudgetValue[]): Record<string, string> {
  const initial: Record<string, string> = {};
  for (const value of values) {
    initial[cellKey(value.chart_account_id, value.month)] = formatInputValue(String(value.amount));
  }
  return initial;
}

function buildBudgetRows(
  accounts: BudgetAccount[],
  cellValues: Record<string, string>,
): BudgetRow[] {
  const activeAccounts = accounts.filter((account) => account.is_active);
  const childrenByParent = new Map<string | null, BudgetAccount[]>();
  for (const account of activeAccounts) {
    const children = childrenByParent.get(account.parent_id) ?? [];
    children.push(account);
    childrenByParent.set(account.parent_id, children);
  }
  for (const [parentId, children] of childrenByParent.entries()) {
    childrenByParent.set(
      parentId,
      children.sort((a, b) => a.display_order - b.display_order),
    );
  }

  const byId = new Map(activeAccounts.map((account) => [account.id, account]));
  const rows: BudgetRow[] = [];

  function append(account: BudgetAccount, depth: number): BudgetRow {
    const children = childrenByParent.get(account.id) ?? [];
    const childRows = children.map((child) => append(child, depth + 1));
    const hasChildren = childRows.length > 0;
    const isEditable = !hasChildren && account.nature !== "calculated";
    const monthly = Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        if (isEditable) {
          const amount = new Decimal(parseBRL(cellValues[cellKey(account.id, month)] ?? ""));
          const signed = account.nature === "expense" ? amount.negated() : amount;
          return [month, signed];
        }
        return [
          month,
          childRows.reduce((sum, row) => sum.plus(row.monthly[month] ?? 0), new Decimal(0)),
        ];
      }),
    ) as Record<number, Decimal>;
    const total = Object.values(monthly).reduce((sum, value) => sum.plus(value), new Decimal(0));
    const row = { id: account.id, account, depth, hasChildren, isEditable, monthly, total };
    rows.push(row);
    return row;
  }

  for (const root of childrenByParent.get(null) ?? []) {
    if (byId.has(root.id)) append(root, 0);
  }

  return rows.sort((a, b) => {
    const orderA = a.account.code.split(".").map(Number);
    const orderB = b.account.code.split(".").map(Number);
    for (let i = 0; i < Math.max(orderA.length, orderB.length); i++) {
      const diff = (orderA[i] ?? 0) - (orderB[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return a.account.display_order - b.account.display_order;
  });
}

function isHiddenByCollapsedParent(
  row: BudgetRow,
  rows: BudgetRow[],
  collapsed: Set<string>,
): boolean {
  const byId = new Map(rows.map((candidate) => [candidate.id, candidate]));
  let currentId = row.account.parent_id;
  while (currentId) {
    if (collapsed.has(currentId)) return true;
    currentId = byId.get(currentId)?.account.parent_id ?? null;
  }
  return false;
}

function cellKey(accountId: string, month: number): string {
  return `${accountId}:${month}`;
}

function serializeBudgetValues(
  rows: BudgetRow[],
  cellValues: Record<string, string>,
): Array<{ chartAccountId: string; month: number; amount: string }> {
  return rows.flatMap((row) =>
    Array.from({ length: 12 }, (_, index) => ({
      chartAccountId: row.id,
      month: index + 1,
      amount: cellValues[cellKey(row.id, index + 1)] ?? "0",
    })),
  );
}

function buildDefaultVersionName(existingVersions: number): string {
  const month = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date());
  return `v${existingVersions + 1} - Revisão ${capitalize(month)}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatInputValue(value: string): string {
  return new Decimal(value || 0)
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatGridValue(value: Decimal, nature: string): string {
  const display = nature === "expense" || value.isNegative() ? value.abs() : value;
  return formatBRL(display.toFixed(2));
}

function rootDotClass(code: string): string {
  if (code === "1") return "bg-green-strong";
  if (code === "2" || code === "6" || code === "7") return "bg-beige";
  if (code === "8") return "bg-orange";
  return "bg-danger";
}
