import { describe, expect, it } from "vitest";

import { enrichImportResult } from "@/lib/import/api";
import type { RawTransaction } from "@/lib/import/types";

const row = (overrides: Partial<RawTransaction>): RawTransaction => ({
  externalId: "ext-1",
  eventDate: "2026-01-05",
  cashDate: "2026-01-05",
  description: "PIX ENVIADO",
  amount: "500.00",
  type: "income",
  source: "ofx",
  duplicateKey: "k1",
  ...overrides,
});

describe("enrichImportResult transfer match", () => {
  const existing = [
    {
      amount: 500,
      cash_date: "2026-01-05",
      description: "Transferência",
      external_id: null,
      type: "transfer",
      transfer_direction: "in",
    },
  ] as never;

  it("flags income matching an existing incoming transfer leg", () => {
    const result = enrichImportResult({
      accountId: "acc",
      result: { transactions: [row({})], warnings: [] },
      existingTransactions: existing,
    });
    expect(result.transactions[0]?.transferMatch).toBe(true);
  });

  it("does not flag opposite direction", () => {
    const result = enrichImportResult({
      accountId: "acc",
      result: { transactions: [row({ type: "expense" })], warnings: [] },
      existingTransactions: existing,
    });
    expect(result.transactions[0]?.transferMatch).toBe(false);
  });
});
