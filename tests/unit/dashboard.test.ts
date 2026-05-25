import { describe, expect, it } from "vitest";

import {
  calculateDashboardSummary,
  type DashboardAccount,
  type DashboardCategory,
  type DashboardTransaction,
} from "@/lib/dashboard/calculate";

const accounts: DashboardAccount[] = [
  {
    id: "bank",
    name: "Itaú PJ",
    type: "checking",
    bank_name: "Itaú",
    color: "#F08353",
    opening_balance: 1000,
    credit_limit: null,
    due_day: null,
    is_active: true,
  },
  {
    id: "reserve",
    name: "Reserva",
    type: "savings",
    bank_name: null,
    color: "#ACC095",
    opening_balance: 500,
    credit_limit: null,
    due_day: null,
    is_active: true,
  },
];

const categories: DashboardCategory[] = [
  { id: "income-root", parent_id: null, code: "1", name: "Receita Bruta", nature: "income" },
  { id: "income", parent_id: "income-root", code: "1.01", name: "Pilates", nature: "income" },
  {
    id: "expense-root",
    parent_id: null,
    code: "4",
    name: "Despesas Operacionais",
    nature: "expense",
  },
  { id: "expense", parent_id: "expense-root", code: "4.01", name: "Aluguel", nature: "expense" },
];

const transactions: DashboardTransaction[] = [
  tx("jan-income", "income", 2000, "2026-01-05", "bank", "income"),
  tx("jan-expense", "expense", 800, "2026-01-10", "bank", "expense"),
  tx("feb-income", "income", 3000, "2026-02-05", "bank", "income"),
  tx("feb-expense", "expense", 1000, "2026-02-10", "bank", "expense"),
  tx("transfer-out", "transfer", 300, "2026-02-15", "bank", null, "out"),
  tx("transfer-in", "transfer", 300, "2026-02-15", "reserve", null, "in"),
  tx("pending", "expense", 250, "2026-02-20", "bank", "expense", null, "pending"),
];

describe("calculateDashboardSummary", () => {
  it("calcula KPIs do mês e variação contra o mês anterior", () => {
    const summary = calculateDashboardSummary({
      accounts,
      transactions,
      categories,
      selectedMonth: "2026-02",
      today: new Date("2026-02-01T12:00:00"),
    });

    expect(summary.kpis.income.value).toBe("3000.00");
    expect(summary.kpis.expense.value).toBe("1000.00");
    expect(summary.kpis.result.value).toBe("2000.00");
    expect(summary.kpis.income.delta).toBe(50);
    expect(summary.kpis.expense.delta).toBe(25);
    expect(summary.kpis.totalBalance.value).toBe("4700.00");
  });

  it("agrupa despesas pelo grupo raiz do plano de contas e ignora pendentes nos KPIs", () => {
    const summary = calculateDashboardSummary({
      accounts,
      transactions,
      categories,
      selectedMonth: "2026-02",
      today: new Date("2026-02-01T12:00:00"),
    });

    expect(summary.expensesByGroup).toMatchObject([{ name: "Despesas Operacionais", value: 1000 }]);
    expect(summary.upcoming).toHaveLength(1);
    expect(summary.upcoming[0]?.amount).toBe("250.00");
  });
});

function tx(
  id: string,
  type: DashboardTransaction["type"],
  amount: number,
  cashDate: string,
  accountId: string,
  categoryId: string | null,
  transferDirection: string | null = null,
  status = "cleared",
): DashboardTransaction {
  return {
    id,
    account_id: accountId,
    category_id: categoryId,
    counter_account_id: null,
    amount,
    cash_date: cashDate,
    created_at: `${cashDate}T12:00:00`,
    description: id,
    status,
    transfer_direction: transferDirection,
    type,
  };
}
