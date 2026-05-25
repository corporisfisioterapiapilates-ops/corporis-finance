import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { categorizeRawTransactions } from "@/lib/ai/categorize";
import { enrichImportResult, parseImportRequest } from "@/lib/import/api";
import { buildDuplicateKey } from "@/lib/import/dedup";
import { parsePdfInvoice } from "@/lib/import/pdf-parser";
import type { RawTransaction } from "@/lib/import/types";
import { syncOrganizationNotifications } from "@/lib/notifications/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { accountId, file } = await parseImportRequest(request);
    const supabase = await createClient();
    const [
      { data: account, error: accountError },
      { data: existingTransactions, error: transactionsError },
      { data: categories, error: categoriesError },
      { data: memories, error: memoriesError },
    ] = await Promise.all([
      supabase.from("accounts").select("id,organization_id,type").eq("id", accountId).single(),
      supabase
        .from("transactions")
        .select("external_id,cash_date,amount,description")
        .eq("account_id", accountId),
      supabase.from("chart_of_accounts").select("*").eq("is_active", true),
      supabase.from("category_memory").select("*"),
    ]);

    if (accountError) throw accountError;
    if (transactionsError) throw transactionsError;
    if (categoriesError) throw categoriesError;
    if (memoriesError) throw memoriesError;
    if (account.type !== "credit_card") {
      throw new Error("Selecione um cartão de crédito para importar fatura em PDF.");
    }

    const base64Pdf = Buffer.from(await file.arrayBuffer()).toString("base64");
    const invoice = await parsePdfInvoice(base64Pdf);
    const transactions: RawTransaction[] = invoice.transactions.map((transaction) => {
      const description = transaction.installmentInfo
        ? `${transaction.description} (${transaction.installmentInfo})`
        : transaction.description;
      const duplicateKey = buildDuplicateKey({
        accountId,
        date: transaction.date,
        amount: transaction.amount,
        description,
      });
      const externalId = createHash("sha256")
        .update(
          [accountId, invoice.dueDate, transaction.date, transaction.amount, description].join("|"),
        )
        .digest("hex");

      return {
        externalId,
        eventDate: transaction.date,
        cashDate: invoice.dueDate,
        description,
        amount: transaction.amount,
        type: "expense",
        source: "pdf_invoice",
        duplicateKey,
      };
    });

    const categorized = await categorizeRawTransactions(
      transactions,
      categories ?? [],
      memories ?? [],
    );
    const enriched = enrichImportResult({
      accountId,
      result: { transactions: categorized, warnings: [] },
      existingTransactions: existingTransactions ?? [],
    });
    const reviewPayload = {
      filename: file.name,
      importType: "pdf_invoice",
      invoice,
      ...enriched,
    };
    const { data: importRow, error: importError } = await supabase
      .from("imports")
      .insert({
        organization_id: account.organization_id,
        account_id: accountId,
        import_type: "pdf_invoice",
        filename: file.name,
        status: "reviewing",
        total_rows: enriched.totalRows,
        duplicates_found: enriched.duplicatesFound,
        raw_content: `PDF processado via Claude Vision: ${file.name}`,
        review_payload: reviewPayload,
      })
      .select("id")
      .single();
    if (importError) throw importError;
    await syncOrganizationNotifications();

    return NextResponse.json({
      importId: importRow.id,
      ...reviewPayload,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível importar o PDF." },
      { status: 400 },
    );
  }
}
