"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { buildCategoryMemoryRows, mergeCategoryMemoryUsage } from "@/lib/ai/category-memory";
import { normalizeInvoiceClosingDate } from "@/lib/import/pdf-parser";
import { syncOrganizationNotifications } from "@/lib/notifications/server";
import { createClient } from "@/lib/supabase/server";

const confirmImportSchema = z.object({
  accountId: z.string().uuid(),
  importId: z.string().uuid(),
  importType: z.enum(["csv", "ofx", "pdf_invoice"]),
  invoice: z
    .object({
      closingDate: z.string(),
      dueDate: z.string(),
      total: z.string(),
    })
    .optional(),
  transactions: z.array(
    z.object({
      amount: z.string(),
      cashDate: z.string(),
      categoryId: z.string().uuid(),
      description: z.string(),
      eventDate: z.string(),
      externalId: z.string().nullable(),
      ignored: z.boolean(),
      isDuplicate: z.boolean(),
      type: z.enum(["income", "expense"]),
    }),
  ),
});

export type ConfirmImportResult =
  | { ok: true; message: string; imported: number }
  | { ok: false; error: string };

export async function confirmImport(input: unknown): Promise<ConfirmImportResult> {
  const parsed = confirmImportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { accountId, importId, importType, invoice, transactions } = parsed.data;
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id,organization_id,type")
    .eq("id", accountId)
    .single();

  if (accountError || !account) {
    return { ok: false, error: "Conta não encontrada." };
  }
  if (importType === "pdf_invoice" && account.type !== "credit_card") {
    return { ok: false, error: "Selecione um cartão de crédito para confirmar esta fatura." };
  }
  if (importType === "pdf_invoice" && !invoice) {
    return { ok: false, error: "Dados da fatura não encontrados." };
  }

  let invoiceId: string | null = null;
  if (importType === "pdf_invoice" && invoice) {
    const closingDate = normalizeInvoiceClosingDate(invoice.closingDate, invoice.dueDate);
    const { data: invoiceRow, error: invoiceError } = await supabase
      .from("credit_card_invoices")
      .insert({
        organization_id: account.organization_id,
        account_id: accountId,
        closing_date: closingDate,
        due_date: invoice.dueDate,
        total_amount: Number(invoice.total),
        status: "closed",
      })
      .select("id")
      .single();

    if (invoiceError) {
      console.error("credit_card_invoices insert failed", invoiceError);
      return {
        ok: false,
        error:
          process.env.NODE_ENV === "development"
            ? `Não foi possível registrar a fatura do cartão: ${invoiceError.message}`
            : "Não foi possível registrar a fatura do cartão.",
      };
    }

    invoiceId = invoiceRow.id;
  }

  const toInsert = transactions
    .filter((transaction) => !transaction.ignored && !transaction.isDuplicate)
    .map((transaction) => ({
      organization_id: account.organization_id,
      account_id: accountId,
      category_id: transaction.categoryId,
      type: transaction.type,
      amount: Number(transaction.amount),
      description: transaction.description,
      event_date: transaction.eventDate,
      cash_date: transaction.cashDate,
      status: "cleared",
      source:
        importType === "ofx"
          ? ("import_ofx" as const)
          : importType === "pdf_invoice"
            ? ("import_pdf" as const)
            : ("import_csv" as const),
      import_id: importId,
      credit_card_invoice_id: invoiceId,
      external_id: transaction.externalId,
      ai_categorized: true,
      ai_confidence: null,
    }));

  if (toInsert.length > 0) {
    const { error } = await supabase.from("transactions").insert(toInsert);
    if (error) {
      return { ok: false, error: "Não foi possível confirmar a importação." };
    }

    const memoryRows = buildCategoryMemoryRows({
      organizationId: account.organization_id,
      transactions: transactions.filter(
        (transaction) => !transaction.ignored && !transaction.isDuplicate,
      ),
    });

    if (memoryRows.length > 0) {
      const { data: existingMemories, error: existingMemoriesError } = await supabase
        .from("category_memory")
        .select("normalized_description,transaction_type,usage_count")
        .eq("organization_id", account.organization_id);

      if (existingMemoriesError) {
        console.warn("category memory lookup failed", existingMemoriesError);
      }

      const rowsWithUsage = mergeCategoryMemoryUsage(memoryRows, existingMemories ?? []);
      const { error: memoryError } = await supabase.from("category_memory").upsert(rowsWithUsage, {
        onConflict: "organization_id,normalized_description,transaction_type",
      });

      if (memoryError) {
        console.warn("category memory upsert failed", memoryError);
      }
    }
  }

  const { error: importError } = await supabase
    .from("imports")
    .update({
      status: "completed",
      imported_rows: toInsert.length,
      completed_at: new Date().toISOString(),
      review_payload: null,
    })
    .eq("id", importId);

  if (importError) {
    return { ok: false, error: "Importação confirmada, mas o histórico não foi atualizado." };
  }

  await syncOrganizationNotifications();
  revalidatePath("/importacoes");
  revalidatePath("/lancamentos");
  revalidatePath("/dashboard");
  revalidatePath("/dfc");
  revalidatePath("/projecao");
  revalidatePath("/");

  return {
    ok: true,
    message: `${toInsert.length} lançamentos importados.`,
    imported: toInsert.length,
  };
}
