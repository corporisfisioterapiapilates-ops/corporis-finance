"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { buildCategoryMemoryRows, mergeCategoryMemoryUsage } from "@/lib/ai/category-memory";
import { normalizeInvoiceClosingDate } from "@/lib/import/pdf-parser";
import { syncOrganizationNotifications } from "@/lib/notifications/server";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/lib/supabase/types";

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
      categoryId: z.string().uuid().nullable(),
      counterAccountId: z.string().uuid().nullable().optional(),
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
  if (importType === "pdf_invoice" && transactions.some((row) => row.counterAccountId)) {
    return { ok: false, error: "Faturas de cartão não aceitam transferências." };
  }
  const active = transactions.filter((row) => !row.ignored && !row.isDuplicate);
  if (active.some((row) => !row.categoryId && !row.counterAccountId)) {
    return { ok: false, error: "Há lançamentos sem categoria ou transferência." };
  }
  if (active.some((row) => row.counterAccountId === accountId)) {
    return { ok: false, error: "A conta de destino da transferência precisa ser outra conta." };
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

  const source =
    importType === "ofx"
      ? ("import_ofx" as const)
      : importType === "pdf_invoice"
        ? ("import_pdf" as const)
        : ("import_csv" as const);

  // Transferência vira duas linhas ligadas por transfer_group_id (uma por conta),
  // como no lançamento manual. Só a perna da conta importada carrega external_id (dedup).
  const toInsert = active.flatMap((transaction): TablesInsert<"transactions">[] => {
    const base = {
      organization_id: account.organization_id,
      amount: Number(transaction.amount),
      description: transaction.description,
      event_date: transaction.eventDate,
      cash_date: transaction.cashDate,
      status: "cleared" as const,
      source,
      import_id: importId,
    };

    if (transaction.counterAccountId) {
      const groupId = crypto.randomUUID();
      const leavesAccount = transaction.type === "expense";
      return [
        {
          ...base,
          account_id: accountId,
          counter_account_id: transaction.counterAccountId,
          category_id: null,
          type: "transfer" as const,
          transfer_direction: leavesAccount ? ("out" as const) : ("in" as const),
          transfer_group_id: groupId,
          external_id: transaction.externalId,
          credit_card_invoice_id: null,
          ai_categorized: false,
          ai_confidence: null,
        },
        {
          ...base,
          account_id: transaction.counterAccountId,
          counter_account_id: accountId,
          category_id: null,
          type: "transfer" as const,
          transfer_direction: leavesAccount ? ("in" as const) : ("out" as const),
          transfer_group_id: groupId,
          external_id: null,
          credit_card_invoice_id: null,
          ai_categorized: false,
          ai_confidence: null,
        },
      ];
    }

    return [
      {
        ...base,
        account_id: accountId,
        counter_account_id: null,
        category_id: transaction.categoryId,
        type: transaction.type,
        transfer_direction: null,
        transfer_group_id: null,
        external_id: transaction.externalId,
        credit_card_invoice_id: invoiceId,
        ai_categorized: true,
        ai_confidence: null,
      },
    ];
  });
  const importedCount = active.length;

  if (toInsert.length > 0) {
    const { error } = await supabase.from("transactions").insert(toInsert);
    if (error) {
      console.error("transactions import insert failed", {
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
      return {
        ok: false,
        error:
          error.code === "23505"
            ? "Um ou mais lançamentos já foram importados nesta conta. Importe o arquivo novamente para recalcular as duplicidades."
            : process.env.NODE_ENV === "development"
              ? `Não foi possível confirmar a importação: ${error.message}`
              : "Não foi possível confirmar a importação.",
      };
    }

    const memoryRows = buildCategoryMemoryRows({
      organizationId: account.organization_id,
      transactions: active.flatMap((transaction) =>
        !transaction.counterAccountId && transaction.categoryId
          ? [{ ...transaction, categoryId: transaction.categoryId }]
          : [],
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
      imported_rows: importedCount,
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
    message: `${importedCount} lançamentos importados.`,
    imported: importedCount,
  };
}
