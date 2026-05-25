import type { CategorizedRawTransaction } from "@/lib/ai/categorize";
import type { Tables } from "@/lib/supabase/types";

type Category = Tables<"chart_of_accounts">;
export type CategoryMemory = Tables<"category_memory">;

export type CategoryMemoryLearningTransaction = {
  categoryId: string;
  description: string;
  type: "income" | "expense";
};

export type CategoryMemoryUpsertRow = {
  organization_id: string;
  normalized_description: string;
  sample_description: string;
  transaction_type: "income" | "expense";
  category_id: string;
  confidence: number;
  usage_count: number;
  last_used_at: string;
};

export function normalizeDescriptionForMemory(description: string): string {
  return description
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function applyCategoryMemory(
  transactions: CategorizedRawTransaction[],
  categories: Category[],
  memories: CategoryMemory[],
): CategorizedRawTransaction[] {
  if (memories.length === 0) {
    return transactions;
  }

  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const memoriesByKey = new Map(
    memories.map((memory) => [
      memoryKey(memory.transaction_type, memory.normalized_description),
      memory,
    ]),
  );

  return transactions.map((transaction) => {
    const memory = memoriesByKey.get(
      memoryKey(transaction.type, normalizeDescriptionForMemory(transaction.description)),
    );
    const category = memory ? categoriesById.get(memory.category_id) : null;

    if (!memory || !category || category.nature !== transaction.type) {
      return transaction;
    }

    return {
      ...transaction,
      suggestedCategoryId: category.id,
      suggestedCategoryCode: category.code,
      suggestedCategoryName: category.name,
      aiConfidence: 0.97,
    };
  });
}

export function buildCategoryMemoryRows({
  organizationId,
  transactions,
  now = new Date().toISOString(),
}: {
  organizationId: string;
  transactions: CategoryMemoryLearningTransaction[];
  now?: string;
}): CategoryMemoryUpsertRow[] {
  const rowsByKey = new Map<string, CategoryMemoryUpsertRow>();

  for (const transaction of transactions) {
    const normalizedDescription = normalizeDescriptionForMemory(transaction.description);

    if (!normalizedDescription) continue;

    const key = memoryKey(transaction.type, normalizedDescription);
    const existing = rowsByKey.get(key);

    rowsByKey.set(key, {
      organization_id: organizationId,
      normalized_description: normalizedDescription,
      sample_description: transaction.description,
      transaction_type: transaction.type,
      category_id: transaction.categoryId,
      confidence: 0.95,
      usage_count: (existing?.usage_count ?? 0) + 1,
      last_used_at: now,
    });
  }

  return Array.from(rowsByKey.values());
}

export function mergeCategoryMemoryUsage(
  rows: CategoryMemoryUpsertRow[],
  existingMemories: Pick<
    CategoryMemory,
    "normalized_description" | "transaction_type" | "usage_count"
  >[],
): CategoryMemoryUpsertRow[] {
  const existingByKey = new Map(
    existingMemories.map((memory) => [
      memoryKey(memory.transaction_type, memory.normalized_description),
      memory,
    ]),
  );

  return rows.map((row) => {
    const existing = existingByKey.get(memoryKey(row.transaction_type, row.normalized_description));

    return {
      ...row,
      usage_count: row.usage_count + (existing?.usage_count ?? 0),
    };
  });
}

function memoryKey(type: string, normalizedDescription: string): string {
  return `${type}:${normalizedDescription}`;
}
