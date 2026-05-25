import { addMonths, format, startOfMonth } from "date-fns";
import { Decimal } from "decimal.js";

export type DFCTransaction = {
  id: string;
  category_id: string | null;
  amount: number | string;
  cash_date: string;
  status: string;
  type: string;
};

export type DFCChartAccount = {
  id: string;
  parent_id: string | null;
  code: string;
  name: string;
  nature: string;
  display_order: number;
  is_active?: boolean;
};

export type DFCPeriod = {
  start: string;
  months: number;
  openingBalance?: number | string;
};

export type DFCMonth = {
  key: string;
  label: string;
};

export type DFCRowKind = "group" | "subgroup" | "account" | "calculated" | "total" | "balance";

export type DFCRow = {
  id: string;
  code: string | null;
  label: string;
  kind: DFCRowKind;
  depth: number;
  parentId: string | null;
  values: Record<string, string>;
  total: string;
  isCollapsible: boolean;
  isDefaultExpanded?: boolean;
  color?: string;
};

export type DFCResult = {
  months: DFCMonth[];
  rows: DFCRow[];
  metrics: {
    grossRevenue: string;
    totalExpenses: string;
    netResult: string;
    netMargin: string;
    endingBalance: string;
  };
};

const GROUP_COLORS: Record<string, string> = {
  "1": "#ACC095",
  "2": "#D2B06E",
  "3": "#C85A3E",
  "4": "#C85A3E",
  "5": "#6B635B",
  "6": "#D2B06E",
  "7": "#D2B06E",
  "8": "#F08353",
};

const DERIVED_ROWS = [
  { id: "receita-liquida", label: "RECEITA LÍQUIDA", afterGroup: "2" },
  { id: "lucro-bruto", label: "LUCRO BRUTO", afterGroup: "3" },
  { id: "fluxo-operacional", label: "FLUXO DE CAIXA OPERACIONAL", afterGroup: "4" },
  { id: "fluxo-nao-operacional", label: "FLUXO DE CAIXA NÃO OPERACIONAL", afterGroup: "6" },
  { id: "fluxo-investimentos", label: "FLUXO DE CAIXA DOS INVESTIMENTOS", afterGroup: "7" },
  { id: "fluxo-financeiro", label: "FLUXO DE CAIXA FINANCEIRO", afterGroup: "8" },
] as const;

export function calculateDFC(
  transactions: DFCTransaction[],
  period: DFCPeriod,
  chartOfAccounts: DFCChartAccount[],
): DFCResult {
  const months = buildMonths(period);
  const byId = new Map(chartOfAccounts.map((account) => [account.id, account]));
  const childrenByParent = buildChildrenMap(chartOfAccounts);
  const valuesByAccount = new Map<string, Record<string, Decimal>>();

  for (const account of chartOfAccounts) {
    valuesByAccount.set(account.id, emptyMonthValues(months));
  }

  for (const transaction of transactions) {
    if (
      transaction.status !== "cleared" ||
      transaction.type === "transfer" ||
      !transaction.category_id
    ) {
      continue;
    }

    const monthKey = transaction.cash_date.slice(0, 7);
    if (!months.some((month) => month.key === monthKey)) {
      continue;
    }

    const sign = transaction.type === "income" ? 1 : transaction.type === "expense" ? -1 : 0;
    if (sign === 0) {
      continue;
    }

    let current = byId.get(transaction.category_id);
    while (current) {
      const values = valuesByAccount.get(current.id);
      if (values) {
        values[monthKey] = (values[monthKey] ?? new Decimal(0)).plus(
          new Decimal(transaction.amount).mul(sign),
        );
      }
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }
  }

  const rootAccounts = sortAccounts(
    chartOfAccounts.filter((account) => account.parent_id === null),
  );
  const accountRows: DFCRow[] = [];

  for (const root of rootAccounts) {
    appendAccountRows({
      account: root,
      childrenByParent,
      valuesByAccount,
      months,
      rows: accountRows,
      parentId: null,
      depth: 0,
    });
  }

  const derivedByAfterGroup = buildDerivedRows(months, valuesByAccount, rootAccounts);
  const rows: DFCRow[] = [];
  for (const row of accountRows) {
    rows.push(row);
    const groupCode = row.depth === 0 ? row.code?.split(".")[0] : null;
    if (groupCode) {
      rows.push(...(derivedByAfterGroup.get(groupCode) ?? []));
    }
  }

  const freeCashFlow = sumRowsById(rows, months, [
    "fluxo-operacional",
    "fluxo-nao-operacional",
    "fluxo-investimentos",
    "fluxo-financeiro",
  ]);
  rows.push(
    makeCalculatedRow("fluxo-livre", "FLUXO DE CAIXA LIVRE", months, freeCashFlow, "total"),
  );

  const endingBalance = buildEndingBalance(period.openingBalance ?? 0, months, freeCashFlow);
  rows.push(makeCalculatedRow("saldo-final", "SALDO FINAL REAL", months, endingBalance, "balance"));

  const grossRevenue = getRootValue(valuesByAccount, rootAccounts, "1", months);
  const totalExpenses = rootAccounts.reduce((sum, root) => {
    const values = valuesByAccount.get(root.id) ?? emptyMonthValues(months);
    return sum.plus(
      months.reduce((monthSum, month) => {
        const value = values[month.key] ?? new Decimal(0);
        return value.isNegative() ? monthSum.plus(value.abs()) : monthSum;
      }, new Decimal(0)),
    );
  }, new Decimal(0));
  const netResult = sumMonthRecord(freeCashFlow, months);
  const grossRevenueTotal = sumMonthRecord(grossRevenue, months);
  const lastMonth = months[months.length - 1];

  return {
    months,
    rows,
    metrics: {
      grossRevenue: grossRevenueTotal.toFixed(2),
      totalExpenses: totalExpenses.toFixed(2),
      netResult: netResult.toFixed(2),
      netMargin: grossRevenueTotal.isZero()
        ? "0.00"
        : netResult.div(grossRevenueTotal).mul(100).toFixed(2),
      endingBalance: lastMonth
        ? (endingBalance[lastMonth.key] ?? new Decimal(0)).toFixed(2)
        : "0.00",
    },
  };
}

function buildMonths(period: DFCPeriod): DFCMonth[] {
  const start = startOfMonth(new Date(`${period.start.slice(0, 7)}-01T12:00:00`));
  return Array.from({ length: period.months }, (_, index) => {
    const date = addMonths(start, index);
    return {
      key: format(date, "yyyy-MM"),
      label: new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" })
        .format(date)
        .replace(".", ""),
    };
  });
}

function buildChildrenMap(accounts: DFCChartAccount[]): Map<string | null, DFCChartAccount[]> {
  const map = new Map<string | null, DFCChartAccount[]>();
  for (const account of accounts) {
    const children = map.get(account.parent_id) ?? [];
    children.push(account);
    map.set(account.parent_id, children);
  }
  for (const [parentId, children] of map.entries()) {
    map.set(parentId, sortAccounts(children));
  }
  return map;
}

function sortAccounts(accounts: DFCChartAccount[]): DFCChartAccount[] {
  return [...accounts].sort((left, right) => {
    const byOrder = left.display_order - right.display_order;
    return byOrder === 0
      ? left.code.localeCompare(right.code, "pt-BR", { numeric: true })
      : byOrder;
  });
}

function emptyMonthValues(months: DFCMonth[]): Record<string, Decimal> {
  return Object.fromEntries(months.map((month) => [month.key, new Decimal(0)]));
}

function appendAccountRows({
  account,
  childrenByParent,
  valuesByAccount,
  months,
  rows,
  parentId,
  depth,
}: {
  account: DFCChartAccount;
  childrenByParent: Map<string | null, DFCChartAccount[]>;
  valuesByAccount: Map<string, Record<string, Decimal>>;
  months: DFCMonth[];
  rows: DFCRow[];
  parentId: string | null;
  depth: number;
}) {
  const children = childrenByParent.get(account.id) ?? [];
  const values = valuesByAccount.get(account.id) ?? emptyMonthValues(months);
  const hasMovement = !sumMonthRecord(values, months).isZero();

  if (!hasMovement && depth > 0 && children.length === 0) {
    return;
  }

  rows.push({
    id: account.id,
    code: account.code,
    label: `${account.code} ${account.name}`,
    kind: depth === 0 ? "group" : children.length > 0 ? "subgroup" : "account",
    depth,
    parentId,
    values: decimalRecordToString(values, months),
    total: sumMonthRecord(values, months).toFixed(2),
    isCollapsible: children.length > 0,
    isDefaultExpanded: false,
    color: GROUP_COLORS[account.code.split(".")[0] ?? ""],
  });

  for (const child of children) {
    appendAccountRows({
      account: child,
      childrenByParent,
      valuesByAccount,
      months,
      rows,
      parentId: account.id,
      depth: depth + 1,
    });
  }
}

function buildDerivedRows(
  months: DFCMonth[],
  valuesByAccount: Map<string, Record<string, Decimal>>,
  rootAccounts: DFCChartAccount[],
): Map<string, DFCRow[]> {
  const groups = new Map<string, Record<string, Decimal>>();
  for (const root of rootAccounts) {
    groups.set(root.code, valuesByAccount.get(root.id) ?? emptyMonthValues(months));
  }

  const derivedValues = new Map<string, Record<string, Decimal>>();
  derivedValues.set("receita-liquida", addRecords(months, groups.get("1"), groups.get("2")));
  derivedValues.set(
    "lucro-bruto",
    addRecords(months, derivedValues.get("receita-liquida"), groups.get("3")),
  );
  derivedValues.set(
    "fluxo-operacional",
    addRecords(months, derivedValues.get("lucro-bruto"), groups.get("4")),
  );
  derivedValues.set("fluxo-nao-operacional", addRecords(months, groups.get("5"), groups.get("6")));
  derivedValues.set("fluxo-investimentos", groups.get("7") ?? emptyMonthValues(months));
  derivedValues.set("fluxo-financeiro", groups.get("8") ?? emptyMonthValues(months));

  const rows = new Map<string, DFCRow[]>();
  for (const definition of DERIVED_ROWS) {
    const values = derivedValues.get(definition.id) ?? emptyMonthValues(months);
    rows.set(definition.afterGroup, [
      ...(rows.get(definition.afterGroup) ?? []),
      makeCalculatedRow(definition.id, definition.label, months, values, "calculated"),
    ]);
  }
  return rows;
}

function addRecords(
  months: DFCMonth[],
  ...records: Array<Record<string, Decimal> | undefined>
): Record<string, Decimal> {
  const result = emptyMonthValues(months);
  for (const month of months) {
    result[month.key] = records.reduce(
      (sum, record) => sum.plus(record?.[month.key] ?? 0),
      new Decimal(0),
    );
  }
  return result;
}

function makeCalculatedRow(
  id: string,
  label: string,
  months: DFCMonth[],
  values: Record<string, Decimal>,
  kind: Extract<DFCRowKind, "calculated" | "total" | "balance">,
): DFCRow {
  return {
    id,
    code: null,
    label,
    kind,
    depth: 0,
    parentId: null,
    values: decimalRecordToString(values, months),
    total:
      kind === "balance" && months.length > 0
        ? (values[months[months.length - 1]?.key ?? ""] ?? new Decimal(0)).toFixed(2)
        : sumMonthRecord(values, months).toFixed(2),
    isCollapsible: false,
  };
}

function sumRowsById(rows: DFCRow[], months: DFCMonth[], ids: string[]): Record<string, Decimal> {
  const result = emptyMonthValues(months);
  for (const row of rows) {
    if (!ids.includes(row.id)) {
      continue;
    }
    for (const month of months) {
      result[month.key] = (result[month.key] ?? new Decimal(0)).plus(row.values[month.key] ?? 0);
    }
  }
  return result;
}

function buildEndingBalance(
  openingBalance: number | string,
  months: DFCMonth[],
  freeCashFlow: Record<string, Decimal>,
): Record<string, Decimal> {
  const result = emptyMonthValues(months);
  let balance = new Decimal(openingBalance);
  for (const month of months) {
    balance = balance.plus(freeCashFlow[month.key] ?? 0);
    result[month.key] = balance;
  }
  return result;
}

function getRootValue(
  valuesByAccount: Map<string, Record<string, Decimal>>,
  rootAccounts: DFCChartAccount[],
  code: string,
  months: DFCMonth[],
): Record<string, Decimal> {
  const root = rootAccounts.find((account) => account.code === code);
  return root
    ? (valuesByAccount.get(root.id) ?? emptyMonthValues(months))
    : emptyMonthValues(months);
}

function sumMonthRecord(values: Record<string, Decimal>, months: DFCMonth[]): Decimal {
  return months.reduce((sum, month) => sum.plus(values[month.key] ?? 0), new Decimal(0));
}

function decimalRecordToString(
  values: Record<string, Decimal>,
  months: DFCMonth[],
): Record<string, string> {
  return Object.fromEntries(
    months.map((month) => [month.key, (values[month.key] ?? new Decimal(0)).toFixed(2)]),
  );
}
