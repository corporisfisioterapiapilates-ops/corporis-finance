"use client";

import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  Check,
  FileText,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import {
  createAttachmentSignedUrl,
  createTransaction,
  deleteTransaction,
  type TransactionActionResult,
  updateTransaction,
  uploadTransactionAttachments,
} from "@/actions/transactions";
import { MoneyDisplay } from "@/components/money/money-display";
import { MoneyInput } from "@/components/money/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, toISODate } from "@/lib/date";
import { type ChartAccount, getTransactionCategories } from "@/lib/dfc";
import { sumMoney } from "@/lib/money";
import type { Tables } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import type { TransactionInput } from "@/types/transaction";

type Account = Tables<"accounts">;
type Transaction = Tables<"transactions">;
type Attachment = Tables<"attachments">;
type TransactionWithAttachments = Transaction & {
  attachments?: Attachment[];
};

type TransactionsManagerProps = {
  transactions: TransactionWithAttachments[];
  accounts: Account[];
  categories: ChartAccount[];
  initialOpen?: boolean;
};

type FilterType = "all" | "income" | "expense" | "transfer";
type FilterStatus = "all" | "pending" | "cleared";

const PAGE_SIZE = 20;

export function TransactionsManager({
  transactions,
  accounts,
  categories,
  initialOpen = false,
}: TransactionsManagerProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<FilterType>("all");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(initialOpen);
  const [draft, setDraft] = useState<TransactionInput>(() =>
    emptyTransaction(accounts, categories),
  );
  const [selectedAttachments, setSelectedAttachments] = useState<File[]>([]);
  const [notice, setNotice] = useState<TransactionActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const transactionCategories = useMemo(() => getTransactionCategories(categories), [categories]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const account = accountById.get(transaction.account_id);
      const category = transaction.category_id ? categoryById.get(transaction.category_id) : null;
      const matchesQuery =
        !normalizedQuery ||
        transaction.description.toLowerCase().includes(normalizedQuery) ||
        account?.name.toLowerCase().includes(normalizedQuery) ||
        category?.name.toLowerCase().includes(normalizedQuery);
      const matchesType = typeFilter === "all" || transaction.type === typeFilter;
      const matchesStatus = statusFilter === "all" || transaction.status === statusFilter;
      const matchesAccount = accountFilter === "all" || transaction.account_id === accountFilter;
      const matchesCategory =
        categoryFilter === "all" || transaction.category_id === categoryFilter;

      return matchesQuery && matchesType && matchesStatus && matchesAccount && matchesCategory;
    });
  }, [
    accountById,
    accountFilter,
    categoryById,
    categoryFilter,
    query,
    statusFilter,
    transactions,
    typeFilter,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totals = calculateTotals(filtered);

  function openNew(type: TransactionInput["type"] = "expense") {
    setDraft(emptyTransaction(accounts, transactionCategories, type));
    setSelectedAttachments([]);
    setNotice(null);
    setDrawerOpen(true);
  }

  function openEdit(transaction: TransactionWithAttachments) {
    setDraft({
      id: transaction.id,
      type: transaction.type as TransactionInput["type"],
      account_id: transaction.account_id,
      category_id: transaction.category_id,
      counter_account_id: transaction.counter_account_id,
      amount: String(transaction.amount),
      description: transaction.description,
      event_date: transaction.event_date,
      cash_date: transaction.cash_date,
      status: transaction.status as TransactionInput["status"],
      notes: transaction.notes ?? "",
    });
    setSelectedAttachments([]);
    setNotice(null);
    setDrawerOpen(true);
  }

  function persist() {
    startTransition(async () => {
      const result = draft.id ? await updateTransaction(draft) : await createTransaction(draft);
      if (!result.ok) {
        setNotice(result);
        return;
      }

      const transactionId = draft.id ?? result.id;
      if (transactionId && selectedAttachments.length > 0) {
        const formData = new FormData();
        for (const file of selectedAttachments) {
          formData.append("attachments", file);
        }
        const attachmentResult = await uploadTransactionAttachments(transactionId, formData);
        if (!attachmentResult.ok) {
          setNotice({ ok: false, error: attachmentResult.error });
          return;
        }
      }

      setNotice(result);
      setSelectedAttachments([]);
      if (result.ok) {
        setDrawerOpen(false);
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteTransaction(id);
      setNotice(result);
    });
  }

  return (
    <>
      <div className="rounded-xl border border-line bg-surface p-md shadow-sm-warm">
        <div className="flex flex-wrap items-center gap-sm">
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={14}
              strokeWidth={1.5}
              className="pointer-events-none absolute top-1/2 left-md -translate-y-1/2 text-ink-tertiary"
            />
            <Input
              aria-label="Buscar por descrição"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar por descrição..."
              className="pl-[34px] text-body-sm"
            />
          </div>
          <SelectFilter
            aria-label="Filtrar por tipo"
            value={typeFilter}
            onChange={(value) => setTypeFilter(value as FilterType)}
          >
            <option value="all">Todos os tipos</option>
            <option value="income">Entradas</option>
            <option value="expense">Saídas</option>
            <option value="transfer">Transferências</option>
          </SelectFilter>
          <SelectFilter
            aria-label="Filtrar por conta"
            value={accountFilter}
            onChange={setAccountFilter}
          >
            <option value="all">Todas as contas</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </SelectFilter>
          <SelectFilter
            aria-label="Filtrar por categoria"
            value={categoryFilter}
            onChange={setCategoryFilter}
          >
            <option value="all">Todas as categorias</option>
            {transactionCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </SelectFilter>
          <SelectFilter
            aria-label="Filtrar por status"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as FilterStatus)}
          >
            <option value="all">Todos os status</option>
            <option value="cleared">Realizado</option>
            <option value="pending">Pendente</option>
          </SelectFilter>
          <Button
            type="button"
            variant="ghost"
            className="border border-line"
            onClick={() => {
              setQuery("");
              setTypeFilter("all");
              setStatusFilter("all");
              setAccountFilter("all");
              setCategoryFilter("all");
              setPage(1);
            }}
          >
            <X size={13} strokeWidth={2} />
            Limpar
          </Button>
          <Button type="button" onClick={() => openNew()}>
            <Plus size={16} strokeWidth={2} />
            Novo Lançamento
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-md px-xs text-body-sm text-ink-tertiary">
        <span>
          Mostrando <strong className="text-ink">{filtered.length} lançamentos</strong>
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-md">
          <Summary label="Entradas" value={totals.income} tone="success" />
          <Divider />
          <Summary label="Saídas" value={totals.expense} tone="danger" />
          <Divider />
          <Summary label="Resultado" value={totals.result} tone="neutral" />
        </div>
      </div>

      {notice ? (
        <div
          className={cn(
            "rounded-lg border px-md py-sm text-body-sm",
            notice.ok
              ? "border-success/30 bg-success-soft text-success"
              : "border-danger/30 bg-danger-soft text-danger",
          )}
        >
          {notice.ok ? notice.message : notice.error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm-warm">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              {["Data", "Descrição", "Categoria", "Conta", "Valor", "Status", "Ações"].map(
                (header) => (
                  <th
                    key={header}
                    className="border-b border-line bg-sunken px-md py-sm text-left text-label font-medium uppercase text-ink-tertiary first:pl-lg last:text-center"
                  >
                    {header}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {paginated.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                account={accountById.get(transaction.account_id)}
                category={
                  transaction.category_id ? categoryById.get(transaction.category_id) : undefined
                }
                onEdit={() => openEdit(transaction)}
                onDelete={() => remove(transaction.id)}
                isPending={isPending}
              />
            ))}
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-lg py-xl text-center text-body text-ink-tertiary">
                  Nenhum lançamento encontrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-line bg-base px-lg py-md">
          <span className="text-body-sm text-ink-tertiary">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-xs">
            <Button
              type="button"
              variant="ghost"
              className="border border-line"
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="border border-line"
              disabled={page === totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>

      {drawerOpen ? (
        <TransactionDrawer
          draft={draft}
          accounts={accounts}
          categories={transactionCategories}
          notice={notice}
          isPending={isPending}
          selectedAttachments={selectedAttachments}
          onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
          onAttachmentsChange={setSelectedAttachments}
          onClose={() => setDrawerOpen(false)}
          onSave={persist}
        />
      ) : null}
    </>
  );
}

function TransactionRow({
  transaction,
  account,
  category,
  onEdit,
  onDelete,
  isPending,
}: {
  transaction: TransactionWithAttachments;
  account?: Account;
  category?: ChartAccount;
  onEdit: () => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const signedAmount = signedTransactionAmount(transaction);
  const attachments = transaction.attachments ?? [];
  return (
    <tr className="transition-colors hover:bg-base">
      <td className="px-md py-[13px] text-body-sm text-ink-tertiary first:pl-lg">
        {formatDate(transaction.cash_date)}
      </td>
      <td className="px-md py-[13px]">
        <div className="flex items-center gap-sm">
          <span
            className={cn("size-[7px] rounded-full", signedAmount >= 0 ? "bg-green" : "bg-danger")}
          />
          <div>
            <p className="text-body-sm font-medium text-ink">{transaction.description}</p>
            {transaction.notes ? (
              <p className="mt-[2px] text-meta text-ink-tertiary">{transaction.notes}</p>
            ) : null}
            {attachments.length > 0 ? (
              <div className="mt-xs flex flex-wrap gap-xs">
                {attachments.map((attachment) => (
                  <button
                    key={attachment.id}
                    type="button"
                    onClick={() => openAttachment(attachment.id)}
                    className="inline-flex items-center gap-[4px] rounded-sm bg-sunken px-xs py-[2px] text-meta text-ink-secondary hover:text-orange"
                  >
                    <Paperclip size={11} strokeWidth={1.8} />
                    {attachment.filename ?? "Anexo"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-md py-[13px]">
        {transaction.type === "transfer" ? (
          <Badge className="bg-warning-soft text-warning">Transferência</Badge>
        ) : category ? (
          <Badge
            className={
              transaction.type === "income"
                ? "bg-success-soft text-success"
                : "bg-danger-soft text-danger"
            }
          >
            {category.name}
          </Badge>
        ) : (
          <span className="text-body-sm text-ink-tertiary">—</span>
        )}
      </td>
      <td className="px-md py-[13px] text-body-sm text-ink-secondary">{account?.name ?? "—"}</td>
      <td className="px-md py-[13px]">
        <MoneyDisplay value={signedAmount.toFixed(2)} showSign size="md" />
      </td>
      <td className="px-md py-[13px]">
        <Badge
          className={
            transaction.status === "cleared"
              ? "bg-success-soft text-success"
              : "bg-warning-soft text-warning"
          }
        >
          {transaction.status === "cleared" ? "Realizado" : "Pendente"}
        </Badge>
      </td>
      <td className="px-md py-[13px] text-center">
        <div className="flex justify-center gap-xs">
          <button
            type="button"
            aria-label="Editar lançamento"
            onClick={onEdit}
            className="flex size-8 items-center justify-center rounded-md text-ink-tertiary hover:bg-sunken hover:text-ink-secondary"
          >
            <MoreHorizontal size={15} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label="Excluir lançamento"
            onClick={onDelete}
            disabled={isPending}
            className="flex size-8 items-center justify-center rounded-md text-ink-tertiary hover:bg-danger-soft hover:text-danger disabled:opacity-50"
          >
            <Trash2 size={15} strokeWidth={1.5} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function openAttachment(attachmentId: string) {
  createAttachmentSignedUrl(attachmentId).then((result) => {
    if (result.ok && result.url) {
      window.open(result.url, "_blank", "noopener,noreferrer");
    }
  });
}

function TransactionDrawer({
  draft,
  accounts,
  categories,
  notice,
  isPending,
  selectedAttachments,
  onChange,
  onAttachmentsChange,
  onClose,
  onSave,
}: {
  draft: TransactionInput;
  accounts: Account[];
  categories: ChartAccount[];
  notice: TransactionActionResult | null;
  isPending: boolean;
  selectedAttachments: File[];
  onChange: (patch: Partial<TransactionInput>) => void;
  onAttachmentsChange: (files: File[]) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const isTransfer = draft.type === "transfer";
  const selectedAccount = accounts.find((account) => account.id === draft.account_id);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/25 backdrop-blur-[1px]">
      <aside className="flex h-full w-full max-w-[480px] flex-col bg-surface shadow-[-8px_0_32px_rgba(58,53,48,.10),-2px_0_6px_rgba(58,53,48,.06)]">
        <div className="border-b border-line p-xl pb-lg">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-h2 lowercase text-ink">
                {draft.id ? "editar lançamento" : "novo lançamento"}
              </h2>
              <p className="mt-xs text-body-sm text-ink-tertiary">
                Preencha os dados da movimentação.
              </p>
            </div>
            <button
              type="button"
              aria-label="Fechar painel de lançamento"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-md bg-sunken text-ink-secondary"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
          <div className="mt-lg grid grid-cols-3 gap-xs rounded-lg bg-sunken p-xs">
            <TypeButton
              type="expense"
              current={draft.type}
              onClick={() => onChange({ type: "expense", counter_account_id: null })}
            />
            <TypeButton
              type="income"
              current={draft.type}
              onClick={() => onChange({ type: "income", counter_account_id: null })}
            />
            <TypeButton
              type="transfer"
              current={draft.type}
              onClick={() => onChange({ type: "transfer", category_id: null })}
            />
          </div>
        </div>

        <div className="flex-1 space-y-lg overflow-y-auto p-xl">
          <Field label="Valor">
            <MoneyInput
              aria-label="Valor do lançamento"
              value={draft.amount}
              onValueChange={(amount) => onChange({ amount })}
              className={cn(
                "bg-[#F7F5F2] py-md font-display text-[28px]",
                draft.type === "income" ? "text-success" : "text-danger",
              )}
            />
          </Field>
          <div className="grid grid-cols-2 gap-md">
            <Field label="Data do fato">
              <Input
                type="date"
                aria-label="Data do fato"
                value={draft.event_date}
                onChange={(event) => onChange({ event_date: event.target.value })}
              />
            </Field>
            <Field label="Data no caixa">
              <Input
                type="date"
                aria-label="Data no caixa"
                value={draft.cash_date}
                onChange={(event) => onChange({ cash_date: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Descrição">
            <Input
              aria-label="Descrição"
              value={draft.description}
              onChange={(event) => onChange({ description: event.target.value })}
              placeholder="Ex: Aula de Pilates - Ana Souza"
            />
          </Field>
          <Field label={isTransfer ? "Conta de origem" : "Conta"}>
            <Select
              aria-label={isTransfer ? "Conta de origem" : "Conta"}
              value={draft.account_id}
              onChange={(value) => onChange({ account_id: value })}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} - {accountTypeLabel(account.type)}
                </option>
              ))}
            </Select>
            {selectedAccount ? (
              <div className="mt-sm rounded-lg border border-line bg-base px-md py-sm text-body-sm text-ink-secondary">
                Saldo inicial:{" "}
                <MoneyDisplay value={selectedAccount.opening_balance} colored={false} />
              </div>
            ) : null}
          </Field>
          {isTransfer ? (
            <Field label="Conta de destino">
              <Select
                aria-label="Conta de destino"
                value={draft.counter_account_id ?? ""}
                onChange={(value) => onChange({ counter_account_id: value || null })}
              >
                <option value="">Selecione</option>
                {accounts
                  .filter((account) => account.id !== draft.account_id)
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
              </Select>
            </Field>
          ) : (
            <Field label="Categoria">
              <Select
                aria-label="Categoria"
                value={draft.category_id ?? ""}
                onChange={(value) => onChange({ category_id: value || null })}
              >
                <option value="">Selecione</option>
                {categories
                  .filter((category) =>
                    draft.type === "income"
                      ? category.nature === "income"
                      : category.nature === "expense",
                  )
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </Select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-sm">
            <StatusButton
              active={draft.status === "cleared"}
              onClick={() => onChange({ status: "cleared" })}
              label="Realizado"
            />
            <StatusButton
              active={draft.status === "pending"}
              onClick={() => onChange({ status: "pending" })}
              label="Pendente"
            />
          </div>
          <Field label="Observações">
            <Input
              aria-label="Observações"
              value={draft.notes ?? ""}
              onChange={(event) => onChange({ notes: event.target.value })}
              placeholder="Opcional"
            />
          </Field>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-base p-lg text-center text-body-sm text-ink-tertiary transition-colors hover:border-orange hover:bg-orange-soft/40">
            <UploadCloud size={22} strokeWidth={1.5} className="mb-sm text-orange" />
            Anexar comprovantes
            <span className="text-meta">PDF, imagem, CSV ou planilha até 10 MB.</span>
            <input
              type="file"
              multiple
              className="sr-only"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.csv,.txt,.xls,.xlsx,application/pdf,image/jpeg,image/png,image/webp,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => onAttachmentsChange(Array.from(event.target.files ?? []))}
            />
          </label>
          {selectedAttachments.length > 0 ? (
            <div className="space-y-xs rounded-lg border border-line bg-surface p-sm">
              {selectedAttachments.map((file) => (
                <div
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  className="flex items-center gap-xs text-body-sm text-ink-secondary"
                >
                  <FileText size={14} strokeWidth={1.5} className="text-orange" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <span className="text-meta text-ink-tertiary">{formatFileSize(file.size)}</span>
                </div>
              ))}
            </div>
          ) : null}
          {notice ? (
            <div
              className={cn(
                "rounded-lg border px-md py-sm text-body-sm",
                notice.ok
                  ? "border-success/30 bg-success-soft text-success"
                  : "border-danger/30 bg-danger-soft text-danger",
              )}
            >
              {notice.ok ? notice.message : notice.error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-sm border-t border-line bg-base px-xl py-md">
          <Button type="button" onClick={onSave} disabled={isPending}>
            <Check size={15} strokeWidth={2} />
            Salvar lançamento
          </Button>
          <Button type="button" variant="ghost" className="border border-line" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </aside>
    </div>
  );
}

function TypeButton({
  type,
  current,
  onClick,
}: {
  type: TransactionInput["type"];
  current: TransactionInput["type"];
  onClick: () => void;
}) {
  const Icon =
    type === "income" ? ArrowDownCircle : type === "expense" ? ArrowUpCircle : ArrowLeftRight;
  const label = type === "income" ? "Entrada" : type === "expense" ? "Saída" : "Transferência";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-xs rounded-md py-sm text-body-sm font-medium text-ink-tertiary",
        current === type && "bg-surface shadow-sm-warm",
        current === type && type === "income" && "text-success",
        current === type && type === "expense" && "text-danger",
        current === type && type === "transfer" && "text-warning",
      )}
    >
      <Icon size={16} strokeWidth={1.5} />
      {label}
    </button>
  );
}

function SelectFilter({
  value,
  onChange,
  children,
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
} & Omit<React.ComponentProps<"select">, "onChange" | "value">) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      {...props}
      className="rounded-lg border border-line bg-surface px-md py-[9px] text-body-sm text-ink outline-none focus:border-orange focus:shadow-focus-orange"
    >
      {children}
    </select>
  );
}

function Select({
  value,
  onChange,
  children,
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
} & Omit<React.ComponentProps<"select">, "onChange" | "value">) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      {...props}
      className="w-full rounded-lg border border-line bg-surface px-md py-[10px] text-body text-ink outline-none focus:border-orange focus:shadow-focus-orange"
    >
      {children}
    </select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-xs block text-label font-medium uppercase text-ink-secondary">{label}</div>
      {children}
    </div>
  );
}

function StatusButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border border-line bg-surface px-md py-sm text-body-sm font-medium text-ink-tertiary",
        active && "border-green bg-success-soft text-success",
      )}
    >
      {label}
    </button>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-sm px-sm py-xs text-[10px] font-medium uppercase tracking-[0.07em]",
        className,
      )}
    >
      {children}
    </span>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "danger" | "neutral";
}) {
  return (
    <div className="flex items-center gap-xs">
      <span>{label}</span>
      <MoneyDisplay value={value} colored={tone !== "neutral"} className="font-medium" />
    </div>
  );
}

function Divider() {
  return <div className="h-[14px] w-px bg-line" />;
}

function emptyTransaction(
  accounts: Account[],
  categories: ChartAccount[],
  type: TransactionInput["type"] = "expense",
): TransactionInput {
  const today = toISODate(new Date());
  const category =
    type === "income"
      ? categories.find((item) => item.nature === "income")
      : categories.find((item) => item.nature === "expense");

  return {
    type,
    account_id: accounts[0]?.id ?? "",
    category_id: type === "transfer" ? null : (category?.id ?? null),
    counter_account_id:
      type === "transfer"
        ? (accounts.find((account) => account.id !== accounts[0]?.id)?.id ?? null)
        : null,
    amount: "0.00",
    description: "",
    event_date: today,
    cash_date: today,
    status: "cleared",
    notes: "",
  };
}

function signedTransactionAmount(transaction: Transaction): number {
  if (transaction.type === "income") {
    return Number(transaction.amount);
  }
  if (transaction.type === "expense") {
    return -Number(transaction.amount);
  }
  return transaction.transfer_direction === "in"
    ? Number(transaction.amount)
    : -Number(transaction.amount);
}

function formatFileSize(size: number): string {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function calculateTotals(transactions: Transaction[]) {
  const income = transactions
    .filter((transaction) => transaction.type === "income")
    .map((transaction) => String(transaction.amount));
  const expense = transactions
    .filter((transaction) => transaction.type === "expense")
    .map((transaction) => String(transaction.amount));
  const incomeTotal = sumMoney(income);
  const expenseTotal = sumMoney(expense);
  return {
    income: incomeTotal,
    expense: `-${expenseTotal}`,
    result: sumMoney([incomeTotal, `-${expenseTotal}`]),
  };
}

function accountTypeLabel(type: string) {
  if (type === "credit_card") return "Cartão";
  if (type === "cash") return "Caixa";
  if (type === "savings") return "Poupança";
  return "Conta Corrente";
}
