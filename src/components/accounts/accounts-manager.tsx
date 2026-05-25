"use client";

import {
  Banknote,
  Building2,
  Check,
  CreditCard,
  MoreHorizontal,
  Pencil,
  PiggyBank,
  Plus,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { type AccountActionResult, type AccountInput, saveAccount } from "@/actions/accounts";
import { MoneyDisplay } from "@/components/money/money-display";
import { MoneyInput } from "@/components/money/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/date";
import type { Tables } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type Account = Tables<"accounts">;
type Transaction = Tables<"transactions">;
type AccountType = AccountInput["type"];

const ACCOUNT_TYPES: Array<{ type: AccountType; label: string; icon: typeof Building2 }> = [
  { type: "checking", label: "Conta Corrente", icon: Building2 },
  { type: "savings", label: "Poupança", icon: PiggyBank },
  { type: "cash", label: "Caixa Físico", icon: Banknote },
  { type: "credit_card", label: "Cartão", icon: CreditCard },
];

const COLORS = [
  "#F08353",
  "#F6A958",
  "#D2B06E",
  "#EAD7AC",
  "#ACC095",
  "#7A9264",
  "#6B635B",
  "#C85A3E",
  "#3A3530",
];

export function AccountsManager({
  accounts,
  transactions,
}: {
  accounts: Account[];
  transactions: Transaction[];
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<AccountInput>(() => emptyAccount("checking"));
  const [notice, setNotice] = useState<AccountActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const bankAccounts = accounts.filter((account) => account.type !== "credit_card");
  const creditCards = accounts.filter((account) => account.type === "credit_card");
  const paymentAccounts = accounts.filter(
    (account) => account.type !== "credit_card" && account.is_active,
  );

  const summary = useMemo(() => {
    const bankTotal = bankAccounts.reduce(
      (sum, account) => sum + getAccountBalance(account, transactions),
      0,
    );
    const openInvoices = 0;
    return { bankTotal, openInvoices, net: bankTotal - openInvoices };
  }, [bankAccounts, transactions]);

  function openNew(type: AccountType) {
    setDraft(emptyAccount(type));
    setNotice(null);
    setModalOpen(true);
  }

  function openEdit(account: Account) {
    setDraft({
      id: account.id,
      name: account.name,
      type: account.type as AccountType,
      bank_name: account.bank_name ?? "",
      color: account.color ?? "#F08353",
      opening_balance: String(account.opening_balance ?? 0),
      opening_balance_date: account.opening_balance_date ?? "",
      credit_limit: account.credit_limit ? String(account.credit_limit) : "0.00",
      closing_day: account.closing_day,
      due_day: account.due_day,
      default_payment_account_id: account.default_payment_account_id,
      is_active: account.is_active,
    });
    setNotice(null);
    setModalOpen(true);
  }

  function persist() {
    startTransition(async () => {
      const result = await saveAccount(draft);
      setNotice(result);
      if (result.ok) {
        setModalOpen(false);
      }
    });
  }

  return (
    <>
      <div className="grid gap-md lg:grid-cols-3">
        <SummaryCard
          label="Saldo em contas"
          value={summary.bankTotal}
          hint={`${bankAccounts.length} contas bancárias ativas`}
          tone="success"
        />
        <SummaryCard
          label="Fatura em aberto"
          value={summary.openInvoices}
          hint={`${creditCards.length} cartões · faturas na Etapa 7`}
          tone="danger"
        />
        <SummaryCard
          label="Posição líquida"
          value={summary.net}
          hint="saldo - faturas em aberto"
          tone="neutral"
        />
      </div>

      {notice && !modalOpen ? (
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

      <section className="mt-xl">
        <SectionLabel>Contas bancárias</SectionLabel>
        <div className="grid gap-lg xl:grid-cols-3">
          {bankAccounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              balance={getAccountBalance(account, transactions)}
              transactionCount={getAccountTransactions(account, transactions).length}
              onEdit={() => openEdit(account)}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-lg"
          onClick={() => openNew("checking")}
        >
          <Plus size={15} strokeWidth={2} />
          Nova conta bancária
        </Button>
      </section>

      <section className="mt-xl">
        <SectionLabel>Cartões de crédito</SectionLabel>
        <div className="grid gap-lg xl:grid-cols-2">
          {creditCards.map((account) => (
            <CreditCardPanel
              key={account.id}
              account={account}
              paymentAccount={accounts.find(
                (item) => item.id === account.default_payment_account_id,
              )}
              onEdit={() => openEdit(account)}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-lg"
          onClick={() => openNew("credit_card")}
        >
          <Plus size={15} strokeWidth={2} />
          Novo cartão de crédito
        </Button>
      </section>

      {modalOpen ? (
        <AccountModal
          draft={draft}
          paymentAccounts={paymentAccounts}
          notice={notice}
          isPending={isPending}
          onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
          onClose={() => setModalOpen(false)}
          onSave={persist}
        />
      ) : null}
    </>
  );
}

function AccountCard({
  account,
  balance,
  transactionCount,
  onEdit,
}: {
  account: Account;
  balance: number;
  transactionCount: number;
  onEdit: () => void;
}) {
  const Icon =
    account.type === "cash" ? Banknote : account.type === "savings" ? PiggyBank : Building2;
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm-warm transition hover:-translate-y-0.5 hover:shadow-lg-warm">
      <div className="h-[5px]" style={{ background: account.color ?? "#F08353" }} />
      <div className="p-lg">
        <div className="mb-lg flex items-start justify-between gap-md">
          <div className="flex items-center gap-md">
            <div className="flex size-11 items-center justify-center rounded-xl bg-orange-soft text-orange">
              <Icon size={22} strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-body font-medium text-ink">{account.name}</h3>
              <p className="text-body-sm text-ink-tertiary">{accountTypeLabel(account.type)}</p>
            </div>
          </div>
          <CardActions onEdit={onEdit} />
        </div>
        <div className="rounded-xl bg-[#F7F5F2] p-md text-center">
          <p className="mb-xs text-label uppercase text-ink-tertiary">Saldo atual</p>
          <MoneyDisplay value={balance} size="display" className="text-[32px]" />
        </div>
        <div className="mt-lg grid grid-cols-2 gap-md">
          <Stat
            label="Saldo inicial"
            value={<MoneyDisplay value={account.opening_balance} colored={false} />}
          />
          <Stat
            label="Início em"
            value={account.opening_balance_date ? formatDate(account.opening_balance_date) : "—"}
          />
          <Stat label="Lançamentos" value={`${transactionCount} no período`} />
          <Stat label="Último movimento" value="—" />
        </div>
        <div className="my-lg h-px bg-[#F0EEE9]" />
        <div className="flex gap-sm">
          <Button type="button" variant="ghost" className="flex-1 border border-line text-body-sm">
            <Wallet size={13} strokeWidth={1.5} />
            Ver lançamentos
          </Button>
          <Button type="button" variant="ghost" className="flex-1 border border-line text-body-sm">
            <Upload size={13} strokeWidth={1.5} />
            Importar extrato
          </Button>
        </div>
      </div>
    </article>
  );
}

function CreditCardPanel({
  account,
  paymentAccount,
  onEdit,
}: {
  account: Account;
  paymentAccount?: Account;
  onEdit: () => void;
}) {
  const limit = Number(account.credit_limit || 0);
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm-warm">
      <div className="h-[5px] bg-ink" />
      <div className="p-lg">
        <div className="mb-lg flex items-start justify-between gap-md">
          <div className="flex items-center gap-md">
            <div className="flex size-11 items-center justify-center rounded-xl bg-ink text-tangerine">
              <CreditCard size={22} strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-body font-medium text-ink">{account.name}</h3>
              <p className="text-body-sm text-ink-tertiary">Cartão de Crédito</p>
            </div>
          </div>
          <CardActions onEdit={onEdit} />
        </div>
        <div className="rounded-xl bg-ink p-lg text-surface">
          <div className="grid grid-cols-3 gap-md">
            <DarkStat label="Fatura aberta" value="R$ 0,00" tone="warning" />
            <DarkStat label="Fatura anterior" value="—" />
            <DarkStat
              label="Limite disponível"
              value={limit ? <MoneyDisplay value={limit} colored={false} /> : "—"}
              tone="success"
            />
          </div>
          <div className="mt-md">
            <div className="mb-xs flex justify-between text-meta text-surface/50">
              <span>Limite usado: 0%</span>
              <span>
                Limite total:{" "}
                {limit ? (
                  <MoneyDisplay
                    value={limit}
                    colored={false}
                    size="sm"
                    className="text-surface/50"
                  />
                ) : (
                  "—"
                )}
              </span>
            </div>
            <div className="h-1 rounded-full bg-surface/15">
              <div className="h-full w-0 rounded-full bg-tangerine" />
            </div>
          </div>
        </div>
        <div className="mt-lg grid grid-cols-4 gap-md">
          <Stat
            label="Fechamento"
            value={account.closing_day ? `Dia ${account.closing_day}` : "—"}
          />
          <Stat label="Vencimento" value={account.due_day ? `Dia ${account.due_day}` : "—"} />
          <Stat label="Paga por" value={paymentAccount?.name ?? "—"} />
          <Stat label="Compras" value="Etapa 7" />
        </div>
      </div>
    </article>
  );
}

function AccountModal({
  draft,
  paymentAccounts,
  notice,
  isPending,
  onChange,
  onClose,
  onSave,
}: {
  draft: AccountInput;
  paymentAccounts: Account[];
  notice: AccountActionResult | null;
  isPending: boolean;
  onChange: (patch: Partial<AccountInput>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const isCreditCard = draft.type === "credit_card";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-lg backdrop-blur-[2px]">
      <div className="flex max-h-[90vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[20px] bg-surface shadow-[0_24px_64px_rgba(58,53,48,.18),0_4px_16px_rgba(58,53,48,.08)]">
        <div className="p-xl pb-md">
          <div className="mb-lg flex items-start justify-between">
            <div>
              <h2 className="font-display text-h2 lowercase text-ink">
                {draft.id ? "editar conta" : "nova conta"}
              </h2>
              <p className="mt-xs text-body-sm text-ink-tertiary">
                {draft.name || "Configure os dados principais"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-md bg-sunken text-ink-secondary"
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-xs rounded-xl bg-sunken p-xs sm:grid-cols-4">
            {ACCOUNT_TYPES.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => onChange({ type: item.type })}
                className={cn(
                  "flex items-center justify-center gap-xs rounded-lg px-sm py-[9px] text-body-sm font-medium text-ink-tertiary",
                  draft.type === item.type && "bg-surface text-orange shadow-sm-warm",
                )}
              >
                <item.icon size={15} strokeWidth={1.5} />
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-xl pb-lg">
          <div className="grid grid-cols-2 gap-md">
            <Field label="Nome da conta">
              <Input
                value={draft.name}
                onChange={(event) => onChange({ name: event.target.value })}
              />
            </Field>
            <Field label="Banco / Bandeira">
              <Input
                value={draft.bank_name ?? ""}
                onChange={(event) => onChange({ bank_name: event.target.value })}
                placeholder="Itaú, Nubank..."
              />
            </Field>
          </div>
          <div className="mt-md grid grid-cols-2 gap-md">
            <Field label={isCreditCard ? "Referência inicial" : "Saldo inicial"}>
              <MoneyInput
                value={draft.opening_balance}
                onValueChange={(value) => onChange({ opening_balance: value })}
              />
            </Field>
            <Field label="Data de início">
              <Input
                type="date"
                value={draft.opening_balance_date ?? ""}
                onChange={(event) => onChange({ opening_balance_date: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Cor de identificação" className="mt-md">
            <div className="flex flex-wrap gap-sm">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Selecionar cor ${color}`}
                  onClick={() => onChange({ color })}
                  className={cn(
                    "size-9 rounded-full border-[2.5px] border-transparent transition hover:scale-105",
                    draft.color === color && "scale-110 border-ink",
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </Field>
          {isCreditCard ? (
            <div className="mt-lg border-t border-line pt-lg">
              <p className="mb-md text-label uppercase text-ink-tertiary">
                Configurações do cartão
              </p>
              <div className="grid grid-cols-2 gap-md">
                <Field label="Limite total">
                  <MoneyInput
                    value={draft.credit_limit ?? "0.00"}
                    onValueChange={(value) => onChange({ credit_limit: value })}
                  />
                </Field>
                <Field label="Conta de pagamento">
                  <select
                    value={draft.default_payment_account_id ?? ""}
                    onChange={(event) =>
                      onChange({ default_payment_account_id: event.target.value || null })
                    }
                    className="w-full rounded-lg border border-line bg-surface px-md py-[10px] text-body text-ink focus:border-orange focus:shadow-focus-orange focus:outline-none"
                  >
                    <option value="">Selecione</option>
                    {paymentAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Dia de fechamento">
                  <DaySelect
                    value={draft.closing_day}
                    onChange={(value) => onChange({ closing_day: value })}
                  />
                </Field>
                <Field label="Dia de vencimento">
                  <DaySelect
                    value={draft.due_day}
                    onChange={(value) => onChange({ due_day: value })}
                  />
                </Field>
              </div>
            </div>
          ) : null}
          <div className="mt-lg flex items-center justify-between border-t border-line pt-md">
            <div>
              <p className="text-body font-medium text-ink">Conta ativa</p>
              <p className="text-body-sm text-ink-tertiary">
                Contas inativas não aparecem nas seleções de lançamentos
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChange({ is_active: !draft.is_active })}
              className={cn(
                "relative h-[23px] w-[42px] rounded-full",
                draft.is_active ? "bg-orange" : "bg-line-strong",
              )}
            >
              <span
                className={cn(
                  "absolute top-[3px] size-[17px] rounded-full bg-surface shadow-sm transition-all",
                  draft.is_active ? "left-[22px]" : "left-[3px]",
                )}
              />
            </button>
          </div>
          {notice ? (
            <div
              className={cn(
                "mt-md rounded-lg border px-md py-sm text-body-sm",
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
            Salvar alterações
          </Button>
          <Button type="button" variant="ghost" className="border border-line" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

function emptyAccount(type: AccountType): AccountInput {
  return {
    name: "",
    type,
    bank_name: "",
    color: "#F08353",
    opening_balance: "0.00",
    opening_balance_date: new Date().toISOString().slice(0, 10),
    credit_limit: "0.00",
    closing_day: type === "credit_card" ? 5 : null,
    due_day: type === "credit_card" ? 10 : null,
    default_payment_account_id: null,
    is_active: true,
  };
}

function accountTypeLabel(type: string) {
  return type === "checking"
    ? "Conta Corrente"
    : type === "savings"
      ? "Poupança"
      : type === "cash"
        ? "Caixa Físico"
        : "Cartão de Crédito";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-md flex items-center gap-md text-label font-medium uppercase text-ink-tertiary after:h-px after:flex-1 after:bg-line">
      {children}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "success" | "danger" | "neutral";
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-lg shadow-sm-warm">
      <p className="mb-sm text-label uppercase text-ink-tertiary">{label}</p>
      <MoneyDisplay
        value={value}
        size="display"
        colored={tone !== "neutral"}
        className={cn(tone === "neutral" && "text-ink")}
      />
      <p className="mt-xs text-body-sm text-ink-tertiary">{hint}</p>
    </div>
  );
}

function CardActions({ onEdit }: { onEdit: () => void }) {
  return (
    <div className="flex gap-xs">
      <button
        type="button"
        aria-label="Editar"
        onClick={onEdit}
        className="flex size-8 items-center justify-center rounded-md text-ink-tertiary hover:bg-sunken hover:text-ink-secondary"
      >
        <Pencil size={15} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        aria-label="Mais ações"
        className="flex size-8 items-center justify-center rounded-md text-ink-tertiary hover:bg-sunken hover:text-ink-secondary"
      >
        <MoreHorizontal size={15} strokeWidth={1.5} />
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[2px]">
      <span className="text-meta font-medium uppercase tracking-[0.07em] text-ink-tertiary">
        {label}
      </span>
      <span className="text-body-sm font-medium text-ink">{value}</span>
    </div>
  );
}

function DarkStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "success" | "warning";
}) {
  return (
    <div>
      <p className="mb-xs text-[10px] uppercase tracking-[0.08em] text-surface/45">{label}</p>
      <div
        className={cn(
          "text-body font-medium text-surface/70",
          tone === "success" && "text-green",
          tone === "warning" && "text-tangerine",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-xs", className)}>
      <span className="text-label font-medium uppercase text-ink-secondary">{label}</span>
      {children}
    </div>
  );
}

function DaySelect({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
      className="w-full rounded-lg border border-line bg-surface px-md py-[10px] text-body text-ink focus:border-orange focus:shadow-focus-orange focus:outline-none"
    >
      <option value="">Selecione</option>
      {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
        <option key={day} value={day}>
          {String(day).padStart(2, "0")}
        </option>
      ))}
    </select>
  );
}

function getAccountTransactions(account: Account, transactions: Transaction[]): Transaction[] {
  return transactions.filter((transaction) => transaction.account_id === account.id);
}

function getAccountBalance(account: Account, transactions: Transaction[]): number {
  return getAccountTransactions(account, transactions).reduce(
    (balance, transaction) => {
      if (transaction.status !== "cleared") {
        return balance;
      }
      if (transaction.type === "income") {
        return balance + Number(transaction.amount);
      }
      if (transaction.type === "expense") {
        return balance - Number(transaction.amount);
      }
      return transaction.transfer_direction === "in"
        ? balance + Number(transaction.amount)
        : balance - Number(transaction.amount);
    },
    Number(account.opening_balance || 0),
  );
}
