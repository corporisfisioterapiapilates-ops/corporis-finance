import { buildDuplicateKey } from "./dedup";
import type { ImportParseResult, RawTransaction } from "./types";

export function parseOfxTransactions({
  content,
  accountId,
}: {
  content: string;
  accountId: string;
}): ImportParseResult {
  const normalized = content.replace(/\r/g, "");
  const blocks = [...normalized.matchAll(/<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>)/gi)];
  const warnings: string[] = [];

  if (blocks.length === 0) {
    throw new Error("Nenhum lançamento foi encontrado no arquivo OFX.");
  }

  const transactions: RawTransaction[] = blocks.flatMap((block, index) => {
    const raw = block[1] ?? "";
    const date = parseOfxDate(readTag(raw, "DTPOSTED"));
    const description = (readTag(raw, "MEMO") || readTag(raw, "NAME") || "").trim();
    const externalId = readTag(raw, "FITID") || null;
    const signedAmount = Number((readTag(raw, "TRNAMT") ?? "0").replace(",", "."));

    if (!date || !description || !Number.isFinite(signedAmount) || signedAmount === 0) {
      warnings.push(`Lançamento OFX ${index + 1} ignorado por dados incompletos.`);
      return [];
    }

    const type = signedAmount > 0 ? "income" : "expense";
    const amount = Math.abs(signedAmount).toFixed(2);
    return [
      {
        externalId,
        eventDate: date,
        cashDate: date,
        description,
        amount,
        type,
        source: "ofx",
        duplicateKey: buildDuplicateKey({ accountId, date, amount, description }),
      },
    ];
  });

  return { transactions, warnings };
}

function readTag(block: string, tag: string): string | null {
  const xmlMatch = new RegExp(`<${tag}>([^<]+)</${tag}>`, "i").exec(block);
  if (xmlMatch?.[1]) return xmlMatch[1].trim();

  const sgmlMatch = new RegExp(`<${tag}>([^\\n\\r<]+)`, "i").exec(block);
  return sgmlMatch?.[1]?.trim() ?? null;
}

function parseOfxDate(input: string | null): string | null {
  if (!input || input.length < 8) return null;
  return `${input.slice(0, 4)}-${input.slice(4, 6)}-${input.slice(6, 8)}`;
}
