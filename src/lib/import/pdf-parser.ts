import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const parsedInvoiceSchema = z.object({
  closingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total: z.string().regex(/^\d+(\.\d{1,2})?$/),
  transactions: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      description: z.string().min(1),
      amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
      installmentInfo: z.string().nullable().optional(),
    }),
  ),
});

export type ParsedInvoice = z.infer<typeof parsedInvoiceSchema>;

const DEFAULT_MODEL = "claude-sonnet-4-6";

const prompt = `Você é um parser financeiro para faturas de cartão brasileiras.
Extraia a data de fechamento, a data de vencimento, o valor total e todas as compras/lançamentos da fatura.

Responda somente com JSON válido, sem markdown, neste formato exato:
{
  "closingDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "total": "1234.56",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "Descrição limpa do lançamento",
      "amount": "123.45",
      "installmentInfo": "1/3"
    }
  ]
}

Regras:
- Use ponto como separador decimal.
- Valores de compras devem ser positivos.
- Ignore pagamentos, saldo anterior, encargos meramente informativos e totais/subtotais duplicados.
- Se houver parcela, mantenha a informação em installmentInfo; caso contrário, use null.
- Se uma data de compra vier sem ano, use o ano mais provável considerando o vencimento da fatura.
- Em faturas brasileiras, se o dia de fechamento for maior que o dia de vencimento, o fechamento pertence ao mês anterior ao vencimento. Exemplo: vencimento 2026-03-13 e fechamento dia 27 => closingDate 2026-02-27.`;

export function parseInvoiceJsonFromText(text: string): ParsedInvoice {
  const cleanText = text.trim();
  const fenced = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const jsonText = fenced?.[1] ?? cleanText;
  const parsed = JSON.parse(jsonText) as unknown;

  return normalizeParsedInvoice(parsedInvoiceSchema.parse(parsed));
}

export async function parsePdfInvoice(base64Pdf: string): Promise<ParsedInvoice> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "Defina ANTHROPIC_API_KEY no .env.local para habilitar a leitura de faturas em PDF.",
    );
  }

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
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64Pdf,
            },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("A IA não retornou dados legíveis para esta fatura.");
  }

  return parseInvoiceJsonFromText(text);
}

export function normalizeParsedInvoice(invoice: ParsedInvoice): ParsedInvoice {
  return {
    ...invoice,
    closingDate: normalizeInvoiceClosingDate(invoice.closingDate, invoice.dueDate),
  };
}

export function normalizeInvoiceClosingDate(closingDate: string, dueDate: string): string {
  const closing = parseIsoDateParts(closingDate);
  const due = parseIsoDateParts(dueDate);

  if (!closing || !due) {
    return closingDate;
  }

  const closingTime = Date.UTC(closing.year, closing.month - 1, closing.day);
  const dueTime = Date.UTC(due.year, due.month - 1, due.day);

  if (closingTime <= dueTime) {
    return closingDate;
  }

  const previousMonth = new Date(Date.UTC(due.year, due.month - 2, 1));
  const normalizedYear = previousMonth.getUTCFullYear();
  const normalizedMonth = previousMonth.getUTCMonth() + 1;
  const normalizedDay = Math.min(closing.day, daysInMonth(normalizedYear, normalizedMonth));

  return [
    normalizedYear,
    String(normalizedMonth).padStart(2, "0"),
    String(normalizedDay).padStart(2, "0"),
  ].join("-");
}

function parseIsoDateParts(date: string): { year: number; month: number; day: number } | null {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
