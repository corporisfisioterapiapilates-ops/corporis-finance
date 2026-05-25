import { describe, expect, it } from "vitest";

import {
  calculateCashProjection,
  type ProjectionAccount,
  type ProjectionTransaction,
} from "@/lib/dfc/projection";

const accounts: ProjectionAccount[] = [
  {
    id: "bank",
    type: "checking",
    opening_balance: 1000,
    is_active: true,
  },
];

describe("calculateCashProjection", () => {
  it("usa apenas lançamentos pendentes reais no dia seguinte", () => {
    const summary = calculateCashProjection({
      accounts,
      transactions: [
        tx("historical-income", "income", 9000, "2026-02-10", "cleared"),
        tx("pending-income", "income", 500, "2026-05-22", "pending"),
        tx("pending-expense", "expense", 200, "2026-05-22", "pending"),
      ],
      today: new Date("2026-05-21T12:00:00"),
    });

    expect(summary.days[0]).toMatchObject({
      date: "2026-05-22",
      income: "500.00",
      expense: "200.00",
      estimatedIncome: "0.00",
      estimatedExpense: "0.00",
      balance: "10300.00",
    });
  });

  it("inclui médias históricas no horizonte de 60 a 90 dias", () => {
    const summary = calculateCashProjection({
      accounts,
      transactions: [
        tx("income-1", "income", 9000, "2026-03-10", "cleared"),
        tx("income-2", "income", 9000, "2026-04-10", "cleared"),
        tx("expense-1", "expense", 3000, "2026-03-12", "cleared"),
        tx("expense-2", "expense", 3000, "2026-04-12", "cleared"),
      ],
      today: new Date("2026-05-21T12:00:00"),
    });

    expect(Number(summary.days[59]?.estimatedIncome)).toBeGreaterThan(0);
    expect(Number(summary.days[89]?.estimatedIncome)).toBeGreaterThan(
      Number(summary.days[59]?.estimatedIncome),
    );
  });

  it("projeta saldo conservador menor que realista e otimista", () => {
    const transactions = [
      tx("income", "income", 9000, "2026-04-10", "cleared"),
      tx("expense", "expense", 3000, "2026-04-12", "cleared"),
    ];
    const realistic = calculateCashProjection({
      accounts,
      transactions,
      today: new Date("2026-05-21T12:00:00"),
      scenario: "realistic",
    });
    const conservative = calculateCashProjection({
      accounts,
      transactions,
      today: new Date("2026-05-21T12:00:00"),
      scenario: "conservative",
    });
    const optimistic = calculateCashProjection({
      accounts,
      transactions,
      today: new Date("2026-05-21T12:00:00"),
      scenario: "optimistic",
    });

    expect(Number(conservative.days[89]?.balance)).toBeLessThan(
      Number(realistic.days[89]?.balance),
    );
    expect(Number(realistic.days[89]?.balance)).toBeLessThan(Number(optimistic.days[89]?.balance));
  });
});

function tx(
  id: string,
  type: "income" | "expense",
  amount: number,
  cashDate: string,
  status: "cleared" | "pending",
): ProjectionTransaction {
  return {
    id,
    account_id: "bank",
    category_id: type,
    amount,
    cash_date: cashDate,
    description: id,
    status,
    transfer_direction: null,
    type,
  };
}
