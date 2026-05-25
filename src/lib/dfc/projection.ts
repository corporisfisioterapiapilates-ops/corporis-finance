import { addDays, differenceInCalendarDays, format, startOfDay, subDays } from "date-fns";
import { Decimal } from "decimal.js";

export type ProjectionScenario = "conservative" | "realistic" | "optimistic";

export type ProjectionAccount = {
  id: string;
  type: string;
  opening_balance: number;
  is_active: boolean;
};

export type ProjectionTransaction = {
  id: string;
  account_id: string;
  category_id: string | null;
  amount: number;
  cash_date: string;
  description: string;
  status: string;
  transfer_direction: string | null;
  type: string;
};

export type ProjectionPoint = {
  date: string;
  label: string;
  actualBalance: number | null;
  projectedBalance: number | null;
  conservativeBalance: number | null;
  optimisticBalance: number | null;
  minimumBalance: number;
};

export type ProjectionDay = {
  date: string;
  label: string;
  income: string;
  expense: string;
  balance: string;
  committedIncome: string;
  committedExpense: string;
  estimatedIncome: string;
  estimatedExpense: string;
};

export type ProjectionSummary = {
  today: string;
  currentBalance: string;
  minimumBalance: string;
  balance30: string;
  balance60: string;
  balance90: string;
  minProjectedBalance: string;
  minProjectedDate: string;
  risk: "low" | "medium" | "high";
  chart: ProjectionPoint[];
  days: ProjectionDay[];
  upcoming: ProjectionUpcoming[];
};

export type ProjectionUpcoming = {
  id: string;
  day: string;
  month: string;
  title: string;
  amount: string;
  type: string;
};

type DailyProjection = {
  date: string;
  income: Decimal;
  expense: Decimal;
  balance: Decimal;
  committedIncome: Decimal;
  committedExpense: Decimal;
  estimatedIncome: Decimal;
  estimatedExpense: Decimal;
};

type CategoryAverage = {
  income: Decimal;
  expense: Decimal;
};

const SCENARIO_MULTIPLIERS: Record<
  ProjectionScenario,
  { income: Decimal.Value; expense: Decimal.Value }
> = {
  conservative: { income: "0.9", expense: "1.1" },
  realistic: { income: "1", expense: "1" },
  optimistic: { income: "1.08", expense: "0.95" },
};

export function calculateCashProjection({
  accounts,
  transactions,
  today = new Date(),
  horizonDays = 90,
  minimumBalance = "15000",
  scenario = "realistic",
}: {
  accounts: ProjectionAccount[];
  transactions: ProjectionTransaction[];
  today?: Date;
  horizonDays?: number;
  minimumBalance?: Decimal.Value;
  scenario?: ProjectionScenario;
}): ProjectionSummary {
  const todayDate = startOfDay(today);
  const todayIso = format(todayDate, "yyyy-MM-dd");
  const minimum = new Decimal(minimumBalance);
  const cleared = transactions.filter((transaction) => transaction.status === "cleared");
  const pending = transactions.filter((transaction) => transaction.status === "pending");
  const currentBalance = calculateBalance(accounts, cleared, todayIso);
  const averages = calculateMovingAverages(cleared, todayDate);
  const realisticDays = buildProjectedDays({
    pending,
    averages,
    currentBalance,
    today: todayDate,
    horizonDays,
    scenario: "realistic",
  });
  const scenarioDays = buildProjectedDays({
    pending,
    averages,
    currentBalance,
    today: todayDate,
    horizonDays,
    scenario,
  });
  const conservativeDays = buildProjectedDays({
    pending,
    averages,
    currentBalance,
    today: todayDate,
    horizonDays,
    scenario: "conservative",
  });
  const optimisticDays = buildProjectedDays({
    pending,
    averages,
    currentBalance,
    today: todayDate,
    horizonDays,
    scenario: "optimistic",
  });
  const actualPoints = buildActualPoints(accounts, cleared, todayDate, minimum);
  const chart = [
    ...actualPoints,
    {
      date: todayIso,
      label: "Hoje",
      actualBalance: currentBalance.toNumber(),
      projectedBalance: currentBalance.toNumber(),
      conservativeBalance: currentBalance.toNumber(),
      optimisticBalance: currentBalance.toNumber(),
      minimumBalance: minimum.toNumber(),
    },
    ...scenarioDays.map((day, index) => ({
      date: day.date,
      label: formatLabel(day.date),
      actualBalance: null,
      projectedBalance: day.balance.toNumber(),
      conservativeBalance: conservativeDays[index]?.balance.toNumber() ?? null,
      optimisticBalance: optimisticDays[index]?.balance.toNumber() ?? null,
      minimumBalance: minimum.toNumber(),
    })),
  ];
  const minDay = realisticDays.reduce(
    (min, day) => (day.balance.lessThan(min.balance) ? day : min),
    realisticDays[0] ?? {
      date: todayIso,
      balance: currentBalance,
    },
  );

  return {
    today: todayIso,
    currentBalance: currentBalance.toFixed(2),
    minimumBalance: minimum.toFixed(2),
    balance30: pickBalance(realisticDays, 30, currentBalance),
    balance60: pickBalance(realisticDays, 60, currentBalance),
    balance90: pickBalance(realisticDays, 90, currentBalance),
    minProjectedBalance: minDay.balance.toFixed(2),
    minProjectedDate: minDay.date,
    risk: calculateRisk(minDay.balance, minimum),
    chart,
    days: scenarioDays.map((day) => ({
      date: day.date,
      label: formatLongLabel(day.date),
      income: day.income.toFixed(2),
      expense: day.expense.toFixed(2),
      balance: day.balance.toFixed(2),
      committedIncome: day.committedIncome.toFixed(2),
      committedExpense: day.committedExpense.toFixed(2),
      estimatedIncome: day.estimatedIncome.toFixed(2),
      estimatedExpense: day.estimatedExpense.toFixed(2),
    })),
    upcoming: pending
      .filter((transaction) => transaction.cash_date > todayIso)
      .sort((a, b) => a.cash_date.localeCompare(b.cash_date))
      .slice(0, 5)
      .map((transaction) => ({
        id: transaction.id,
        day: format(new Date(`${transaction.cash_date}T12:00:00`), "dd"),
        month: new Intl.DateTimeFormat("pt-BR", { month: "short" })
          .format(new Date(`${transaction.cash_date}T12:00:00`))
          .replace(".", ""),
        title: transaction.description,
        amount: new Decimal(transaction.amount).toFixed(2),
        type: transaction.type,
      })),
  };
}

function buildProjectedDays({
  pending,
  averages,
  currentBalance,
  today,
  horizonDays,
  scenario,
}: {
  pending: ProjectionTransaction[];
  averages: Map<string, CategoryAverage>;
  currentBalance: Decimal;
  today: Date;
  horizonDays: number;
  scenario: ProjectionScenario;
}): DailyProjection[] {
  const multipliers = SCENARIO_MULTIPLIERS[scenario];
  let balance = currentBalance;
  const days: DailyProjection[] = [];
  const pendingByDate = groupPendingByDate(pending, today, horizonDays);

  for (let dayIndex = 1; dayIndex <= horizonDays; dayIndex++) {
    const date = format(addDays(today, dayIndex), "yyyy-MM-dd");
    const committed = sumDailyTransactions(pendingByDate.get(date) ?? []);
    const historicalWeight = Math.max(0, Math.min(1, (dayIndex - 30) / 60));
    const estimated = sumEstimatedAverage(averages, historicalWeight, multipliers);
    const income = committed.income.plus(estimated.income);
    const expense = committed.expense.plus(estimated.expense);
    balance = balance.plus(income).minus(expense);
    days.push({
      date,
      income,
      expense,
      balance,
      committedIncome: committed.income,
      committedExpense: committed.expense,
      estimatedIncome: estimated.income,
      estimatedExpense: estimated.expense,
    });
  }

  return days;
}

function calculateBalance(
  accounts: ProjectionAccount[],
  transactions: ProjectionTransaction[],
  endInclusive: string,
): Decimal {
  return accounts
    .filter((account) => account.is_active && account.type !== "credit_card")
    .reduce(
      (sum, account) =>
        sum.plus(
          transactions
            .filter(
              (transaction) =>
                transaction.account_id === account.id && transaction.cash_date <= endInclusive,
            )
            .reduce(
              (accountSum, transaction) => accountSum.plus(accountImpact(transaction)),
              new Decimal(account.opening_balance),
            ),
        ),
      new Decimal(0),
    );
}

function accountImpact(transaction: ProjectionTransaction): Decimal {
  if (transaction.type === "income") return new Decimal(transaction.amount);
  if (transaction.type === "expense") return new Decimal(transaction.amount).negated();
  if (transaction.type === "transfer") {
    return transaction.transfer_direction === "in"
      ? new Decimal(transaction.amount)
      : new Decimal(transaction.amount).negated();
  }
  return new Decimal(0);
}

function calculateMovingAverages(
  transactions: ProjectionTransaction[],
  today: Date,
): Map<string, CategoryAverage> {
  const start = format(subDays(today, 90), "yyyy-MM-dd");
  const end = format(today, "yyyy-MM-dd");
  const byCategory = new Map<string, CategoryAverage>();

  for (const transaction of transactions) {
    if (
      transaction.cash_date < start ||
      transaction.cash_date > end ||
      (transaction.type !== "income" && transaction.type !== "expense")
    ) {
      continue;
    }
    const key = transaction.category_id ?? `uncategorized:${transaction.type}`;
    const current = byCategory.get(key) ?? { income: new Decimal(0), expense: new Decimal(0) };
    const dailyAverage = new Decimal(transaction.amount).div(90);
    if (transaction.type === "income") current.income = current.income.plus(dailyAverage);
    if (transaction.type === "expense") current.expense = current.expense.plus(dailyAverage);
    byCategory.set(key, current);
  }

  return byCategory;
}

function groupPendingByDate(
  transactions: ProjectionTransaction[],
  today: Date,
  horizonDays: number,
): Map<string, ProjectionTransaction[]> {
  const todayIso = format(today, "yyyy-MM-dd");
  const endIso = format(addDays(today, horizonDays), "yyyy-MM-dd");
  const grouped = new Map<string, ProjectionTransaction[]>();

  for (const transaction of transactions) {
    if (
      transaction.cash_date <= todayIso ||
      transaction.cash_date > endIso ||
      (transaction.type !== "income" && transaction.type !== "expense")
    ) {
      continue;
    }
    const rows = grouped.get(transaction.cash_date) ?? [];
    rows.push(transaction);
    grouped.set(transaction.cash_date, rows);
  }

  return grouped;
}

function sumDailyTransactions(transactions: ProjectionTransaction[]): {
  income: Decimal;
  expense: Decimal;
} {
  return transactions.reduce(
    (sum, transaction) => {
      if (transaction.type === "income") sum.income = sum.income.plus(transaction.amount);
      if (transaction.type === "expense") sum.expense = sum.expense.plus(transaction.amount);
      return sum;
    },
    { income: new Decimal(0), expense: new Decimal(0) },
  );
}

function sumEstimatedAverage(
  averages: Map<string, CategoryAverage>,
  weight: number,
  multipliers: { income: Decimal.Value; expense: Decimal.Value },
): { income: Decimal; expense: Decimal } {
  const weighted = new Decimal(weight);
  return [...averages.values()].reduce(
    (sum, average) => ({
      income: sum.income.plus(average.income.mul(weighted).mul(multipliers.income)),
      expense: sum.expense.plus(average.expense.mul(weighted).mul(multipliers.expense)),
    }),
    { income: new Decimal(0), expense: new Decimal(0) },
  );
}

function buildActualPoints(
  accounts: ProjectionAccount[],
  transactions: ProjectionTransaction[],
  today: Date,
  minimum: Decimal,
): ProjectionPoint[] {
  return Array.from({ length: 30 }, (_, index) => {
    const date = subDays(today, 30 - index);
    const iso = format(date, "yyyy-MM-dd");
    return {
      date: iso,
      label: formatLabel(iso),
      actualBalance: calculateBalance(accounts, transactions, iso).toNumber(),
      projectedBalance: null,
      conservativeBalance: null,
      optimisticBalance: null,
      minimumBalance: minimum.toNumber(),
    };
  });
}

function pickBalance(days: DailyProjection[], day: number, fallback: Decimal): string {
  return (days[day - 1]?.balance ?? fallback).toFixed(2);
}

function calculateRisk(balance: Decimal, minimum: Decimal): ProjectionSummary["risk"] {
  if (balance.lessThan(0) || balance.lessThan(minimum.mul("0.75"))) return "high";
  if (balance.lessThan(minimum)) return "medium";
  return "low";
}

function formatLabel(isoDate: string): string {
  return format(new Date(`${isoDate}T12:00:00`), "dd/MM");
}

function formatLongLabel(isoDate: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    weekday: "short",
  })
    .format(new Date(`${isoDate}T12:00:00`))
    .replace(".", "");
}

export function dayDistance(from: Date, isoDate: string): number {
  return differenceInCalendarDays(new Date(`${isoDate}T12:00:00`), startOfDay(from));
}
