import Papa from "papaparse";

import { buildDuplicateKey } from "./dedup";
import type { ImportParseResult, RawTransaction } from "./types";

const DATE_HEADERS = ["data", "date", "dt", "data lançamento", "data lancamento", "lançamento"];
const DESCRIPTION_HEADERS = [
  "descrição",
  "descricao",
  "histórico",
  "historico",
  "description",
  "memo",
];
const AMOUNT_HEADERS = ["valor", "amount", "valor r$", "vlr"];
const DEBIT_HEADERS = ["débito", "debito", "saída", "saida", "debit"];
const CREDIT_HEADERS = ["crédito", "credito", "entrada", "credit"];

export function parseCsvTransactions({
  content,
  accountId,
}: {
  content: string;
  accountId: string;
}): ImportParseResult {
  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => normalizeHeader(header),
  });
  const warnings = parsed.errors.map((error) => error.message);
  const rows = parsed.data.filter((row) => Object.values(row).some(Boolean));

  const headers = Object.keys(rows[0] ?? {});
  const dateHeader = findHeader(headers, DATE_HEADERS);
  const descriptionHeader = findHeader(headers, DESCRIPTION_HEADERS);
  const amountHeader = findHeader(headers, AMOUNT_HEADERS);
  const debitHeader = findHeader(headers, DEBIT_HEADERS);
  const creditHeader = findHeader(headers, CREDIT_HEADERS);

  if (!dateHeader || !descriptionHeader || (!amountHeader && !debitHeader && !creditHeader)) {
    throw new Error("Não foi possível identificar as colunas de data, descrição e valor do CSV.");
  }

  const transactions: RawTransaction[] = rows.flatMap((row, index) => {
    const date = parseDate(row[dateHeader] ?? "");
    const description = (row[descriptionHeader] ?? "").trim();
    const signedAmount = amountHeader
      ? parseBRNumber(row[amountHeader] ?? "0")
      : parseBRNumber(row[creditHeader ?? ""] ?? "0") -
        parseBRNumber(row[debitHeader ?? ""] ?? "0");

    if (!date || !description || signedAmount === 0) {
      warnings.push(`Linha ${index + 2} ignorada por falta de data, descrição ou valor.`);
      return [];
    }

    const type = signedAmount > 0 ? "income" : "expense";
    const amount = Math.abs(signedAmount).toFixed(2);
    return [
      {
        externalId: null,
        eventDate: date,
        cashDate: date,
        description,
        amount,
        type,
        source: "csv",
        duplicateKey: buildDuplicateKey({ accountId, date, amount, description }),
      },
    ];
  });

  return { transactions, warnings };
}

function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function findHeader(headers: string[], candidates: string[]): string | null {
  const normalizedCandidates = candidates.map(normalizeHeader);
  return headers.find((header) => normalizedCandidates.includes(normalizeHeader(header))) ?? null;
}

function parseDate(input: string): string | null {
  const value = input.trim();
  const br = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(value);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;

  const iso = /^(\d{4})[/-](\d{2})[/-](\d{2})$/.exec(value);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  return null;
}

function parseBRNumber(input: string): number {
  const value = input.trim();
  if (!value) return 0;
  const negative = value.includes("-") || /^\(.*\)$/.test(value);
  const cleaned = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/-/g, "");
  const parsed = Number(cleaned || 0);
  return negative ? -parsed : parsed;
}
