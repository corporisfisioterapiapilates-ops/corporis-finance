import { NextResponse } from "next/server";

import { categorizeRawTransactions } from "@/lib/ai/categorize";
import { enrichImportResult, parseImportRequest } from "@/lib/import/api";
import { parseCsvTransactions } from "@/lib/import/csv-parser";
import { syncOrganizationNotifications } from "@/lib/notifications/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { accountId, content, file } = await parseImportRequest(request);
    const supabase = await createClient();
    const [
      { data: account, error: accountError },
      { data: existingTransactions, error: transactionsError },
      { data: categories, error: categoriesError },
      { data: memories, error: memoriesError },
    ] = await Promise.all([
      supabase.from("accounts").select("id,organization_id").eq("id", accountId).single(),
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

    const result = parseCsvTransactions({ content, accountId });
    result.transactions = await categorizeRawTransactions(
      result.transactions,
      categories ?? [],
      memories ?? [],
    );
    const enriched = enrichImportResult({
      accountId,
      result,
      existingTransactions: existingTransactions ?? [],
    });
    const reviewPayload = {
      filename: file.name,
      importType: "csv",
      ...enriched,
    };
    const { data: importRow, error: importError } = await supabase
      .from("imports")
      .insert({
        organization_id: account.organization_id,
        account_id: accountId,
        import_type: "csv",
        filename: file.name,
        status: "reviewing",
        total_rows: enriched.totalRows,
        duplicates_found: enriched.duplicatesFound,
        raw_content: content.slice(0, 100_000),
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
      { error: error instanceof Error ? error.message : "Não foi possível importar o CSV." },
      { status: 400 },
    );
  }
}
