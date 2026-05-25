import { createHash } from "node:crypto";

import type { RawTransaction } from "./types";

export type DuplicateCheck = RawTransaction & {
  isDuplicate: boolean;
};

export function buildDuplicateKey({
  accountId,
  date,
  amount,
  description,
}: {
  accountId: string;
  date: string;
  amount: string | number;
  description: string;
}): string {
  const normalized = [
    accountId,
    date,
    normalizeAmount(amount),
    description
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim()
      .toLowerCase(),
  ].join("|");

  return createHash("sha256").update(normalized).digest("hex");
}

export function markDuplicates(
  transactions: RawTransaction[],
  existingExternalIds: Set<string>,
  existingDuplicateKeys: Set<string>,
): DuplicateCheck[] {
  const seen = new Set<string>();

  return transactions.map((transaction) => {
    const externalDuplicate = transaction.externalId
      ? existingExternalIds.has(transaction.externalId)
      : false;
    const semanticDuplicate =
      existingDuplicateKeys.has(transaction.duplicateKey) || seen.has(transaction.duplicateKey);
    seen.add(transaction.duplicateKey);

    return {
      ...transaction,
      isDuplicate: externalDuplicate || semanticDuplicate,
    };
  });
}

function normalizeAmount(amount: string | number): string {
  const numeric = Number(amount);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : String(amount);
}
