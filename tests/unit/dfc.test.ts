import { describe, expect, it } from "vitest";

import {
  calculateDFC,
  type DFCChartAccount,
  type DFCTransaction,
  toVerticalAnalysis,
} from "@/lib/dfc";

const chart: DFCChartAccount[] = [
  account("g1", null, "1", "Receita Bruta", "income", 1),
  account("r1", "g1", "1.01", "Pilates", "income", 2),
  account("g2", null, "2", "Impostos", "expense", 3),
  account("i1", "g2", "2.01", "Simples", "expense", 4),
  account("g3", null, "3", "Custos", "expense", 5),
  account("c1", "g3", "3.01", "Materiais", "expense", 6),
  account("g4", null, "4", "Despesas Operacionais", "expense", 7),
  account("d1", "g4", "4.01", "Aluguel", "expense", 8),
  account("g5", null, "5", "Financeiro", "expense", 9),
  account("f1", "g5", "5.01", "Tarifas", "expense", 10),
  account("g6", null, "6", "Não Operacional", "expense", 11),
  account("g7", null, "7", "Investimentos", "expense", 12),
  account("g8", null, "8", "Financiamento", "expense", 13),
];

describe("calculateDFC", () => {
  it("calcula linhas principais e saldo final mês a mês", () => {
    const result = calculateDFC(
      [
        tx("t1", "income", "r1", 10000, "2026-01-05"),
        tx("t2", "expense", "i1", 1000, "2026-01-10"),
        tx("t3", "expense", "c1", 2000, "2026-01-11"),
        tx("t4", "expense", "d1", 3000, "2026-01-12"),
        tx("t5", "expense", "f1", 500, "2026-01-13"),
        tx("t6", "income", "r1", 8000, "2026-02-05"),
        tx("t7", "expense", "d1", 2500, "2026-02-12"),
      ],
      { start: "2026-01-01", months: 2, openingBalance: 1000 },
      chart,
    );

    expect(row(result, "receita-liquida").values["2026-01"]).toBe("9000.00");
    expect(row(result, "lucro-bruto").values["2026-01"]).toBe("7000.00");
    expect(row(result, "fluxo-operacional").values["2026-01"]).toBe("4000.00");
    expect(row(result, "fluxo-livre").values["2026-01"]).toBe("3500.00");
    expect(row(result, "saldo-final").values["2026-01"]).toBe("4500.00");
    expect(row(result, "saldo-final").values["2026-02"]).toBe("10000.00");
  });

  it("ignora transferências e lançamentos pendentes no DFC realizado", () => {
    const result = calculateDFC(
      [
        tx("cleared", "income", "r1", 1000, "2026-01-01"),
        tx("pending", "expense", "d1", 900, "2026-01-02", "pending"),
        tx("transfer", "transfer", null, 700, "2026-01-03"),
      ],
      { start: "2026-01-01", months: 1 },
      chart,
    );

    expect(row(result, "1").values["2026-01"]).toBe("1000.00");
    expect(row(result, "4").values["2026-01"]).toBe("0.00");
    expect(row(result, "fluxo-livre").values["2026-01"]).toBe("1000.00");
  });

  it("mantém AV% da receita bruta em 100% e trata mês sem receita", () => {
    const result = calculateDFC(
      [
        tx("income", "income", "r1", 1000, "2026-01-01"),
        tx("expense", "expense", "d1", 250, "2026-01-02"),
      ],
      { start: "2026-01-01", months: 2 },
      chart,
    );
    const av = toVerticalAnalysis(result);

    expect(row(av, "1").values["2026-01"]).toBe("100.00");
    expect(row(av, "4").values["2026-01"]).toBe("-25.00");
    expect(row(av, "1").values["2026-02"]).toBe("0.00");
  });
});

function row(result: ReturnType<typeof calculateDFC>, idOrCode: string) {
  const found = result.rows.find((item) => item.id === idOrCode || item.code === idOrCode);
  if (!found) {
    throw new Error(`Row not found: ${idOrCode}`);
  }
  return found;
}

function account(
  id: string,
  parentId: string | null,
  code: string,
  name: string,
  nature: string,
  order: number,
): DFCChartAccount {
  return {
    id,
    parent_id: parentId,
    code,
    name,
    nature,
    display_order: order,
    is_active: true,
  };
}

function tx(
  id: string,
  type: string,
  categoryId: string | null,
  amount: number,
  cashDate: string,
  status = "cleared",
): DFCTransaction {
  return {
    id,
    type,
    category_id: categoryId,
    amount,
    cash_date: cashDate,
    status,
  };
}
