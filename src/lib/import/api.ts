import type { CategorizedRawTransaction } from "@/lib/ai/categorize";
import { buildDuplicateKey, markDuplicates } from "@/lib/import/dedup";
import type { ImportParseResult, RawTransaction } from "@/lib/import/types";
import type { Tables } from "@/lib/supabase/types";

type ExistingTransaction = Pick<
  Tables<"transactions">,
  "amount" | "cash_date" | "description" | "external_id"
>;

export async function parseImportRequest(
  request: Request,
): Promise<{ accountId: string; file: File; content: string }> {
  const form = await request.formData();
  const accountId = String(form.get("accountId") ?? "");
  const file = form.get("file");

  if (!accountId) {
    throw new Error("Selecione uma conta antes de importar.");
  }
  if (!(file instanceof File)) {
    throw new Error("Envie um arquivo válido para importação.");
  }

  return { accountId, file, content: await file.text() };
}

export function enrichImportResult({
  accountId,
  result,
  existingTransactions,
}: {
  accountId: string;
  result: ImportParseResult & { transactions: Array<RawTransaction | CategorizedRawTransaction> };
  existingTransactions: ExistingTransaction[];
}) {
  const existingExternalIds = new Set(
    existingTransactions.flatMap((transaction) =>
      transaction.external_id ? [transaction.external_id] : [],
    ),
  );
  const existingDuplicateKeys = new Set(
    existingTransactions.map((transaction) =>
      buildDuplicateKey({
        accountId,
        date: transaction.cash_date,
        amount: transaction.amount,
        description: transaction.description,
      }),
    ),
  );
  const transactions = markDuplicates(
    result.transactions,
    existingExternalIds,
    existingDuplicateKeys,
  );

  return {
    transactions,
    totalRows: transactions.length,
    duplicatesFound: transactions.filter((transaction) => transaction.isDuplicate).length,
    warnings: result.warnings,
  };
}
