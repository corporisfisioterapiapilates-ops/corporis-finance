import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { applyCategoryMemory, type CategoryMemory } from "@/lib/ai/category-memory";
import type { RawTransaction } from "@/lib/import";
import type { Tables } from "@/lib/supabase/types";

type Category = Tables<"chart_of_accounts">;

export type CategorizedRawTransaction = RawTransaction & {
  suggestedCategoryId: string | null;
  suggestedCategoryCode: string | null;
  suggestedCategoryName: string | null;
  aiConfidence: number;
};

const RULES: Array<{ code: string; keywords: string[] }> = [
  { code: "1.01", keywords: ["pilates", "mensalidade"] },
  { code: "1.02", keywords: ["fisioterapia", "fisio "] },
  { code: "1.03", keywords: ["pelvica", "pélvica"] },
  { code: "1.04", keywords: ["taping"] },
  { code: "1.05", keywords: ["consulta", "avaliacao", "avaliação"] },
  { code: "2.01", keywords: ["simples", "das "] },
  { code: "3.02", keywords: ["lavanderia"] },
  { code: "3.03", keywords: ["material fisio", "materiais"] },
  { code: "4.01.01", keywords: ["salario", "salário", "folha"] },
  { code: "4.01.06", keywords: ["fgts"] },
  { code: "4.01.07", keywords: ["inss"] },
  { code: "4.01.13", keywords: ["pro-labore", "pró-labore"] },
  { code: "4.02.01", keywords: ["aluguel", "condominio", "condomínio"] },
  { code: "4.02.02", keywords: ["energia", "celesc", "agua", "água", "gas", "gás"] },
  { code: "4.02.03", keywords: ["telefone", "internet", "vivo"] },
  { code: "4.02.04", keywords: ["contador", "contabilidade"] },
  { code: "4.02.07", keywords: ["sistema", "software", "assinatura"] },
  { code: "4.02.09", keywords: ["limpeza"] },
  { code: "4.03.07", keywords: ["marketing"] },
  { code: "4.03.09", keywords: ["ads", "meta", "google"] },
  { code: "5.02", keywords: ["tarifa", "iof", "banco"] },
  { code: "7.06", keywords: ["implantacao", "implantação", "melhoria"] },
];

const DEFAULT_MODEL = "claude-sonnet-4-6";

const aiCategorizationSchema = z.object({
  items: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      categoryCode: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

export async function categorizeRawTransactions(
  transactions: RawTransaction[],
  categories: Category[],
  memories: CategoryMemory[] = [],
): Promise<CategorizedRawTransaction[]> {
  const localCategorized = applyCategoryMemory(
    categorizeRawTransactionsByRules(transactions, categories),
    categories,
    memories,
  );
  const leafCategories = getLeafCategories(categories);
  const transactionsForAi = localCategorized.filter(
    (transaction) => transaction.aiConfidence < 0.95,
  );

  if (
    !process.env.ANTHROPIC_API_KEY ||
    transactionsForAi.length === 0 ||
    leafCategories.length === 0
  ) {
    return localCategorized;
  }

  try {
    const aiCategorized = await categorizeRawTransactionsWithClaude(
      transactionsForAi,
      leafCategories,
      transactionsForAi,
    );
    const aiByDuplicateKey = new Map(
      aiCategorized.map((transaction) => [transaction.duplicateKey, transaction]),
    );

    return localCategorized.map((transaction) =>
      transaction.aiConfidence >= 0.95
        ? transaction
        : (aiByDuplicateKey.get(transaction.duplicateKey) ?? transaction),
    );
  } catch (error) {
    console.warn("Claude categorization failed; using local rules.", error);
    return localCategorized;
  }
}

export function categorizeRawTransactionsByRules(
  transactions: RawTransaction[],
  categories: Category[],
): CategorizedRawTransaction[] {
  const byCode = new Map(categories.map((category) => [category.code, category]));
  const fallbackIncome = byCode.get("1.99") ?? byCode.get("1.06") ?? null;
  const fallbackExpense = byCode.get("4.02.99") ?? byCode.get("3.99") ?? null;

  return transactions.map((transaction) => {
    const normalizedDescription = normalize(transaction.description);
    const rule = RULES.find((candidate) =>
      candidate.keywords.some((keyword) => normalizedDescription.includes(normalize(keyword))),
    );
    const category =
      (rule ? byCode.get(rule.code) : null) ??
      (transaction.type === "income" ? fallbackIncome : fallbackExpense);

    return {
      ...transaction,
      suggestedCategoryId: category?.id ?? null,
      suggestedCategoryCode: category?.code ?? null,
      suggestedCategoryName: category?.name ?? null,
      aiConfidence: rule ? 0.82 : 0.45,
    };
  });
}

async function categorizeRawTransactionsWithClaude(
  transactions: RawTransaction[],
  categories: Category[],
  fallback: CategorizedRawTransaction[],
): Promise<CategorizedRawTransaction[]> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
    max_tokens: 4096,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: buildPrompt(transactions, categories),
          },
        ],
      },
    ],
  });
  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
  const parsed = parseCategorizationJson(text);
  const categoriesByCode = new Map(categories.map((category) => [category.code, category]));
  const suggestionsByIndex = new Map(parsed.items.map((item) => [item.index, item]));

  return fallback.map((transaction, index) => {
    const suggestion = suggestionsByIndex.get(index);
    const category = suggestion ? categoriesByCode.get(suggestion.categoryCode) : null;

    if (!suggestion || !category || category.nature !== transaction.type) {
      return transaction;
    }

    return {
      ...transaction,
      suggestedCategoryId: category.id,
      suggestedCategoryCode: category.code,
      suggestedCategoryName: category.name,
      aiConfidence: suggestion.confidence,
    };
  });
}

export function parseCategorizationJson(text: string): z.infer<typeof aiCategorizationSchema> {
  const cleanText = text.trim();
  const fenced = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const jsonText = fenced?.[1] ?? cleanText;

  return aiCategorizationSchema.parse(JSON.parse(jsonText) as unknown);
}

function buildPrompt(transactions: RawTransaction[], categories: Category[]): string {
  return `Você categoriza lançamentos financeiros de uma clínica chamada Corporis Finance.

Escolha exatamente uma categoria do plano de contas para cada lançamento.
Use somente códigos existentes na lista de categorias.
Para lançamentos type=income, escolha somente categorias nature=income.
Para lançamentos type=expense, escolha somente categorias nature=expense.

Responda somente com JSON válido, sem markdown, neste formato:
{
  "items": [
    { "index": 0, "categoryCode": "4.02.03", "confidence": 0.86 }
  ]
}

Categorias:
${categories
  .map((category) => `- ${category.code} | ${category.nature} | ${category.name}`)
  .join("\n")}

Lançamentos:
${transactions
  .map(
    (transaction, index) =>
      `- index=${index} | type=${transaction.type} | amount=${transaction.amount} | description=${transaction.description}`,
  )
  .join("\n")}`;
}

function getLeafCategories(categories: Category[]): Category[] {
  const parentIds = new Set(
    categories.flatMap((category) => (category.parent_id ? [category.parent_id] : [])),
  );

  return categories.filter((category) => category.is_active && !parentIds.has(category.id));
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
