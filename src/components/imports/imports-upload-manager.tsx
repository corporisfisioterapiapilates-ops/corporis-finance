"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Info,
  Landmark,
  ListFilter,
  Loader2,
  RotateCcw,
  Search,
  SquareCheck,
  Tag,
  UploadCloud,
  XCircle,
} from "lucide-react";
import type * as React from "react";
import { useMemo, useRef, useState, useTransition } from "react";

import { type ConfirmImportResult, confirmImport } from "@/actions/imports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type Account = Tables<"accounts">;
type Category = Tables<"chart_of_accounts">;
type ImportRow = Tables<"imports">;

type ParseResponse = {
  filename: string;
  importId: string;
  importType: "csv" | "ofx" | "pdf_invoice";
  invoice?: {
    closingDate: string;
    dueDate: string;
    total: string;
  };
  totalRows: number;
  duplicatesFound: number;
  warnings: string[];
  transactions: Array<{
    amount: string;
    aiConfidence: number;
    cashDate: string;
    eventDate: string;
    description: string;
    duplicateKey: string;
    externalId: string | null;
    isDuplicate: boolean;
    suggestedCategoryCode: string | null;
    suggestedCategoryId: string | null;
    suggestedCategoryName: string | null;
    type: string;
  }>;
  error?: string;
};

type ReviewRow = ParseResponse["transactions"][number] & {
  categoryId: string;
  ignored: boolean;
};

type ReviewPayload = Omit<ParseResponse, "importId">;

export function ImportsUploadManager({
  accounts,
  categories,
  imports,
}: {
  accounts: Account[];
  categories: Category[];
  imports: ImportRow[];
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [result, setResult] = useState<ParseResponse | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<ConfirmImportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function parseFile(kind: "csv" | "ofx" | "pdf", file: File | null) {
    if (!file) return;
    setError(null);
    setResult(null);

    startTransition(async () => {
      const form = new FormData();
      form.append("file", file);
      form.append("accountId", accountId);
      const response = await fetch(`/api/import/parse-${kind}`, {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as ParseResponse;

      if (!response.ok) {
        setError(payload.error ?? "Não foi possível processar o arquivo.");
        return;
      }

      setResult(payload);
      setReviewRows(
        payload.transactions.map((transaction) => ({
          ...transaction,
          categoryId: transaction.suggestedCategoryId ?? "",
          ignored: transaction.isDuplicate,
        })),
      );
    });
  }

  function confirm() {
    if (!result) return;
    setNotice(null);
    startTransition(async () => {
      const response = await confirmImport({
        accountId,
        importId: result.importId,
        importType: result.importType,
        invoice: result.invoice,
        transactions: reviewRows.map((row) => ({
          amount: row.amount,
          cashDate: row.cashDate,
          categoryId: row.categoryId,
          description: row.description,
          eventDate: row.eventDate,
          externalId: row.externalId,
          ignored: row.ignored,
          isDuplicate: row.isDuplicate,
          type: row.type,
        })),
      });
      setNotice(response);
      if (response.ok) {
        setResult(null);
        setReviewRows([]);
      }
    });
  }

  function restoreReview(importRow: ImportRow) {
    const payload = parseReviewPayload(importRow.review_payload);

    if (!payload) {
      setError(
        "Esta importação antiga não tem dados de revisão salvos. Importe o arquivo novamente.",
      );
      return;
    }

    setError(null);
    setNotice(null);
    setAccountId(importRow.account_id ?? accountId);
    setResult({ ...payload, importId: importRow.id });
    setReviewRows(
      payload.transactions.map((transaction) => ({
        ...transaction,
        categoryId: transaction.suggestedCategoryId ?? "",
        ignored: transaction.isDuplicate,
      })),
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex flex-col gap-xl">
      <div className="flex flex-wrap items-end justify-between gap-md">
        <div>
          <h1 className="font-display text-display-2 lowercase text-ink">
            Importar extratos e faturas
          </h1>
          <p className="mt-xs max-w-[620px] text-body text-ink-secondary">
            Faça upload de extratos em OFX/CSV ou faturas em PDF para revisar antes de confirmar.
          </p>
        </div>
        <label className="flex flex-col gap-xs text-body-sm text-ink-secondary">
          Conta ou cartão do arquivo
          <select
            value={accountId}
            onChange={(event) => {
              setAccountId(event.target.value);
              setError(null);
              setNotice(null);
            }}
            className="min-w-[240px] rounded-lg border border-line bg-surface px-md py-sm text-body-sm text-ink outline-none focus:border-orange focus:shadow-focus-orange"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} · {account.type === "credit_card" ? "cartão" : "conta"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="grid gap-lg xl:grid-cols-3">
        <UploadCard
          title="extrato bancário"
          description="Importe o extrato direto do banco em formato OFX."
          formats={["OFX"]}
          icon={Landmark}
          tone="green"
          accept=".ofx"
          disabled={!accountId || isPending}
          onFile={(file) => parseFile("ofx", file)}
        />
        <UploadCard
          title="planilha csv"
          description="Use CSV com colunas de data, descrição e valor."
          formats={["CSV"]}
          icon={FileSpreadsheet}
          tone="beige"
          accept=".csv"
          disabled={!accountId || isPending}
          onFile={(file) => parseFile("csv", file)}
        />
        <UploadCard
          title="fatura de cartão"
          description="PDF de fatura será lido via Claude Vision."
          formats={["PDF"]}
          icon={CreditCard}
          tone="orange"
          accept=".pdf"
          disabled={!accountId || isPending}
          onFile={(file) => parseFile("pdf", file)}
        />
      </section>

      {isPending ? (
        <div className="flex items-center gap-sm rounded-lg border border-line bg-surface px-md py-sm text-body-sm text-ink-secondary">
          <Loader2 size={15} className="animate-spin" />
          Processando arquivo...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-danger/30 bg-danger-soft px-md py-sm text-body-sm text-danger">
          {error}
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

      {result ? (
        <ParseSummary
          account={accounts.find((account) => account.id === accountId) ?? null}
          categories={categories}
          result={result}
          rows={reviewRows}
          isPending={isPending}
          onConfirm={confirm}
          onRowsChange={setReviewRows}
        />
      ) : null}

      <ImportsHistory imports={imports} accounts={accounts} onRestoreReview={restoreReview} />
    </div>
  );
}

function ImportsHistory({
  imports,
  accounts,
  onRestoreReview,
}: {
  imports: ImportRow[];
  accounts: Account[];
  onRestoreReview: (importRow: ImportRow) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | "reviewing" | "completed" | "failed">(
    "all",
  );
  const [typeFilter, setTypeFilter] = useState<"all" | "ofx" | "csv" | "pdf_invoice">("all");
  const [query, setQuery] = useState("");
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const stats = useMemo(() => buildImportStats(imports), [imports]);
  const filteredImports = useMemo(
    () =>
      imports.filter((item) => {
        const account = item.account_id ? accountById.get(item.account_id) : null;
        const text = normalizeSearch(
          `${item.filename} ${item.import_type} ${item.status} ${account?.name ?? ""}`,
        );
        return (
          (statusFilter === "all" || item.status === statusFilter) &&
          (typeFilter === "all" || item.import_type === typeFilter) &&
          text.includes(normalizeSearch(query))
        );
      }),
    [accountById, imports, query, statusFilter, typeFilter],
  );

  return (
    <section className="grid gap-lg xl:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-line bg-surface p-md shadow-sm-warm">
        <div className="mb-md flex items-center gap-sm">
          <ListFilter size={16} strokeWidth={1.5} className="text-orange" />
          <h2 className="font-display text-h3 lowercase text-ink">histórico</h2>
        </div>

        <HistoryFilterGroup label="Status">
          <HistoryFilterButton
            label="Todas"
            count={imports.length}
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          />
          <HistoryFilterButton
            label="Em revisão"
            count={stats.reviewing}
            active={statusFilter === "reviewing"}
            onClick={() => setStatusFilter("reviewing")}
          />
          <HistoryFilterButton
            label="Concluídas"
            count={stats.completed}
            active={statusFilter === "completed"}
            onClick={() => setStatusFilter("completed")}
          />
          <HistoryFilterButton
            label="Falhas"
            count={stats.failed}
            active={statusFilter === "failed"}
            onClick={() => setStatusFilter("failed")}
          />
        </HistoryFilterGroup>

        <HistoryFilterGroup label="Formato">
          <HistoryFilterButton
            label="Todos"
            count={imports.length}
            active={typeFilter === "all"}
            onClick={() => setTypeFilter("all")}
          />
          <HistoryFilterButton
            label="OFX"
            count={stats.ofx}
            active={typeFilter === "ofx"}
            onClick={() => setTypeFilter("ofx")}
          />
          <HistoryFilterButton
            label="CSV"
            count={stats.csv}
            active={typeFilter === "csv"}
            onClick={() => setTypeFilter("csv")}
          />
          <HistoryFilterButton
            label="Faturas PDF"
            count={stats.pdfInvoice}
            active={typeFilter === "pdf_invoice"}
            onClick={() => setTypeFilter("pdf_invoice")}
          />
        </HistoryFilterGroup>
      </aside>

      <div className="flex min-w-0 flex-col gap-md">
        <div className="grid gap-md lg:grid-cols-4">
          <ImportStatCard
            icon={CheckCircle2}
            label="Concluídas"
            value={stats.completed}
            helper={`${stats.importedRows} lançamentos importados`}
            tone="success"
          />
          <ImportStatCard
            icon={Clock3}
            label="Em revisão"
            value={stats.reviewing}
            helper="aguardando confirmação"
            tone="warning"
          />
          <ImportStatCard
            icon={AlertTriangle}
            label="Duplicatas"
            value={stats.duplicates}
            helper="sinalizadas pela conciliação"
            tone="orange"
          />
          <ImportStatCard
            icon={XCircle}
            label="Falhas"
            value={stats.failed}
            helper="arquivos com erro"
            tone="danger"
          />
        </div>

        <div className="rounded-xl border border-line bg-surface shadow-sm-warm">
          <div className="flex flex-wrap items-center gap-md border-b border-line bg-base px-lg py-md">
            <div>
              <h2 className="font-display text-h3 lowercase text-ink">importações registradas</h2>
              <p className="mt-xs text-body-sm text-ink-tertiary">
                {filteredImports.length} de {imports.length} registros
              </p>
            </div>
            <label className="relative ml-auto min-w-[280px]">
              <Search
                size={15}
                className="pointer-events-none absolute top-1/2 left-sm -translate-y-1/2 text-ink-tertiary"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar arquivo, conta ou status..."
                className="h-9 w-full rounded-lg border border-line bg-surface pr-sm pl-8 text-body-sm text-ink outline-none focus:border-orange focus:shadow-focus-orange"
              />
            </label>
          </div>

          {filteredImports.length > 0 ? (
            <div className="divide-y divide-line">
              {filteredImports.map((item) => (
                <ImportHistoryItem
                  key={item.id}
                  item={item}
                  account={item.account_id ? (accountById.get(item.account_id) ?? null) : null}
                  onRestoreReview={onRestoreReview}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-lg py-xl text-center">
              <FileText size={34} strokeWidth={1.5} className="text-ink-tertiary" />
              <p className="mt-md text-body-sm font-medium text-ink">
                Nenhuma importação encontrada
              </p>
              <p className="mt-xs max-w-[360px] text-body-sm text-ink-tertiary">
                Ajuste os filtros ou faça upload de um OFX, CSV ou PDF para criar o primeiro
                registro.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function UploadCard({
  title,
  description,
  formats,
  icon: Icon,
  tone,
  accept,
  disabled,
  onFile,
}: {
  title: string;
  description: string;
  formats: string[];
  icon: typeof Landmark;
  tone: "green" | "beige" | "orange";
  accept: string;
  disabled: boolean;
  onFile: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const toneClass = {
    green: "from-green to-beige bg-success-soft text-success",
    beige: "from-beige to-beige-light bg-beige-soft text-[#B8914E]",
    orange: "from-orange to-tangerine bg-orange-soft text-orange",
  }[tone];
  const [gradientClass, _toClass, iconBgClass, iconTextClass] = toneClass.split(" ");

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border border-line bg-surface shadow-sm-warm transition hover:-translate-y-0.5 hover:shadow-lg-warm",
        disabled && "opacity-60",
      )}
    >
      <div className={cn("h-[5px] bg-linear-to-r", gradientClass, _toClass)} />
      <div className="p-lg">
        <div className="mb-md flex items-start justify-between gap-md">
          <div
            className={cn(
              "flex size-12 items-center justify-center rounded-xl",
              iconBgClass,
              iconTextClass,
            )}
          >
            <Icon size={22} strokeWidth={1.5} />
          </div>
          <div className="flex gap-xs">
            {formats.map((format) => (
              <Badge key={format} variant="neutral">
                {format}
              </Badge>
            ))}
          </div>
        </div>
        <h3 className="font-display text-h3 lowercase text-ink">{title}</h3>
        <p className="mt-xs min-h-[44px] text-body-sm text-ink-tertiary">{description}</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="mx-md mb-md flex min-h-[150px] w-[calc(100%-32px)] flex-col items-center justify-center gap-md rounded-xl border-2 border-dashed border-line bg-base p-lg text-center transition hover:border-orange hover:bg-orange-soft disabled:pointer-events-none"
      >
        <div className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface shadow-sm-warm">
          <UploadCloud size={22} strokeWidth={1.5} className="text-ink-tertiary" />
        </div>
        <div>
          <p className="text-body-sm font-medium text-ink-secondary">Clique para selecionar</p>
          <p className="mt-xs text-meta text-ink-tertiary">ou arraste o arquivo aqui</p>
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          onFile(event.target.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
      />
    </article>
  );
}

function HistoryFilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-md first:border-t-0 first:pt-0">
      <p className="mb-xs px-xs text-label font-medium uppercase tracking-[0.08em] text-ink-tertiary">
        {label}
      </p>
      <div className="flex flex-col gap-xs">{children}</div>
    </div>
  );
}

function HistoryFilterButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 items-center justify-between rounded-lg px-sm text-body-sm transition",
        active ? "bg-orange-soft font-medium text-orange" : "text-ink-secondary hover:bg-sunken",
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-xs py-[1px] text-meta",
          active ? "bg-orange/15 text-orange" : "bg-sunken text-ink-tertiary",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function ImportStatCard({
  icon: Icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
  helper: string;
  tone: "success" | "warning" | "orange" | "danger";
}) {
  return (
    <article
      className={cn(
        "rounded-xl border border-line border-t-[3px] bg-surface p-md shadow-sm-warm",
        tone === "success" && "border-t-green",
        tone === "warning" && "border-t-beige",
        tone === "orange" && "border-t-orange",
        tone === "danger" && "border-t-danger",
      )}
    >
      <div className="mb-sm flex items-center justify-between gap-sm">
        <p className="text-label font-medium uppercase tracking-[0.07em] text-ink-tertiary">
          {label}
        </p>
        <Icon
          size={16}
          strokeWidth={1.5}
          className={cn(
            tone === "success" && "text-green-strong",
            tone === "warning" && "text-[#9F7E3D]",
            tone === "orange" && "text-orange",
            tone === "danger" && "text-danger",
          )}
        />
      </div>
      <p className="tnum font-display text-[26px] leading-none text-ink">{value}</p>
      <p className="mt-xs text-meta text-ink-tertiary">{helper}</p>
    </article>
  );
}

function ImportHistoryItem({
  item,
  account,
  onRestoreReview,
}: {
  item: ImportRow;
  account: Account | null;
  onRestoreReview: (importRow: ImportRow) => void;
}) {
  const statusTone = importStatusTone(item.status);
  const progress =
    item.total_rows > 0
      ? Math.min(100, Math.round((Math.max(item.imported_rows, 0) / item.total_rows) * 100))
      : item.status === "completed"
        ? 100
        : 0;

  return (
    <div className="flex flex-wrap items-center gap-md px-lg py-md transition hover:bg-base">
      <div
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          item.import_type === "pdf_invoice"
            ? "bg-orange-soft text-orange"
            : item.import_type === "ofx"
              ? "bg-green-soft text-green-strong"
              : "bg-beige-soft text-[#9F7E3D]",
        )}
      >
        {item.import_type === "pdf_invoice" ? (
          <CreditCard size={20} strokeWidth={1.5} />
        ) : item.import_type === "ofx" ? (
          <Landmark size={20} strokeWidth={1.5} />
        ) : (
          <FileSpreadsheet size={20} strokeWidth={1.5} />
        )}
      </div>

      <div className="min-w-[260px] flex-1">
        <div className="flex flex-wrap items-center gap-sm">
          <p className="truncate text-body-sm font-medium text-ink">{item.filename}</p>
          <Badge variant={statusTone}>{formatImportStatus(item.status)}</Badge>
          <Badge variant="neutral">{formatImportType(item.import_type)}</Badge>
        </div>
        <div className="mt-xs flex flex-wrap items-center gap-sm text-meta text-ink-tertiary">
          <span>{account?.name ?? "Conta não vinculada"}</span>
          <span>·</span>
          <span>{new Date(item.created_at).toLocaleString("pt-BR")}</span>
          {item.completed_at ? (
            <>
              <span>·</span>
              <span>concluída em {new Date(item.completed_at).toLocaleString("pt-BR")}</span>
            </>
          ) : null}
        </div>
        {item.error_message ? (
          <p className="mt-xs text-body-sm text-danger">{item.error_message}</p>
        ) : null}
      </div>

      <div className="grid min-w-[300px] grid-cols-3 gap-md">
        <MiniMetric label="Linhas" value={item.total_rows} />
        <MiniMetric label="Importadas" value={item.imported_rows} />
        <MiniMetric
          label="Duplicatas"
          value={item.duplicates_found}
          danger={item.duplicates_found > 0}
        />
      </div>

      <div className="min-w-[150px]">
        <div className="mb-xs flex items-center justify-between text-meta text-ink-tertiary">
          <span>Progresso</span>
          <span className="tnum">{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-sunken">
          <div
            className={cn(
              "h-full rounded-full",
              item.status === "failed"
                ? "bg-danger"
                : item.status === "reviewing"
                  ? "bg-beige"
                  : "bg-green",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="ml-auto flex min-w-[130px] justify-end">
        {item.status === "reviewing" ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onRestoreReview(item)}>
            Revisar
          </Button>
        ) : item.status === "completed" ? (
          <span className="inline-flex items-center gap-xs text-body-sm text-green-strong">
            <Check size={14} strokeWidth={2} />
            Confirmada
          </span>
        ) : item.status === "failed" ? (
          <span className="inline-flex items-center gap-xs text-body-sm text-danger">
            <XCircle size={14} strokeWidth={2} />
            Ver erro
          </span>
        ) : null}
      </div>
    </div>
  );
}

function MiniMetric({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div>
      <p className="text-meta text-ink-tertiary">{label}</p>
      <p className={cn("tnum text-body-sm font-medium text-ink", danger && "text-danger")}>
        {value}
      </p>
    </div>
  );
}

function ParseSummary({
  account,
  categories,
  result,
  rows,
  isPending,
  onConfirm,
  onRowsChange,
}: {
  account: Account | null;
  categories: Category[];
  result: ParseResponse;
  rows: ReviewRow[];
  isPending: boolean;
  onConfirm: () => void;
  onRowsChange: (rows: ReviewRow[]) => void;
}) {
  const [filter, setFilter] = useState<"all" | "pending" | "categorized" | "ignored">("all");
  const [query, setQuery] = useState("");
  const imported = rows.filter(
    (transaction) => !transaction.isDuplicate && !transaction.ignored,
  ).length;
  const ignored = rows.filter(
    (transaction) => transaction.ignored || transaction.isDuplicate,
  ).length;
  const categorized = rows.filter(
    (transaction) => !transaction.ignored && !transaction.isDuplicate && transaction.categoryId,
  ).length;
  const pending = rows.filter(
    (transaction) => !transaction.ignored && !transaction.isDuplicate && !transaction.categoryId,
  ).length;
  const progress = rows.length > 0 ? Math.round((categorized / rows.length) * 100) : 0;
  const confirmDisabled = imported === 0 || pending > 0 || isPending;
  const filteredRows = useMemo(
    () =>
      rows.filter((transaction) => {
        const matchesQuery = normalizeSearch(
          `${transaction.description} ${transaction.suggestedCategoryCode ?? ""} ${
            transaction.suggestedCategoryName ?? ""
          }`,
        ).includes(normalizeSearch(query));
        const status =
          transaction.ignored || transaction.isDuplicate
            ? "ignored"
            : transaction.categoryId
              ? "categorized"
              : "pending";

        return matchesQuery && (filter === "all" || status === filter);
      }),
    [filter, query, rows],
  );
  const formatDate = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  function setAllImported() {
    onRowsChange(rows.map((row) => ({ ...row, ignored: !!row.isDuplicate })));
  }

  return (
    <section className="flex flex-col gap-lg">
      <div className="overflow-hidden rounded-xl bg-[#463E37] text-white shadow-sm-warm">
        <div className="flex flex-wrap items-center gap-xl p-xl">
          <div className="flex size-[76px] shrink-0 items-center justify-center rounded-xl bg-orange/15 text-[#FFB05D]">
            {result.importType === "pdf_invoice" ? (
              <CreditCard size={34} strokeWidth={1.6} />
            ) : (
              <FileSpreadsheet size={34} strokeWidth={1.6} />
            )}
          </div>
          <div className="min-w-[260px] flex-1">
            <p className="text-label font-medium uppercase tracking-widest text-white/55">
              {result.importType === "pdf_invoice" ? "Fatura importada" : "Extrato importado"}
            </p>
            <h2 className="mt-xs font-display text-display-2 lowercase text-white">
              {result.filename}
            </h2>
            <div className="mt-md flex flex-wrap gap-lg">
              {result.invoice ? (
                <>
                  <Metric label="Fechamento" value={formatDate(result.invoice.closingDate)} />
                  <Metric label="Vencimento" value={formatDate(result.invoice.dueDate)} accent />
                  <Metric
                    label="Total da fatura"
                    value={formatMoney(Number(result.invoice.total))}
                  />
                  <Metric
                    label="Efeito caixa"
                    value={formatDate(result.invoice.dueDate)}
                    badge={account?.name ?? undefined}
                  />
                </>
              ) : (
                <>
                  <Metric label="Arquivo" value={result.importType.toUpperCase()} />
                  <Metric label="Linhas lidas" value={String(result.totalRows)} />
                  <Metric label="Duplicatas" value={String(result.duplicatesFound)} accent />
                  <Metric label="Conta" value={account?.name ?? "Selecionada"} />
                </>
              )}
            </div>
          </div>
          <div className="min-w-[260px]">
            <div className="mb-sm flex items-center justify-between gap-md">
              <span className="text-body-sm font-medium text-white/70">Categorização</span>
              <span className="tnum text-body-sm font-semibold text-[#FFB05D]">
                {categorized} / {rows.length}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/14">
              <div className="h-full rounded-full bg-orange" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-sm flex flex-wrap gap-sm text-body-sm text-white/60">
              <span>{categorized} categorizadas</span>
              <span>{pending} pendentes</span>
              <span>{ignored} ignoradas</span>
            </div>
          </div>
        </div>
      </div>

      {result.invoice ? (
        <div className="flex items-center gap-md rounded-lg border border-line bg-base px-lg py-md text-body-sm text-ink-secondary">
          <Info size={18} className="shrink-0 text-ink-tertiary" />
          <p>
            Cada compra será registrada pela data da compra, e o efeito no caixa ocorrerá em{" "}
            <strong className="text-ink">{formatDate(result.invoice.dueDate)}</strong>.
          </p>
        </div>
      ) : null}
      {result.warnings.length > 0 ? (
        <div className="mt-md rounded-lg bg-warning-soft px-md py-sm text-body-sm text-[#B8914E]">
          {result.warnings.slice(0, 3).join(" ")}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-md">
        <div className="flex rounded-lg bg-sunken p-xs">
          {[
            ["all", `Todas (${rows.length})`],
            ["pending", `Pendentes (${pending})`],
            ["categorized", `Categorizadas (${categorized})`],
            ["ignored", `Ignoradas (${ignored})`],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value as typeof filter)}
              className={cn(
                "rounded-md px-md py-sm text-body-sm font-medium text-ink-secondary transition",
                filter === value && "bg-surface text-ink shadow-sm-warm",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="relative min-w-[280px] flex-1 md:max-w-[420px]">
          <Search
            size={17}
            className="pointer-events-none absolute top-1/2 left-md -translate-y-1/2 text-ink-tertiary"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtrar transações..."
            className="h-11 w-full rounded-lg border border-line bg-surface pr-md pl-[42px] text-body-sm text-ink outline-none transition focus:border-orange focus:shadow-focus-orange"
          />
        </label>
        <div className="flex gap-sm">
          <Button type="button" variant="outline" size="lg" onClick={setAllImported}>
            <SquareCheck size={16} />
            Selecionar todas
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pending === 0}
            onClick={() => setFilter("pending")}
          >
            <Tag size={16} />
            Revisar pendentes
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm-warm">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              {[
                "",
                "Data compra",
                "Descrição original",
                "Categoria sugerida",
                "Confiança IA",
                "Valor",
                "Ações",
              ].map((header) => (
                <th
                  key={header || "check"}
                  className="border-b border-line bg-sunken px-sm py-sm text-left text-label font-medium uppercase text-ink-tertiary"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((transaction) => (
              <tr
                key={transaction.externalId ?? transaction.duplicateKey}
                className={cn(
                  "transition",
                  transaction.ignored || transaction.isDuplicate
                    ? "bg-sunken/70 opacity-60"
                    : transaction.categoryId
                      ? "bg-success-soft/35"
                      : "bg-danger-soft/20",
                )}
              >
                <td className="border-b border-line px-sm py-sm">
                  <input
                    type="checkbox"
                    checked={!transaction.ignored}
                    disabled={transaction.isDuplicate}
                    onChange={(event) =>
                      onRowsChange(
                        rows.map((row) =>
                          row.duplicateKey === transaction.duplicateKey
                            ? { ...row, ignored: !event.target.checked }
                            : row,
                        ),
                      )
                    }
                    className="size-4 accent-orange"
                  />
                </td>
                <td className="border-b border-line px-sm py-sm text-body-sm text-ink-secondary">
                  {formatDate(transaction.eventDate)}
                </td>
                <td className="max-w-[380px] border-b border-line px-sm py-sm text-body-sm text-ink">
                  <span className="block font-medium uppercase">{transaction.description}</span>
                  {transaction.isDuplicate ? <Badge variant="warning">duplicata</Badge> : null}
                  {result.invoice ? (
                    <span className="mt-xs inline-flex rounded-full border border-line bg-sunken px-sm py-xs text-meta text-ink-tertiary">
                      caixa: {formatDate(transaction.cashDate)}
                    </span>
                  ) : null}
                </td>
                <td className="border-b border-line px-sm py-sm text-body-sm text-ink-secondary">
                  <select
                    value={transaction.categoryId}
                    onChange={(event) =>
                      onRowsChange(
                        rows.map((row) =>
                          row.duplicateKey === transaction.duplicateKey
                            ? { ...row, categoryId: event.target.value }
                            : row,
                        ),
                      )
                    }
                    className={cn(
                      "min-w-[260px] max-w-[360px] rounded-md border bg-surface px-sm py-xs text-body-sm text-ink outline-none focus:border-orange focus:shadow-focus-orange",
                      transaction.categoryId ? "border-line" : "border-danger/60",
                    )}
                  >
                    <option value="">Selecione uma categoria</option>
                    {categories
                      .filter(
                        (category) =>
                          category.is_active &&
                          category.nature === transaction.type &&
                          !categories.some((child) => child.parent_id === category.id),
                      )
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </select>
                  {!transaction.categoryId ? (
                    <p className="mt-xs text-meta text-danger">IA não conseguiu categorizar</p>
                  ) : transaction.suggestedCategoryCode ? (
                    <p className="mt-xs text-meta text-ink-tertiary">
                      IA sugeriu: {transaction.suggestedCategoryName}
                    </p>
                  ) : null}
                </td>
                <td className="border-b border-line px-sm py-sm">
                  <Badge
                    variant={
                      transaction.aiConfidence >= 0.7
                        ? "success"
                        : transaction.aiConfidence >= 0.5
                          ? "warning"
                          : "danger"
                    }
                  >
                    {transaction.aiConfidence >= 0.7
                      ? "Alta"
                      : transaction.aiConfidence >= 0.5
                        ? "Média"
                        : "Baixa"}
                  </Badge>
                </td>
                <td
                  className={cn(
                    "tnum border-b border-line px-sm py-sm text-right text-body-sm font-medium",
                    transaction.type === "income" ? "text-success" : "text-danger",
                  )}
                >
                  {transaction.type === "income" ? "+" : "-"}R${" "}
                  {Number(transaction.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </td>
                <td className="border-b border-line px-sm py-sm">
                  <div className="flex justify-end gap-sm">
                    <button
                      type="button"
                      onClick={() =>
                        onRowsChange(
                          rows.map((row) =>
                            row.duplicateKey === transaction.duplicateKey
                              ? { ...row, ignored: false }
                              : row,
                          ),
                        )
                      }
                      className="text-success transition hover:text-green"
                      aria-label="Incluir lançamento"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onRowsChange(
                          rows.map((row) =>
                            row.duplicateKey === transaction.duplicateKey
                              ? { ...row, ignored: !row.ignored }
                              : row,
                          ),
                        )
                      }
                      className="text-ink-tertiary transition hover:text-danger"
                      aria-label={
                        transaction.ignored ? "Restaurar lançamento" : "Ignorar lançamento"
                      }
                    >
                      {transaction.ignored ? <RotateCcw size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 ? (
          <div className="px-lg py-xl text-center text-body-sm text-ink-tertiary">
            Nenhuma transação encontrada para este filtro.
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-md">
        <p className="text-body-sm text-ink-tertiary">
          {pending > 0
            ? `${pending} lançamentos ativos ainda precisam de categoria.`
            : `${imported} lançamentos serão importados. Duplicatas ficam ignoradas por padrão.`}
        </p>
        <Button type="button" disabled={confirmDisabled} onClick={onConfirm}>
          Confirmar {imported} lançamentos
        </Button>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  accent,
  badge,
}: {
  label: string;
  value: string;
  accent?: boolean;
  badge?: string;
}) {
  return (
    <div className="border-white/15 pr-lg not-last:border-r">
      <p className="text-label font-medium uppercase tracking-widest text-white/45">{label}</p>
      <div className="mt-xs flex items-center gap-sm">
        <span className={cn("text-h3 font-semibold text-white", accent && "text-[#FFB05D]")}>
          {value}
        </span>
        {badge ? (
          <span className="rounded-sm border border-success/50 bg-success-soft/20 px-sm py-xs text-label font-medium uppercase text-[#B5C8A2]">
            {badge}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function formatImportType(type: string): string {
  const labels: Record<string, string> = {
    csv: "CSV",
    ofx: "OFX",
    pdf_invoice: "Fatura PDF",
  };

  return labels[type] ?? type;
}

function formatImportStatus(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pendente",
    parsing: "Processando",
    reviewing: "Em revisão",
    completed: "Concluída",
    failed: "Falhou",
  };

  return labels[status] ?? status;
}

function importStatusTone(status: string): "success" | "danger" | "warning" | "neutral" {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "reviewing" || status === "parsing" || status === "pending") return "warning";
  return "neutral";
}

function buildImportStats(imports: ImportRow[]) {
  return imports.reduce(
    (stats, item) => {
      if (item.status === "completed") stats.completed += 1;
      if (item.status === "reviewing") stats.reviewing += 1;
      if (item.status === "failed") stats.failed += 1;
      if (item.import_type === "ofx") stats.ofx += 1;
      if (item.import_type === "csv") stats.csv += 1;
      if (item.import_type === "pdf_invoice") stats.pdfInvoice += 1;
      stats.duplicates += item.duplicates_found;
      stats.importedRows += item.imported_rows;
      return stats;
    },
    {
      completed: 0,
      reviewing: 0,
      failed: 0,
      ofx: 0,
      csv: 0,
      pdfInvoice: 0,
      duplicates: 0,
      importedRows: 0,
    },
  );
}

function parseReviewPayload(payload: unknown): ReviewPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<ReviewPayload>;

  if (
    typeof candidate.filename !== "string" ||
    !["csv", "ofx", "pdf_invoice"].includes(String(candidate.importType)) ||
    !Array.isArray(candidate.transactions)
  ) {
    return null;
  }

  return candidate as ReviewPayload;
}
