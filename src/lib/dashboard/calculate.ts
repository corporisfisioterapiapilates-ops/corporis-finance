import {
  addMonths,
  differenceInCalendarDays,
  format,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { Decimal } from "decimal.js";

export type DashboardAccount = {
  id: string;
  name: string;
  type: string;
  bank_name: string | null;
  color: string | null;
  opening_balance: number;
  credit_limit: number | null;
  due_day: number | null;
  is_active: boolean;
};

export type DashboardTransaction = {
  id: string;
  account_id: string;
  category_id: string | null;
  counter_account_id: string | null;
  amount: number;
  cash_date: string;
  created_at: string;
  description: string;
  status: string;
  transfer_direction: string | null;
  type: string;
};

export type DashboardCategory = {
  id: string;
  parent_id: string | null;
  code: string;
  name: string;
  nature: string;
};

export type DashboardSummary = {
  period: {
    month: string;
    label: string;
    shortLabel: string;
    start: string;
    end: string;
    previousMonthLabel: string;
    previousMonthHref: string;
    nextMonthHref: string;
  };
  kpis: {
    totalBalance: Kpi;
    income: Kpi;
    expense: Kpi;
    result: Kpi;
  };
  monthlyFlow: MonthlyFlow[];
  balanceEvolution: BalancePoint[];
  expensesByGroup: ExpenseGroup[];
  latestTransactions: DashboardTransaction[];
  accounts: AccountSummary[];
  upcoming: UpcomingItem[];
};

export type Kpi = {
  value: string;
  delta: number | null;
};

export type MonthlyFlow = {
  month: string;
  income: number;
  expense: number;
};

export type BalancePoint = {
  month: string;
  balance: number;
};

export type ExpenseGroup = {
  name: string;
  value: number;
  color: string;
};

export type AccountSummary = {
  id: string;
  name: string;
  type: string;
  bankName: string | null;
  color: string | null;
  balance: string;
  creditLimit: number | null;
  dueDay: number | null;
};

export type UpcomingItem = {
  id: string;
  day: string;
  month: string;
  title: string;
  subtitle: string;
  amount: string;
  daysUntil: number;
};

const GROUP_COLORS = ["#C85A3E", "#F08353", "#D2B06E", "#ACC095", "#6B635B"];

export function calculateDashboardSummary({
  accounts,
  transactions,
  categories,
  selectedMonth,
  today = new Date(),
}: {
  accounts: DashboardAccount[];
  transactions: DashboardTransaction[];
  categories: DashboardCategory[];
  selectedMonth: string;
  today?: Date;
}): DashboardSummary {
  const periodDate = parseSelectedMonth(selectedMonth, today);
  const periodStart = startOfMonth(periodDate);
  const previousStart = subMonths(periodStart, 1);
  const period = {
    month: format(periodStart, "yyyy-MM"),
    label: formatMonthLabel(periodStart),
    shortLabel: formatShortMonthLabel(periodStart),
    start: format(periodStart, "yyyy-MM-dd"),
    end: format(addMonths(periodStart, 1), "yyyy-MM-dd"),
    previousMonthLabel: formatMonthLabel(previousStart),
    previousMonthHref: `/dashboard?month=${format(previousStart, "yyyy-MM")}`,
    nextMonthHref: `/dashboard?month=${format(addMonths(periodStart, 1), "yyyy-MM")}`,
  };
  const previousPeriod = {
    start: format(previousStart, "yyyy-MM-dd"),
    end: format(periodStart, "yyyy-MM-dd"),
  };

  const cleared = transactions.filter((transaction) => transaction.status === "cleared");
  const currentIncome = sumTransactionType(cleared, period.start, period.end, "income");
  const previousIncome = sumTransactionType(
    cleared,
    previousPeriod.start,
    previousPeriod.end,
    "income",
  );
  const currentExpense = sumTransactionType(cleared, period.start, period.end, "expense");
  const previousExpense = sumTransactionType(
    cleared,
    previousPeriod.start,
    previousPeriod.end,
    "expense",
  );
  const currentResult = currentIncome.minus(currentExpense);
  const previousResult = previousIncome.minus(previousExpense);
  const totalBalance = calculateTotalBalance(accounts, cleared, period.end);
  const previousTotalBalance = calculateTotalBalance(accounts, cleared, previousPeriod.end);
  const months = Array.from({ length: 6 }, (_, index) =>
    startOfMonth(subMonths(periodStart, 5 - index)),
  );

  return {
    period,
    kpis: {
      totalBalance: {
        value: totalBalance.toFixed(2),
        delta: percentDelta(totalBalance, previousTotalBalance),
      },
      income: {
        value: currentIncome.toFixed(2),
        delta: percentDelta(currentIncome, previousIncome),
      },
      expense: {
        value: currentExpense.toFixed(2),
        delta: percentDelta(currentExpense, previousExpense),
      },
      result: {
        value: currentResult.toFixed(2),
        delta: percentDelta(currentResult, previousResult),
      },
    },
    monthlyFlow: months.map((month) => {
      const start = format(month, "yyyy-MM-dd");
      const end = format(addMonths(month, 1), "yyyy-MM-dd");
      return {
        month: format(month, "MMM").replace(".", ""),
        income: sumTransactionType(cleared, start, end, "income").toNumber(),
        expense: sumTransactionType(cleared, start, end, "expense").toNumber(),
      };
    }),
    balanceEvolution: months.map((month) => {
      const end = format(addMonths(month, 1), "yyyy-MM-dd");
      return {
        month: format(month, "MMM").replace(".", ""),
        balance: calculateTotalBalance(accounts, cleared, end).toNumber(),
      };
    }),
    expensesByGroup: calculateExpensesByGroup(cleared, categories, period.start, period.end),
    latestTransactions: [...transactions]
      .sort((a, b) =>
        `${b.cash_date}-${b.created_at}`.localeCompare(`${a.cash_date}-${a.created_at}`),
      )
      .slice(0, 5),
    accounts: accounts
      .filter((account) => account.is_active)
      .sort((a, b) => Number(a.type === "credit_card") - Number(b.type === "credit_card"))
      .slice(0, 5)
      .map((account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        bankName: account.bank_name,
        color: account.color,
        balance: calculateAccountBalance(account, cleared, period.end).toFixed(2),
        creditLimit: account.credit_limit,
        dueDay: account.due_day,
      })),
    upcoming: calculateUpcoming(transactions, accounts, categories, today),
  };
}

function parseSelectedMonth(selectedMonth: string, today: Date): Date {
  if (/^\d{4}-\d{2}$/.test(selectedMonth)) {
    return new Date(`${selectedMonth}-01T12:00:00`);
  }
  return startOfMonth(today);
}

function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
}

function formatShortMonthLabel(date: Date): string {
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", "");
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${format(date, "yyyy")}`;
}

function sumTransactionType(
  transactions: DashboardTransaction[],
  start: string,
  end: string,
  type: "income" | "expense",
): Decimal {
  return transactions
    .filter(
      (transaction) =>
        transaction.type === type && transaction.cash_date >= start && transaction.cash_date < end,
    )
    .reduce((sum, transaction) => sum.plus(transaction.amount), new Decimal(0));
}

function calculateTotalBalance(
  accounts: DashboardAccount[],
  transactions: DashboardTransaction[],
  end: string,
): Decimal {
  return accounts
    .filter((account) => account.is_active && account.type !== "credit_card")
    .reduce(
      (sum, account) => sum.plus(calculateAccountBalance(account, transactions, end)),
      new Decimal(0),
    );
}

function calculateAccountBalance(
  account: DashboardAccount,
  transactions: DashboardTransaction[],
  end: string,
): Decimal {
  if (account.type === "credit_card") {
    return transactions
      .filter((transaction) => transaction.account_id === account.id && transaction.cash_date < end)
      .reduce((sum, transaction) => {
        if (transaction.type === "expense") return sum.plus(transaction.amount);
        if (transaction.type === "income") return sum.minus(transaction.amount);
        return sum;
      }, new Decimal(0));
  }

  return transactions
    .filter((transaction) => transaction.account_id === account.id && transaction.cash_date < end)
    .reduce(
      (sum, transaction) => sum.plus(accountImpact(transaction)),
      new Decimal(account.opening_balance),
    );
}

function accountImpact(transaction: DashboardTransaction): Decimal {
  if (transaction.type === "income") return new Decimal(transaction.amount);
  if (transaction.type === "expense") return new Decimal(transaction.amount).negated();
  if (transaction.type === "transfer") {
    return transaction.transfer_direction === "in"
      ? new Decimal(transaction.amount)
      : new Decimal(transaction.amount).negated();
  }
  return new Decimal(0);
}

function percentDelta(current: Decimal, previous: Decimal): number | null {
  if (previous.isZero()) {
    return current.isZero() ? 0 : null;
  }
  return current.minus(previous).div(previous.abs()).mul(100).toDecimalPlaces(1).toNumber();
}

function calculateExpensesByGroup(
  transactions: DashboardTransaction[],
  categories: DashboardCategory[],
  start: string,
  end: string,
): ExpenseGroup[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const rootByCode = new Map(
    categories
      .filter((category) => category.parent_id === null)
      .map((category) => [category.code, category]),
  );
  const groups = new Map<string, Decimal>();

  for (const transaction of transactions) {
    if (
      transaction.type !== "expense" ||
      transaction.cash_date < start ||
      transaction.cash_date >= end
    ) {
      continue;
    }
    const category = transaction.category_id ? categoryById.get(transaction.category_id) : null;
    const rootCode = category?.code.split(".")[0] ?? "sem";
    const root = rootByCode.get(rootCode);
    const groupName = root?.name ?? category?.name ?? "Sem categoria";
    groups.set(groupName, (groups.get(groupName) ?? new Decimal(0)).plus(transaction.amount));
  }

  return [...groups.entries()]
    .map(([name, value], index) => ({
      name,
      value: value.toNumber(),
      color: GROUP_COLORS[index % GROUP_COLORS.length] ?? "#6B635B",
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

function calculateUpcoming(
  transactions: DashboardTransaction[],
  accounts: DashboardAccount[],
  categories: DashboardCategory[],
  today: Date,
): UpcomingItem[] {
  const todayIso = format(today, "yyyy-MM-dd");
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return transactions
    .filter(
      (transaction) =>
        transaction.status === "pending" &&
        transaction.type === "expense" &&
        transaction.cash_date >= todayIso,
    )
    .sort((a, b) => a.cash_date.localeCompare(b.cash_date))
    .slice(0, 5)
    .map((transaction) => {
      const dueDate = new Date(`${transaction.cash_date}T12:00:00`);
      const daysUntil = differenceInCalendarDays(startOfDay(dueDate), startOfDay(today));
      const category = transaction.category_id ? categoryById.get(transaction.category_id) : null;
      const account = accountById.get(transaction.account_id);
      return {
        id: transaction.id,
        day: format(dueDate, "dd"),
        month: new Intl.DateTimeFormat("pt-BR", { month: "short" })
          .format(dueDate)
          .replace(".", ""),
        title: transaction.description,
        subtitle: [category ? `${category.code} ${category.name}` : null, account?.name]
          .filter(Boolean)
          .join(" · "),
        amount: new Decimal(transaction.amount).toFixed(2),
        daysUntil,
      };
    });
}
