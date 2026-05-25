import type { Tables } from "@/lib/supabase/types";

export type ChartAccount = Tables<"chart_of_accounts">;

export type ChartAccountNature = "income" | "expense" | "transfer" | "calculated";
export type DfcGroup = "operational" | "non_operational" | "investment" | "financing";
export type CostClassification = "fixed" | "variable";

export type ChartAccountNode = ChartAccount & {
  children: ChartAccountNode[];
  depth: number;
};

export type ChartAccountGroupNumber = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";

export type DfcGroupBuckets = Record<DfcGroup, ChartAccount[]>;

const DFC_GROUPS: DfcGroup[] = ["operational", "non_operational", "investment", "financing"];

export function sortChartAccounts(accounts: ChartAccount[]): ChartAccount[] {
  return [...accounts].sort((left, right) => {
    const byOrder = left.display_order - right.display_order;
    if (byOrder !== 0) {
      return byOrder;
    }

    return left.code.localeCompare(right.code, "pt-BR", { numeric: true });
  });
}

export function getGroupNumber(code: string): ChartAccountGroupNumber | null {
  const group = code.split(".")[0];

  if (
    group === "1" ||
    group === "2" ||
    group === "3" ||
    group === "4" ||
    group === "5" ||
    group === "6" ||
    group === "7" ||
    group === "8"
  ) {
    return group;
  }

  return null;
}

export function buildChartAccountTree(accounts: ChartAccount[]): ChartAccountNode[] {
  const sortedAccounts = sortChartAccounts(accounts);
  const nodes = new Map<string, ChartAccountNode>();

  for (const account of sortedAccounts) {
    nodes.set(account.id, { ...account, children: [], depth: 0 });
  }

  const roots: ChartAccountNode[] = [];

  for (const account of sortedAccounts) {
    const node = nodes.get(account.id);
    if (!node) {
      continue;
    }

    if (!account.parent_id) {
      roots.push(node);
      continue;
    }

    const parent = nodes.get(account.parent_id);
    if (!parent) {
      roots.push(node);
      continue;
    }

    node.depth = parent.depth + 1;
    parent.children.push(node);
  }

  return roots;
}

export function flattenChartAccountTree(nodes: ChartAccountNode[]): ChartAccountNode[] {
  return nodes.flatMap((node) => [node, ...flattenChartAccountTree(node.children)]);
}

export function getRootAccounts(accounts: ChartAccount[]): ChartAccount[] {
  return sortChartAccounts(accounts).filter((account) => account.parent_id === null);
}

export function getChildAccounts(accounts: ChartAccount[], parentId: string): ChartAccount[] {
  return sortChartAccounts(accounts).filter((account) => account.parent_id === parentId);
}

export function findAccountById(accounts: ChartAccount[], id: string): ChartAccount | null {
  return accounts.find((account) => account.id === id) ?? null;
}

export function findAccountByCode(accounts: ChartAccount[], code: string): ChartAccount | null {
  return accounts.find((account) => account.code === code) ?? null;
}

export function getAccountPath(accounts: ChartAccount[], accountId: string): ChartAccount[] {
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const path: ChartAccount[] = [];
  let current = byId.get(accountId);

  while (current) {
    path.unshift(current);

    if (!current.parent_id) {
      break;
    }

    current = byId.get(current.parent_id);
  }

  return path;
}

export function isLeafAccount(accounts: ChartAccount[], accountId: string): boolean {
  return !accounts.some((account) => account.parent_id === accountId);
}

export function getLeafAccounts(accounts: ChartAccount[]): ChartAccount[] {
  return sortChartAccounts(accounts).filter((account) => isLeafAccount(accounts, account.id));
}

export function canReceiveTransactions(accounts: ChartAccount[], account: ChartAccount): boolean {
  return (
    account.is_active && account.nature !== "calculated" && isLeafAccount(accounts, account.id)
  );
}

export function getTransactionCategories(accounts: ChartAccount[]): ChartAccount[] {
  return sortChartAccounts(accounts).filter((account) => canReceiveTransactions(accounts, account));
}

export function groupAccountsByDfcGroup(accounts: ChartAccount[]): DfcGroupBuckets {
  const buckets: DfcGroupBuckets = {
    operational: [],
    non_operational: [],
    investment: [],
    financing: [],
  };

  for (const account of sortChartAccounts(accounts)) {
    if (isDfcGroup(account.dfc_group)) {
      buckets[account.dfc_group].push(account);
    }
  }

  return buckets;
}

export function isDfcGroup(value: string): value is DfcGroup {
  return DFC_GROUPS.includes(value as DfcGroup);
}

export function getTopLevelGroup(accounts: ChartAccount[], accountId: string): ChartAccount | null {
  return getAccountPath(accounts, accountId)[0] ?? null;
}
