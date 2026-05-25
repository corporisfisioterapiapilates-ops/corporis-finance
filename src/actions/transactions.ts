"use server";

import { revalidatePath } from "next/cache";

import { syncOrganizationNotifications } from "@/lib/notifications/server";
import { createClient } from "@/lib/supabase/server";
import { type TransactionInput, transactionInputSchema } from "@/types/transaction";

const ATTACHMENTS_BUCKET = "transaction-attachments";
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

export type TransactionActionResult =
  | { ok: true; message: string; id?: string; transferGroupId?: string }
  | { ok: false; error: string };

export type AttachmentActionResult =
  | { ok: true; message: string; url?: string }
  | { ok: false; error: string };

export async function createTransaction(input: TransactionInput): Promise<TransactionActionResult> {
  const parsed = transactionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) {
    return { ok: false, error: "Organização não encontrada." };
  }

  const data = parsed.data;

  if (data.type === "transfer") {
    const { data: transferGroupId, error } = await supabase.rpc("create_manual_transfer", {
      p_from_account_id: data.account_id,
      p_to_account_id: data.counter_account_id ?? "",
      p_amount: Number(data.amount),
      p_description: data.description,
      p_event_date: data.event_date,
      p_cash_date: data.cash_date,
      p_status: data.status,
      p_notes: data.notes || undefined,
    });

    if (error) {
      return { ok: false, error: "Não foi possível criar a transferência." };
    }

    const { data: transferTransaction } = await supabase
      .from("transactions")
      .select("id")
      .eq("transfer_group_id", transferGroupId)
      .eq("transfer_direction", "out")
      .single();

    await syncOrganizationNotifications();
    revalidateTransactions();
    return {
      ok: true,
      message: "Transferência criada.",
      id: transferTransaction?.id,
      transferGroupId,
    };
  }

  const { data: transaction, error } = await supabase
    .from("transactions")
    .insert({
      organization_id: organizationId,
      account_id: data.account_id,
      category_id: data.category_id,
      type: data.type,
      amount: Number(data.amount),
      description: data.description,
      event_date: data.event_date,
      cash_date: data.cash_date,
      status: data.status,
      notes: data.notes || null,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: "Não foi possível criar o lançamento." };
  }

  await syncOrganizationNotifications();
  revalidateTransactions();
  return { ok: true, message: "Lançamento criado.", id: transaction.id };
}

export async function updateTransaction(input: TransactionInput): Promise<TransactionActionResult> {
  const parsed = transactionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  if (!parsed.data.id) {
    return { ok: false, error: "Lançamento inválido." };
  }

  const supabase = await createClient();
  const { data: current, error: currentError } = await supabase
    .from("transactions")
    .select("id,type,transfer_group_id")
    .eq("id", parsed.data.id)
    .single();

  if (currentError || !current) {
    return { ok: false, error: "Lançamento não encontrado." };
  }

  const data = parsed.data;
  const transactionId = data.id;
  if (!transactionId) {
    return { ok: false, error: "Lançamento inválido." };
  }

  if (current.type === "transfer" && current.transfer_group_id) {
    const { error } = await supabase
      .from("transactions")
      .update({
        amount: Number(data.amount),
        description: data.description,
        event_date: data.event_date,
        cash_date: data.cash_date,
        status: data.status,
        notes: data.notes || null,
      })
      .eq("transfer_group_id", current.transfer_group_id);

    if (error) {
      return { ok: false, error: "Não foi possível atualizar a transferência." };
    }

    await syncOrganizationNotifications();
    revalidateTransactions();
    return { ok: true, message: "Transferência atualizada." };
  }

  const { error } = await supabase
    .from("transactions")
    .update({
      account_id: data.account_id,
      category_id: data.category_id,
      counter_account_id: null,
      type: data.type,
      amount: Number(data.amount),
      description: data.description,
      event_date: data.event_date,
      cash_date: data.cash_date,
      status: data.status,
      notes: data.notes || null,
    })
    .eq("id", transactionId);

  if (error) {
    return { ok: false, error: "Não foi possível atualizar o lançamento." };
  }

  await syncOrganizationNotifications();
  revalidateTransactions();
  return { ok: true, message: "Lançamento atualizado." };
}

export async function deleteTransaction(id: string): Promise<TransactionActionResult> {
  const supabase = await createClient();
  const { data: current, error: currentError } = await supabase
    .from("transactions")
    .select("id,transfer_group_id")
    .eq("id", id)
    .single();

  if (currentError || !current) {
    return { ok: false, error: "Lançamento não encontrado." };
  }

  const attachmentPaths = await listAttachmentPathsForDelete(current.id, current.transfer_group_id);
  const query = supabase.from("transactions").delete();
  const { error } = current.transfer_group_id
    ? await query.eq("transfer_group_id", current.transfer_group_id)
    : await query.eq("id", id);

  if (error) {
    return { ok: false, error: "Não foi possível excluir o lançamento." };
  }

  if (attachmentPaths.length > 0) {
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove(attachmentPaths);
  }

  await syncOrganizationNotifications();
  revalidateTransactions();
  return { ok: true, message: "Lançamento excluído." };
}

export async function uploadTransactionAttachments(
  transactionId: string,
  formData: FormData,
): Promise<AttachmentActionResult> {
  const supabase = await createClient();
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) {
    return { ok: false, error: "Organização não encontrada." };
  }

  const { data: transaction } = await supabase
    .from("transactions")
    .select("id")
    .eq("id", transactionId)
    .single();

  if (!transaction) {
    return { ok: false, error: "Lançamento não encontrado." };
  }

  const files = formData
    .getAll("attachments")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length === 0) {
    return { ok: true, message: "Nenhum anexo enviado." };
  }

  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_SIZE) {
      return { ok: false, error: "Cada anexo pode ter no máximo 10 MB." };
    }
    if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
      return { ok: false, error: "Formato de anexo não permitido." };
    }
  }

  for (const file of files) {
    const filename = sanitizeFilename(file.name);
    const storagePath = `${organizationId}/${transactionId}/${crypto.randomUUID()}-${filename}`;
    const { error: uploadError } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return { ok: false, error: "Não foi possível enviar o anexo." };
    }

    const { error: insertError } = await supabase.from("attachments").insert({
      organization_id: organizationId,
      transaction_id: transactionId,
      storage_path: storagePath,
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    });

    if (insertError) {
      await supabase.storage.from(ATTACHMENTS_BUCKET).remove([storagePath]);
      return { ok: false, error: "Não foi possível vincular o anexo ao lançamento." };
    }
  }

  revalidateTransactions();
  return {
    ok: true,
    message: files.length === 1 ? "Anexo salvo." : `${files.length} anexos salvos.`,
  };
}

export async function createAttachmentSignedUrl(
  attachmentId: string,
): Promise<AttachmentActionResult> {
  const supabase = await createClient();
  const { data: attachment, error } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .single();

  if (error || !attachment) {
    return { ok: false, error: "Anexo não encontrado." };
  }

  const { data, error: signedUrlError } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(attachment.storage_path, 60 * 5);

  if (signedUrlError || !data?.signedUrl) {
    return { ok: false, error: "Não foi possível abrir o anexo." };
  }

  return { ok: true, message: "URL criada.", url: data.signedUrl };
}

async function getCurrentOrganizationId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  return data?.organization_id ?? null;
}

function revalidateTransactions() {
  revalidatePath("/lancamentos");
  revalidatePath("/contas");
  revalidatePath("/dashboard");
  revalidatePath("/dfc");
  revalidatePath("/projecao");
  revalidatePath("/");
}

async function listAttachmentPathsForDelete(
  transactionId: string,
  transferGroupId: string | null,
): Promise<string[]> {
  const supabase = await createClient();
  if (!transferGroupId) {
    const { data } = await supabase
      .from("attachments")
      .select("storage_path")
      .eq("transaction_id", transactionId);
    return data?.map((attachment) => attachment.storage_path) ?? [];
  }

  const { data: transferTransactions } = await supabase
    .from("transactions")
    .select("id")
    .eq("transfer_group_id", transferGroupId);
  const transactionIds = transferTransactions?.map((transaction) => transaction.id) ?? [];
  if (transactionIds.length === 0) {
    return [];
  }

  const { data } = await supabase
    .from("attachments")
    .select("storage_path")
    .in("transaction_id", transactionIds);
  return data?.map((attachment) => attachment.storage_path) ?? [];
}

function sanitizeFilename(filename: string): string {
  return (
    filename
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "anexo"
  );
}
