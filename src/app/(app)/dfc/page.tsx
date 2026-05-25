import { Decimal } from "decimal.js";

import { DFCManager, type DFCPeriodMode } from "@/components/dfc/dfc-manager";
import { calculateDFC, toVerticalAnalysis } from "@/lib/dfc";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

type DFCPageProps = {
  searchParams?: Promise<{ mode?: string | string[]; year?: string | string[] }>;
};

type Account = Tables<"accounts">;
type Transaction = Tables<"transactions">;

export default async function DFCPage({ searchParams }: DFCPageProps) {
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const selectedYearParam = Array.isArray(params?.year) ? params?.year[0] : params?.year;
  const selectedModeParam = Array.isArray(params?.mode) ? params?.mode[0] : params?.mode;
  const selectedYear = Number(selectedYearParam) || currentYear;
  const selectedMode = parseMode(selectedModeParam);
  const period = getPeriod(selectedYear, selectedMode);
  const supabase = await createClient();
  const [
    { data: transactions, error: transactionsError },
    { data: chartOfAccounts, error: chartError },
    { data: accounts, error: accountsError },
  ] = await Promise.all([
    supabase.from("transactions").select("*").order("cash_date", { ascending: true }),
    supabase.from("chart_of_accounts").select("*").order("display_order", { ascending: true }),
    supabase.from("accounts").select("*").order("created_at", { ascending: true }),
  ]);

  const loadError = transactionsError || chartError || accountsError;
  const safeTransactions = transactions ?? [];
  const safeAccounts = accounts ?? [];
  const result = calculateDFC(
    safeTransactions,
    {
      start: period.start,
      months: period.months,
      openingBalance: calculateOpeningBalance(safeAccounts, safeTransactions, period.start),
    },
    chartOfAccounts ?? [],
  );

  return (
    <div className="flex flex-col gap-lg">
      {loadError ? (
        <div className="rounded-lg border border-danger/30 bg-danger-soft px-md py-sm text-body-sm text-danger">
          Não foi possível carregar o DFC agora. Tente novamente em instantes.
        </div>
      ) : null}
      <DFCManager
        result={result}
        verticalResult={toVerticalAnalysis(result)}
        selectedYear={selectedYear}
        selectedMode={selectedMode}
        availableYears={getAvailableYears(safeTransactions, selectedYear, currentYear)}
      />
    </div>
  );
}

function parseMode(mode?: string): DFCPeriodMode {
  return mode === "mensal" || mode === "trimestral" || mode === "custom" ? mode : "anual";
}

function getPeriod(year: number, mode: DFCPeriodMode): { start: string; months: number } {
  const now = new Date();
  const baseMonth = year === now.getFullYear() ? now.getMonth() : 11;

  if (mode === "mensal") {
    return { start: `${year}-${String(baseMonth + 1).padStart(2, "0")}-01`, months: 1 };
  }

  if (mode === "trimestral") {
    const quarterStartMonth = Math.floor(baseMonth / 3) * 3;
    return { start: `${year}-${String(quarterStartMonth + 1).padStart(2, "0")}-01`, months: 3 };
  }

  if (mode === "custom") {
    const startMonth = Math.max(0, baseMonth - 5);
    return {
      start: `${year}-${String(startMonth + 1).padStart(2, "0")}-01`,
      months: baseMonth - startMonth + 1,
    };
  }

  return { start: `${year}-01-01`, months: 12 };
}

function calculateOpeningBalance(
  accounts: Account[],
  transactions: Transaction[],
  periodStart: string,
): string {
  const bankAccountIds = new Set(
    accounts
      .filter((account) => account.is_active && account.type !== "credit_card")
      .map((account) => account.id),
  );
  let balance = accounts
    .filter((account) => bankAccountIds.has(account.id))
    .reduce((sum, account) => sum.plus(account.opening_balance ?? 0), new Decimal(0));

  for (const transaction of transactions) {
    if (
      transaction.status !== "cleared" ||
      transaction.cash_date >= periodStart ||
      !bankAccountIds.has(transaction.account_id)
    ) {
      continue;
    }

    if (transaction.type === "income") {
      balance = balance.plus(transaction.amount);
    } else if (transaction.type === "expense") {
      balance = balance.minus(transaction.amount);
    } else if (transaction.type === "transfer") {
      balance =
        transaction.transfer_direction === "in"
          ? balance.plus(transaction.amount)
          : balance.minus(transaction.amount);
    }
  }

  return balance.toFixed(2);
}

function getAvailableYears(
  transactions: Transaction[],
  selectedYear: number,
  currentYear: number,
): number[] {
  const years = new Set<number>([selectedYear, currentYear]);
  for (const transaction of transactions) {
    const year = Number(transaction.cash_date.slice(0, 4));
    if (year) {
      years.add(year);
    }
  }
  return [...years].sort((a, b) => b - a);
}
