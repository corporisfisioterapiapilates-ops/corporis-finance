import Anthropic from "@anthropic-ai/sdk";
import { Decimal } from "decimal.js";

import { formatBRL } from "@/lib/money";
import type { Tables } from "@/lib/supabase/types";

type Transaction = Pick<
  Tables<"transactions">,
  "amount" | "cash_date" | "description" | "status" | "type" | "category_id"
>;
type Category = Pick<Tables<"chart_of_accounts">, "id" | "code" | "name" | "parent_id">;

export type ConsultantCard = {
  label: string;
  value: string;
  helper?: string;
  tone: "neutral" | "success" | "danger" | "warning";
};

export type ConsultantTable = {
  columns: string[];
  rows: string[][];
};

export type ConsultantAction = {
  label: string;
  href: string;
};

export type ConsultantToolResult = {
  tool: "monthly_summary" | "expense_analysis" | "pending_cash_flow";
  title: string;
  summary: string;
  cards: ConsultantCard[];
  table?: ConsultantTable;
  actions: ConsultantAction[];
};

export type ConsultantContext = {
  monthLabel: string;
  income: string;
  expense: string;
  result: string;
  topExpenses: Array<{ name: string; value: string }>;
  pendingTotal: string;
  pendingCount: number;
};

const DEFAULT_MODEL = "claude-sonnet-4-6";

export function buildConsultantContext(
  transactions: Transaction[],
  categories: Category[],
): ConsultantContext {
  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    now,
  );
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const rootByCode = new Map(
    categories
      .filter((category) => category.parent_id === null)
      .map((category) => [category.code, category.name]),
  );
  const currentMonth = transactions.filter((transaction) =>
    transaction.cash_date.startsWith(monthKey),
  );
  const cleared = currentMonth.filter((transaction) => transaction.status === "cleared");
  const income = sumByType(cleared, "income");
  const expense = sumByType(cleared, "expense");
  const pendingExpenses = transactions.filter(
    (transaction) => transaction.status === "pending" && transaction.type === "expense",
  );
  const expensesByGroup = new Map<string, Decimal>();

  for (const transaction of cleared) {
    if (transaction.type !== "expense") continue;
    const category = transaction.category_id ? categoryById.get(transaction.category_id) : null;
    const rootName = rootByCode.get(category?.code.split(".")[0] ?? "") ?? "Sem categoria";
    expensesByGroup.set(
      rootName,
      (expensesByGroup.get(rootName) ?? new Decimal(0)).plus(transaction.amount),
    );
  }

  return {
    monthLabel,
    income: income.toFixed(2),
    expense: expense.toFixed(2),
    result: income.minus(expense).toFixed(2),
    pendingTotal: pendingExpenses
      .reduce((sum, transaction) => sum.plus(transaction.amount), new Decimal(0))
      .toFixed(2),
    pendingCount: pendingExpenses.length,
    topExpenses: [...expensesByGroup.entries()]
      .sort((a, b) => b[1].cmp(a[1]))
      .slice(0, 5)
      .map(([name, value]) => ({ name, value: value.toFixed(2) })),
  };
}

export function runConsultantTools({
  question,
  transactions,
  categories,
  today = new Date(),
}: {
  question: string;
  transactions: Transaction[];
  categories: Category[];
  today?: Date;
}): ConsultantToolResult[] {
  const intent = detectIntent(question);
  const tools: ConsultantToolResult[] = [];

  if (intent === "summary" || intent === "mixed") {
    tools.push(buildMonthlySummaryTool(transactions, today));
  }
  if (intent === "expenses" || intent === "mixed") {
    tools.push(buildExpenseAnalysisTool(transactions, categories, today));
  }
  if (intent === "pending" || intent === "mixed") {
    tools.push(buildPendingCashFlowTool(transactions, today));
  }

  return tools.length > 0 ? tools : [buildMonthlySummaryTool(transactions, today)];
}

export async function answerConsultantQuestion({
  question,
  context,
  toolResults,
  history,
}: {
  question: string;
  context: ConsultantContext;
  toolResults: ConsultantToolResult[];
  history: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return buildFallbackAnswer(question, context, toolResults);
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
    max_tokens: 1200,
    temperature: 0.2,
    system: buildSystemPrompt(context, toolResults),
    messages: [
      ...history.slice(-8),
      {
        role: "user",
        content: question,
      },
    ],
  });

  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function buildSystemPrompt(
  context: ConsultantContext,
  toolResults: ConsultantToolResult[],
): string {
  return `Você é o Consultor IA do Corporis Finance, uma plataforma de gestão financeira para clínica de fisioterapia e pilates.

Responda em pt-BR, com tom acolhedor, objetivo e financeiro.
Use exclusivamente os números do contexto abaixo. Se faltar dado, diga isso com clareza.
Não invente lançamentos, bancos ou benchmarks como fato. Pode sugerir próximos passos.
Os cards/tabelas já serão exibidos pela interface; na resposta textual, sintetize os achados e cite o próximo passo mais útil.

Contexto financeiro atual:
- Período: ${context.monthLabel}
- Entradas realizadas: ${formatBRL(context.income)}
- Saídas realizadas: ${formatBRL(context.expense)}
- Resultado realizado: ${formatBRL(context.result)}
- Pendências futuras: ${context.pendingCount} lançamentos, total ${formatBRL(context.pendingTotal)}
- Maiores grupos de despesa: ${
    context.topExpenses.length
      ? context.topExpenses.map((item) => `${item.name}: ${formatBRL(item.value)}`).join("; ")
      : "sem despesas realizadas no período"
  }

Consultas estruturadas executadas:
${toolResults.map(formatToolForPrompt).join("\n\n")}`;
}

function buildFallbackAnswer(
  question: string,
  context: ConsultantContext,
  toolResults: ConsultantToolResult[],
): string {
  const normalized = question.toLowerCase();
  const topExpense = context.topExpenses[0];
  const firstTool = toolResults[0];

  if (normalized.includes("rh") || normalized.includes("salário") || normalized.includes("folha")) {
    const rh = context.topExpenses.find((item) => item.name.toLowerCase().includes("pessoal"));
    return rh
      ? `No período de ${context.monthLabel}, o grupo de pessoas/RH aparece com ${formatBRL(
          rh.value,
        )} em saídas realizadas. A receita realizada foi ${formatBRL(
          context.income,
        )}, então esse grupo representa aproximadamente ${percent(rh.value, context.income)} das entradas.`
      : `Não encontrei um grupo de RH/pessoas entre as maiores despesas realizadas de ${context.monthLabel}. Posso te ajudar olhando por categoria específica no plano de contas.`;
  }

  if (normalized.includes("despesa") || normalized.includes("cust")) {
    return topExpense
      ? `Em ${context.monthLabel}, o maior grupo de despesa foi ${topExpense.name}, com ${formatBRL(
          topExpense.value,
        )}. As saídas totais realizadas foram ${formatBRL(
          context.expense,
        )}, com resultado de ${formatBRL(context.result)}.`
      : `Ainda não há despesas realizadas em ${context.monthLabel}.`;
  }

  if (
    normalized.includes("proje") ||
    normalized.includes("pendente") ||
    normalized.includes("pagar")
  ) {
    return `Hoje existem ${context.pendingCount} lançamentos pendentes, somando ${formatBRL(
      context.pendingTotal,
    )}. Para uma visão dia a dia, abra Projeção de Caixa.`;
  }

  if (firstTool) {
    return `${firstTool.summary}\n\nUsei a consulta estruturada "${firstTool.title}" para chegar nesses números.`;
  }

  return `Resumo de ${context.monthLabel}: entradas realizadas de ${formatBRL(
    context.income,
  )}, saídas de ${formatBRL(context.expense)} e resultado de ${formatBRL(
    context.result,
  )}. Faça uma pergunta mais específica sobre despesas, receita, pendências ou projeção que eu aprofundo.`;
}

function detectIntent(question: string): "summary" | "expenses" | "pending" | "mixed" {
  const normalized = normalize(question);
  const wantsExpenses =
    includesAny(normalized, ["despesa", "despesas", "custo", "custos", "gasto", "gastos"]) ||
    includesAny(normalized, ["aumentaram", "maior", "grupo"]);
  const wantsPending = includesAny(normalized, [
    "pendente",
    "pendentes",
    "projecao",
    "projetado",
    "pagar",
    "receber",
    "vencimento",
    "futuro",
  ]);
  const wantsSummary = includesAny(normalized, [
    "resultado",
    "resumo",
    "receita",
    "entradas",
    "margem",
    "acumulado",
    "caixa",
  ]);
  const matches = [wantsExpenses, wantsPending, wantsSummary].filter(Boolean).length;
  if (matches > 1) return "mixed";
  if (wantsExpenses) return "expenses";
  if (wantsPending) return "pending";
  return "summary";
}

function buildMonthlySummaryTool(transactions: Transaction[], today: Date): ConsultantToolResult {
  const currentMonth = monthKey(today);
  const previousMonth = previousMonthKey(today);
  const current = summarizeMonth(transactions, currentMonth);
  const previous = summarizeMonth(transactions, previousMonth);
  const resultTone = new Decimal(current.result).isNegative() ? "danger" : "success";

  return {
    tool: "monthly_summary",
    title: `Resumo de ${formatMonthLabel(currentMonth)}`,
    summary: `Em ${formatMonthLabel(currentMonth)}, as entradas realizadas somam ${formatBRL(
      current.income,
    )}, as saídas somam ${formatBRL(current.expense)} e o resultado é ${formatBRL(
      current.result,
    )}.`,
    cards: [
      {
        label: "Entradas",
        value: formatBRL(current.income),
        helper: deltaHelper(current.income, previous.income, "vs. mês anterior"),
        tone: "success",
      },
      {
        label: "Saídas",
        value: formatBRL(current.expense),
        helper: deltaHelper(current.expense, previous.expense, "vs. mês anterior"),
        tone: "danger",
      },
      {
        label: "Resultado",
        value: formatBRL(current.result),
        helper: deltaHelper(current.result, previous.result, "vs. mês anterior"),
        tone: resultTone,
      },
    ],
    table: {
      columns: ["Período", "Entradas", "Saídas", "Resultado"],
      rows: [
        [
          formatMonthLabel(currentMonth),
          formatBRL(current.income),
          formatBRL(current.expense),
          formatBRL(current.result),
        ],
        [
          formatMonthLabel(previousMonth),
          formatBRL(previous.income),
          formatBRL(previous.expense),
          formatBRL(previous.result),
        ],
      ],
    },
    actions: [
      { label: "Abrir dashboard", href: `/dashboard?month=${currentMonth}` },
      { label: "Ver DFC", href: `/dfc?year=${currentMonth.slice(0, 4)}&mode=anual` },
    ],
  };
}

function buildExpenseAnalysisTool(
  transactions: Transaction[],
  categories: Category[],
  today: Date,
): ConsultantToolResult {
  const currentMonth = monthKey(today);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const rootByCode = new Map(
    categories
      .filter((category) => category.parent_id === null)
      .map((category) => [category.code, category.name]),
  );
  const expensesByGroup = new Map<string, Decimal>();

  for (const transaction of clearedMonthTransactions(transactions, currentMonth)) {
    if (transaction.type !== "expense") continue;
    const category = transaction.category_id ? categoryById.get(transaction.category_id) : null;
    const rootName = rootByCode.get(category?.code.split(".")[0] ?? "") ?? "Sem categoria";
    expensesByGroup.set(
      rootName,
      (expensesByGroup.get(rootName) ?? new Decimal(0)).plus(transaction.amount),
    );
  }

  const rows = [...expensesByGroup.entries()]
    .sort((a, b) => b[1].cmp(a[1]))
    .slice(0, 6)
    .map(([name, value]) => [name, formatBRL(value.toFixed(2))]);
  const total = [...expensesByGroup.values()].reduce(
    (sum, value) => sum.plus(value),
    new Decimal(0),
  );
  const top = rows[0];

  return {
    tool: "expense_analysis",
    title: `Despesas por grupo em ${formatMonthLabel(currentMonth)}`,
    summary: top
      ? `O maior grupo de despesa é ${top[0]}, com ${top[1]} no mês.`
      : `Ainda não há despesas realizadas em ${formatMonthLabel(currentMonth)}.`,
    cards: [
      {
        label: "Saídas no mês",
        value: formatBRL(total.toFixed(2)),
        helper: rows.length ? `${rows.length} grupos com movimento` : "Sem movimento realizado",
        tone: "danger",
      },
      {
        label: "Maior grupo",
        value: top?.[1] ?? formatBRL("0"),
        helper: top?.[0] ?? "Sem categoria",
        tone: "warning",
      },
    ],
    table: {
      columns: ["Grupo", "Valor"],
      rows,
    },
    actions: [
      { label: "Abrir lançamentos", href: "/lancamentos" },
      { label: "Ver orçamento", href: `/orcamento?month=${currentMonth}` },
    ],
  };
}

function buildPendingCashFlowTool(transactions: Transaction[], today: Date): ConsultantToolResult {
  const todayKey = today.toISOString().slice(0, 10);
  const pending = transactions
    .filter((transaction) => transaction.status === "pending" && transaction.cash_date >= todayKey)
    .sort((a, b) => a.cash_date.localeCompare(b.cash_date));
  const pendingIncome = sumByType(pending, "income");
  const pendingExpense = sumByType(pending, "expense");
  const net = pendingIncome.minus(pendingExpense);

  return {
    tool: "pending_cash_flow",
    title: "Lançamentos pendentes futuros",
    summary: `Há ${pending.length} lançamentos pendentes futuros: ${formatBRL(
      pendingIncome.toFixed(2),
    )} a receber e ${formatBRL(pendingExpense.toFixed(2))} a pagar.`,
    cards: [
      {
        label: "A receber",
        value: formatBRL(pendingIncome.toFixed(2)),
        tone: "success",
      },
      {
        label: "A pagar",
        value: formatBRL(pendingExpense.toFixed(2)),
        tone: "danger",
      },
      {
        label: "Efeito líquido",
        value: formatBRL(net.toFixed(2)),
        tone: net.isNegative() ? "danger" : "success",
      },
    ],
    table: {
      columns: ["Data caixa", "Descrição", "Tipo", "Valor"],
      rows: pending
        .slice(0, 8)
        .map((transaction) => [
          formatDateLabel(transaction.cash_date),
          transaction.description,
          transaction.type === "income" ? "Entrada" : "Saída",
          formatBRL(transaction.amount),
        ]),
    },
    actions: [
      { label: "Abrir projeção", href: "/projecao" },
      { label: "Ver pendências", href: "/lancamentos" },
    ],
  };
}

function summarizeMonth(transactions: Transaction[], month: string) {
  const cleared = clearedMonthTransactions(transactions, month);
  const income = sumByType(cleared, "income");
  const expense = sumByType(cleared, "expense");
  return {
    income: income.toFixed(2),
    expense: expense.toFixed(2),
    result: income.minus(expense).toFixed(2),
  };
}

function clearedMonthTransactions(transactions: Transaction[], month: string): Transaction[] {
  return transactions.filter(
    (transaction) =>
      transaction.status === "cleared" &&
      transaction.cash_date.startsWith(month) &&
      (transaction.type === "income" || transaction.type === "expense"),
  );
}

function formatToolForPrompt(tool: ConsultantToolResult): string {
  const cards = tool.cards
    .map((card) => `- ${card.label}: ${card.value}${card.helper ? ` (${card.helper})` : ""}`)
    .join("\n");
  const table = tool.table?.rows.length
    ? `\nTabela:\n${tool.table.columns.join(" | ")}\n${tool.table.rows
        .map((row) => row.join(" | "))
        .join("\n")}`
    : "";
  return `${tool.title}\nResumo: ${tool.summary}\nCards:\n${cards}${table}`;
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function previousMonthKey(date: Date): string {
  const previous = new Date(date);
  previous.setMonth(previous.getMonth() - 1);
  return monthKey(previous);
}

function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-");
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(Number(year), Number(monthNumber) - 1, 1)))
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatDateLabel(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(
    new Date(`${date}T12:00:00`),
  );
}

function deltaHelper(current: string, previous: string, suffix: string): string {
  const previousValue = new Decimal(previous);
  const currentValue = new Decimal(current);
  if (previousValue.isZero()) {
    return currentValue.isZero() ? `sem variação ${suffix}` : `sem base ${suffix}`;
  }
  const delta = currentValue.minus(previousValue).div(previousValue.abs()).mul(100);
  const sign = delta.isNegative() ? "" : "+";
  return `${sign}${delta.toDecimalPlaces(1).toString()}% ${suffix}`;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function includesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function sumByType(transactions: Transaction[], type: "income" | "expense"): Decimal {
  return transactions
    .filter((transaction) => transaction.type === type)
    .reduce((sum, transaction) => sum.plus(transaction.amount), new Decimal(0));
}

function percent(value: string, base: string): string {
  const denominator = new Decimal(base);
  if (denominator.isZero()) return "0%";
  return `${new Decimal(value).div(denominator).mul(100).toDecimalPlaces(1).toString()}%`;
}
