import { describe, expect, it } from "vitest";

import { runConsultantTools } from "@/lib/ai/consultant";

type ToolInput = Parameters<typeof runConsultantTools>[0];
type Transaction = ToolInput["transactions"][number];
type Category = ToolInput["categories"][number];

const categories: Category[] = [
  { id: "g1", code: "1", name: "Receita Bruta", parent_id: null },
  { id: "r1", code: "1.01", name: "Pilates", parent_id: "g1" },
  { id: "g4", code: "4", name: "Despesas Operacionais", parent_id: null },
  { id: "d1", code: "4.01", name: "Aluguel", parent_id: "g4" },
  { id: "d2", code: "4.02", name: "Sistemas", parent_id: "g4" },
];

describe("runConsultantTools", () => {
  it("gera resumo mensal estruturado com comparação contra o mês anterior", () => {
    const results = runConsultantTools({
      question: "Como está meu resultado acumulado?",
      transactions: [
        tx("income-current", "income", 5000, "2026-05-05", "r1"),
        tx("expense-current", "expense", 1200, "2026-05-10", "d1"),
        tx("income-previous", "income", 4000, "2026-04-05", "r1"),
        tx("expense-previous", "expense", 1000, "2026-04-10", "d1"),
      ],
      categories,
      today: new Date("2026-05-24T12:00:00"),
    });

    expect(results[0]).toMatchObject({
      tool: "monthly_summary",
      cards: [
        { label: "Entradas", value: "R$ 5.000,00" },
        { label: "Saídas", value: "R$ 1.200,00" },
        { label: "Resultado", value: "R$ 3.800,00" },
      ],
    });
  });

  it("lista pendências futuras quando a pergunta é sobre projeção ou contas a pagar", () => {
    const results = runConsultantTools({
      question: "Quanto tenho pendente para pagar?",
      transactions: [
        tx("pending-income", "income", 800, "2026-05-26", "r1", "pending"),
        tx("pending-expense", "expense", 300, "2026-05-27", "d2", "pending"),
        tx("past-pending", "expense", 999, "2026-05-01", "d1", "pending"),
      ],
      categories,
      today: new Date("2026-05-24T12:00:00"),
    });

    expect(results[0]).toMatchObject({
      tool: "pending_cash_flow",
      cards: [
        { label: "A receber", value: "R$ 800,00" },
        { label: "A pagar", value: "R$ 300,00" },
        { label: "Efeito líquido", value: "R$ 500,00" },
      ],
    });
    expect(results[0]?.table?.rows).toHaveLength(2);
  });
});

function tx(
  description: string,
  type: Transaction["type"],
  amount: number,
  cashDate: string,
  categoryId: string,
  status: Transaction["status"] = "cleared",
): Transaction {
  return {
    amount,
    cash_date: cashDate,
    category_id: categoryId,
    description,
    status,
    type,
  };
}
