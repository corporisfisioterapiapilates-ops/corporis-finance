import { describe, expect, it } from "vitest";

import { generateNotifications } from "@/lib/notifications/generate";

const organizationId = "org";
const today = new Date("2026-05-24T12:00:00");

describe("generateNotifications", () => {
  it("cria alertas de fatura e lançamento pendente nas janelas de 7, 3 e 1 dias", () => {
    const notifications = generateNotifications({
      organizationId,
      today,
      invoices: [
        invoice("inv-7", "2026-05-31"),
        invoice("inv-3", "2026-05-27"),
        invoice("inv-1", "2026-05-25"),
        invoice("inv-2", "2026-05-26"),
      ],
      transactions: [
        transaction("tx-7", "2026-05-31"),
        transaction("tx-3", "2026-05-27"),
        transaction("tx-1", "2026-05-25"),
        transaction("tx-2", "2026-05-26"),
      ],
    });

    expect(notifications.map((item) => item.dedupe_key)).toEqual([
      "invoice_due:inv-7:7",
      "invoice_due:inv-3:3",
      "invoice_due:inv-1:1",
      "pending_transaction_due:tx-7:7",
      "pending_transaction_due:tx-3:3",
      "pending_transaction_due:tx-1:1",
    ]);
  });

  it("gera alertas para importações em revisão e com falha", () => {
    const notifications = generateNotifications({
      organizationId,
      today,
      imports: [
        {
          id: "imp-review",
          organization_id: organizationId,
          filename: "extrato.csv",
          status: "reviewing",
          error_message: null,
        },
        {
          id: "imp-failed",
          organization_id: organizationId,
          filename: "fatura.pdf",
          status: "failed",
          error_message: "Arquivo ilegível",
        },
      ],
    });

    expect(notifications.map((item) => item.dedupe_key)).toEqual([
      "import_review:imp-review",
      "import_failed:imp-failed",
    ]);
  });

  it("gera orçamento estourado quando a variação desfavorável passa de 10%", () => {
    const notifications = generateNotifications({
      organizationId,
      today,
      budget: {
        monthKey: "2026-05",
        accounts: [
          {
            id: "expense",
            parent_id: null,
            code: "4",
            name: "Despesas Operacionais",
            nature: "expense",
            display_order: 1,
            is_active: true,
          },
        ],
        budgetValues: [{ chart_account_id: "expense", month: 5, amount: 1000 }],
        transactions: [
          {
            category_id: "expense",
            amount: 1200,
            cash_date: "2026-05-10",
            status: "cleared",
            type: "expense",
          },
        ],
      },
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.dedupe_key).toBe("budget_overrun:2026-05:expense");
  });

  it("gera risco de caixa quando a projeção fica abaixo de R$ 15 mil", () => {
    const notifications = generateNotifications({
      organizationId,
      today,
      projection: {
        accounts: [
          {
            id: "bank",
            type: "checking",
            opening_balance: 20000,
            is_active: true,
          },
        ],
        transactions: [
          {
            id: "future-expense",
            account_id: "bank",
            category_id: "expense",
            amount: 8000,
            cash_date: "2026-05-25",
            description: "Aluguel",
            status: "pending",
            transfer_direction: null,
            type: "expense",
          },
        ],
      },
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.type).toBe("cash_risk");
    expect(notifications[0]?.dedupe_key).toBe("cash_risk:2026-05-25");
  });
});

function invoice(id: string, dueDate: string) {
  return {
    id,
    organization_id: organizationId,
    due_date: dueDate,
    status: "closed",
    total_amount: 1000,
    accounts: { name: "Cartão Corporis" },
  };
}

function transaction(id: string, cashDate: string) {
  return {
    id,
    organization_id: organizationId,
    cash_date: cashDate,
    status: "pending",
    type: "expense",
    amount: 500,
    description: "Fornecedor",
  };
}
