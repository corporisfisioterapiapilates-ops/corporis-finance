import { addDays, differenceInCalendarDays, endOfMonth, format, startOfDay } from "date-fns";
import { Decimal } from "decimal.js";

import {
  type BudgetActualAccount,
  type BudgetActualTransaction,
  type BudgetActualValue,
  calculateBudgetVsActual,
} from "@/lib/dfc/budget-vs-actual";
import {
  calculateCashProjection,
  type ProjectionAccount,
  type ProjectionTransaction,
} from "@/lib/dfc/projection";
import { formatBRL } from "@/lib/money";
import type { Json, TablesInsert } from "@/lib/supabase/types";

export const NOTIFICATION_DUE_WINDOWS = [7, 3, 1] as const;
export const BUDGET_VARIANCE_THRESHOLD = 10;
export const CASH_MINIMUM_BALANCE = "15000";

export type NotificationType =
  | "invoice_due"
  | "pending_transaction_due"
  | "budget_overrun"
  | "cash_risk"
  | "import_review"
  | "import_failed";

export type NotificationSeverity = "info" | "warning" | "danger";

export type GeneratedNotification = Omit<
  TablesInsert<"notifications">,
  "id" | "created_at" | "read_at" | "dismissed_at"
> & {
  type: NotificationType;
  severity: NotificationSeverity;
};

export type NotificationInvoice = {
  id: string;
  organization_id: string;
  due_date: string;
  status: string;
  total_amount: number | string;
  accounts?: { name: string | null } | null;
};

export type NotificationTransaction = {
  id: string;
  organization_id: string;
  cash_date: string;
  status: string;
  type: string;
  amount: number | string;
  description: string;
};

export type NotificationImport = {
  id: string;
  organization_id: string;
  filename: string;
  status: string;
  error_message: string | null;
};

export type GenerateNotificationsInput = {
  organizationId: string;
  today?: Date;
  invoices?: NotificationInvoice[];
  transactions?: NotificationTransaction[];
  imports?: NotificationImport[];
  budget?: {
    monthKey: string;
    accounts: BudgetActualAccount[];
    budgetValues: BudgetActualValue[];
    transactions: BudgetActualTransaction[];
  };
  projection?: {
    accounts: ProjectionAccount[];
    transactions: ProjectionTransaction[];
  };
};

export function generateNotifications({
  organizationId,
  today = new Date(),
  invoices = [],
  transactions = [],
  imports = [],
  budget,
  projection,
}: GenerateNotificationsInput): GeneratedNotification[] {
  const todayStart = startOfDay(today);
  const generated: GeneratedNotification[] = [];

  for (const invoice of invoices) {
    const days = daysUntil(invoice.due_date, todayStart);
    if (!isDueWindow(days) || !["open", "closed", "partially_paid"].includes(invoice.status)) {
      continue;
    }

    const accountName = invoice.accounts?.name?.trim() || "cartão";
    generated.push({
      organization_id: organizationId,
      user_id: null,
      type: "invoice_due",
      severity: days <= 1 ? "danger" : "warning",
      title: days === 1 ? "Fatura vence amanhã" : `Fatura vence em ${days} dias`,
      body: `${accountName}: ${formatBRL(invoice.total_amount)} com vencimento em ${formatDate(invoice.due_date)}.`,
      action_label: "Ver lançamentos",
      action_href: "/lancamentos",
      dedupe_key: `invoice_due:${invoice.id}:${days}`,
      expires_at: expiresAfter(invoice.due_date),
      metadata: {
        invoice_id: invoice.id,
        due_date: invoice.due_date,
        days_until_due: days,
        amount: String(invoice.total_amount),
      },
    });
  }

  for (const transaction of transactions) {
    const days = daysUntil(transaction.cash_date, todayStart);
    if (!isDueWindow(days) || transaction.status !== "pending") continue;

    generated.push({
      organization_id: organizationId,
      user_id: null,
      type: "pending_transaction_due",
      severity: days <= 1 ? "danger" : "warning",
      title:
        days === 1
          ? "Lançamento pendente vence amanhã"
          : `Lançamento pendente vence em ${days} dias`,
      body: `${transaction.description}: ${formatBRL(transaction.amount)} em ${formatDate(transaction.cash_date)}.`,
      action_label: "Ver lançamentos",
      action_href: "/lancamentos",
      dedupe_key: `pending_transaction_due:${transaction.id}:${days}`,
      expires_at: expiresAfter(transaction.cash_date),
      metadata: {
        transaction_id: transaction.id,
        cash_date: transaction.cash_date,
        days_until_due: days,
        amount: String(transaction.amount),
        transaction_type: transaction.type,
      },
    });
  }

  for (const importRow of imports) {
    if (importRow.status === "reviewing") {
      generated.push({
        organization_id: organizationId,
        user_id: null,
        type: "import_review",
        severity: "info",
        title: "Importação aguardando revisão",
        body: `${importRow.filename} está pronta para conciliação.`,
        action_label: "Revisar importação",
        action_href: "/importacoes",
        dedupe_key: `import_review:${importRow.id}`,
        expires_at: null,
        metadata: { import_id: importRow.id, filename: importRow.filename },
      });
    }

    if (importRow.status === "failed") {
      generated.push({
        organization_id: organizationId,
        user_id: null,
        type: "import_failed",
        severity: "danger",
        title: "Importação com falha",
        body: `${importRow.filename}: ${importRow.error_message || "verifique o arquivo e tente novamente."}`,
        action_label: "Ver importações",
        action_href: "/importacoes",
        dedupe_key: `import_failed:${importRow.id}`,
        expires_at: null,
        metadata: {
          import_id: importRow.id,
          filename: importRow.filename,
          error_message: importRow.error_message,
        },
      });
    }
  }

  if (budget) {
    const comparison = calculateBudgetVsActual({
      accounts: budget.accounts,
      budgetValues: budget.budgetValues,
      transactions: budget.transactions,
      monthKey: budget.monthKey,
    });

    for (const row of comparison.alertRows.filter(
      (item) => item.favorable === false && Math.abs(Number(item.variancePercent ?? 0)) > 10,
    )) {
      generated.push({
        organization_id: organizationId,
        user_id: null,
        type: "budget_overrun",
        severity: "warning",
        title: "Orçamento estourado",
        body: `${row.name} está ${Math.abs(Number(row.variancePercent)).toFixed(0)}% acima do previsto no mês.`,
        action_label: "Ver orçamento",
        action_href: `/orcamento?month=${budget.monthKey}`,
        dedupe_key: `budget_overrun:${budget.monthKey}:${row.id}`,
        expires_at: endOfMonth(new Date(`${budget.monthKey}-01T12:00:00`)).toISOString(),
        metadata: {
          month: budget.monthKey,
          chart_account_id: row.id,
          variance: row.variance,
          variance_percent: row.variancePercent,
        },
      });
    }
  }

  if (projection) {
    const summary = calculateCashProjection({
      accounts: projection.accounts,
      transactions: projection.transactions,
      today,
      minimumBalance: CASH_MINIMUM_BALANCE,
      scenario: "realistic",
    });
    if (new Decimal(summary.minProjectedBalance).lt(CASH_MINIMUM_BALANCE)) {
      generated.push({
        organization_id: organizationId,
        user_id: null,
        type: "cash_risk",
        severity: "danger",
        title: "Risco de caixa projetado",
        body: `Saldo mínimo projetado de ${formatBRL(summary.minProjectedBalance)} em ${formatDate(summary.minProjectedDate)}.`,
        action_label: "Ver projeção",
        action_href: "/projecao",
        dedupe_key: `cash_risk:${summary.minProjectedDate}`,
        expires_at: addDays(todayStart, 1).toISOString(),
        metadata: {
          min_projected_balance: summary.minProjectedBalance,
          min_projected_date: summary.minProjectedDate,
          minimum_balance: summary.minimumBalance,
        },
      });
    }
  }

  return generated.map((notification) => ({
    ...notification,
    metadata: notification.metadata as Json,
  }));
}

function isDueWindow(days: number): days is (typeof NOTIFICATION_DUE_WINDOWS)[number] {
  return NOTIFICATION_DUE_WINDOWS.includes(days as (typeof NOTIFICATION_DUE_WINDOWS)[number]);
}

function daysUntil(date: string, today: Date) {
  return differenceInCalendarDays(new Date(`${date}T12:00:00`), today);
}

function expiresAfter(date: string) {
  return addDays(new Date(`${date}T12:00:00`), 1).toISOString();
}

function formatDate(date: string) {
  return format(new Date(`${date}T12:00:00`), "dd/MM/yyyy");
}
