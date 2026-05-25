import { addMonths, format, startOfMonth } from "date-fns";
import { Decimal } from "decimal.js";

export type BudgetActualAccount = {
  id: string;
  parent_id: string | null;
  code: string;
  name: string;
  nature: string;
  display_order: number;
  is_active?: boolean;
};

export type BudgetActualValue = {
  chart_account_id: string;
  month: number;
  amount: number | string;
};

export type BudgetActualTransaction = {
  category_id: string | null;
  amount: number | string;
  cash_date: string;
  status: string;
  type: string;
};

export type BudgetVsActualRow = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  depth: number;
  nature: string;
  hasChildren: boolean;
  budget: string;
  actual: string;
  variance: string;
  variancePercent: string | null;
  favorable: boolean | null;
};

export type BudgetVsActualSummary = {
  monthKey: string;
  monthLabel: string;
  previousHref: string;
  nextHref: string;
  income: BudgetVsActualKpi;
  expenses: BudgetVsActualKpi;
  result: BudgetVsActualKpi;
  adherencePercent: number;
  alertRows: BudgetVsActualRow[];
  rows: BudgetVsActualRow[];
};

export type BudgetVsActualKpi = {
  budget: string;
  actual: string;
  variance: string;
  variancePercent: string | null;
  favorable: boolean | null;
};

export function calculateBudgetVsActual({
  accounts,
  budgetValues,
  transactions,
  monthKey,
}: {
  accounts: BudgetActualAccount[];
  budgetValues: BudgetActualValue[];
  transactions: BudgetActualTransaction[];
  monthKey: string;
}): BudgetVsActualSummary {
  const activeAccounts = accounts.filter((account) => account.is_active !== false);
  const monthNumber = Number(monthKey.slice(5, 7));
  const valuesByAccount = new Map<string, Decimal>();
  const actualByAccount = new Map<string, Decimal>();
  const byId = new Map(activeAccounts.map((account) => [account.id, account]));
  const childrenByParent = buildChildrenMap(activeAccounts);

  for (const value of budgetValues) {
    if (value.month !== monthNumber) continue;
    valuesByAccount.set(
      value.chart_account_id,
      (valuesByAccount.get(value.chart_account_id) ?? new Decimal(0)).plus(value.amount),
    );
  }

  for (const transaction of transactions) {
    if (
      transaction.status !== "cleared" ||
      transaction.cash_date.slice(0, 7) !== monthKey ||
      transaction.type === "transfer" ||
      !transaction.category_id
    ) {
      continue;
    }

    const sign = transaction.type === "income" ? 1 : transaction.type === "expense" ? -1 : 0;
    if (sign === 0) continue;

    let current = byId.get(transaction.category_id);
    while (current) {
      actualByAccount.set(
        current.id,
        (actualByAccount.get(current.id) ?? new Decimal(0)).plus(
          new Decimal(transaction.amount).mul(sign),
        ),
      );
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }
  }

  const rows: BudgetVsActualRow[] = [];

  function append(account: BudgetActualAccount, depth: number): DecimalPair {
    const children = childrenByParent.get(account.id) ?? [];
    const rowIndex = rows.length;
    const childPairs = children.map((child) => append(child, depth + 1));
    const hasChildren = children.length > 0;
    const ownBudget = signedAmount(valuesByAccount.get(account.id) ?? 0, account.nature);
    const ownActual = actualByAccount.get(account.id) ?? new Decimal(0);
    const totals = hasChildren
      ? childPairs.reduce(
          (sum, pair) => ({
            budget: sum.budget.plus(pair.budget),
            actual: sum.actual.plus(pair.actual),
          }),
          { budget: new Decimal(0), actual: new Decimal(0) },
        )
      : { budget: ownBudget, actual: ownActual };

    rows.splice(rowIndex, 0, makeRow(account, depth, hasChildren, totals.budget, totals.actual));
    return totals;
  }

  for (const root of childrenByParent.get(null) ?? []) {
    append(root, 0);
  }

  const incomeTotals = sumRows(rows, (row) => row.depth === 0 && row.code === "1");
  const expenseTotals = sumRows(rows, (row) => row.depth === 0 && row.code !== "1");
  const resultBudget = incomeTotals.budget.minus(expenseTotals.budget.abs());
  const resultActual = incomeTotals.actual.minus(expenseTotals.actual.abs());
  const comparableRows = rows.filter((row) => new Decimal(row.budget).abs().gt(0));
  const adherentRows = comparableRows.filter((row) => {
    const percent = row.variancePercent ? Math.abs(Number(row.variancePercent)) : 0;
    return percent <= 10;
  });

  return {
    monthKey,
    monthLabel: formatMonth(monthKey),
    previousHref: `/orcamento?month=${shiftMonth(monthKey, -1)}`,
    nextHref: `/orcamento?month=${shiftMonth(monthKey, 1)}`,
    income: makeKpi(incomeTotals.budget, incomeTotals.actual, "income"),
    expenses: makeKpi(expenseTotals.budget.abs(), expenseTotals.actual.abs(), "expense"),
    result: makeKpi(resultBudget, resultActual, "result"),
    adherencePercent:
      comparableRows.length === 0
        ? 100
        : Math.round((adherentRows.length / comparableRows.length) * 100),
    alertRows: rows
      .filter((row) => row.variancePercent && Math.abs(Number(row.variancePercent)) > 10)
      .sort((left, right) => Math.abs(Number(right.variance)) - Math.abs(Number(left.variance)))
      .slice(0, 4),
    rows,
  };
}

type DecimalPair = { budget: Decimal; actual: Decimal };

function buildChildrenMap(
  accounts: BudgetActualAccount[],
): Map<string | null, BudgetActualAccount[]> {
  const map = new Map<string | null, BudgetActualAccount[]>();
  for (const account of accounts) {
    const children = map.get(account.parent_id) ?? [];
    children.push(account);
    map.set(account.parent_id, children);
  }
  for (const [parentId, children] of map.entries()) {
    map.set(
      parentId,
      children.sort((left, right) => {
        const byOrder = left.display_order - right.display_order;
        return byOrder === 0
          ? left.code.localeCompare(right.code, "pt-BR", { numeric: true })
          : byOrder;
      }),
    );
  }
  return map;
}

function signedAmount(value: Decimal.Value, nature: string): Decimal {
  const amount = new Decimal(value);
  return nature === "expense" ? amount.negated() : amount;
}

function makeRow(
  account: BudgetActualAccount,
  depth: number,
  hasChildren: boolean,
  budget: Decimal,
  actual: Decimal,
): BudgetVsActualRow {
  const displayBudget = displayAmount(budget, account.nature);
  const displayActual = displayAmount(actual, account.nature);
  const variance = displayActual.minus(displayBudget);
  const favorable = getFavorable(account.nature, variance);

  return {
    id: account.id,
    code: account.code,
    name: account.name,
    parentId: account.parent_id,
    depth,
    nature: account.nature,
    hasChildren,
    budget: displayBudget.toFixed(2),
    actual: displayActual.toFixed(2),
    variance: variance.toFixed(2),
    variancePercent: displayBudget.isZero()
      ? null
      : variance.div(displayBudget.abs()).mul(100).toFixed(2),
    favorable,
  };
}

function makeKpi(budget: Decimal, actual: Decimal, nature: string): BudgetVsActualKpi {
  const variance = actual.minus(budget);
  return {
    budget: budget.toFixed(2),
    actual: actual.toFixed(2),
    variance: variance.toFixed(2),
    variancePercent: budget.isZero() ? null : variance.div(budget.abs()).mul(100).toFixed(2),
    favorable: getFavorable(nature, variance),
  };
}

function displayAmount(value: Decimal, nature: string): Decimal {
  return nature === "expense" || value.isNegative() ? value.abs() : value;
}

function getFavorable(nature: string, variance: Decimal): boolean | null {
  if (variance.isZero()) return null;
  return nature === "expense" ? variance.lt(0) : variance.gt(0);
}

function sumRows(
  rows: BudgetVsActualRow[],
  predicate: (row: BudgetVsActualRow) => boolean,
): DecimalPair {
  return rows.filter(predicate).reduce(
    (sum, row) => ({
      budget: sum.budget.plus(row.budget),
      actual: sum.actual.plus(row.actual),
    }),
    { budget: new Decimal(0), actual: new Decimal(0) },
  );
}

function formatMonth(monthKey: string): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(`${monthKey}-01T12:00:00`),
  );
}

function shiftMonth(monthKey: string, amount: number): string {
  const date = addMonths(startOfMonth(new Date(`${monthKey}-01T12:00:00`)), amount);
  return format(date, "yyyy-MM");
}
