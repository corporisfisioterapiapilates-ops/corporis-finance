import { describe, expect, it } from "vitest";

import { parseCategorizationJson } from "@/lib/ai/categorize";
import {
  applyCategoryMemory,
  buildCategoryMemoryRows,
  mergeCategoryMemoryUsage,
  normalizeDescriptionForMemory,
} from "@/lib/ai/category-memory";
import {
  buildDuplicateKey,
  markDuplicates,
  normalizeInvoiceClosingDate,
  parseCsvTransactions,
  parseInvoiceJsonFromText,
  parseOfxTransactions,
} from "@/lib/import";

describe("import parsers", () => {
  it("parseia CSV com data, descrição e valor", () => {
    const result = parseCsvTransactions({
      accountId: "acc-1",
      content:
        'Data,Descrição,Valor\n01/05/2026,Mensalidade Pilates,"1.200,50"\n02/05/2026,Aluguel,"-800,00"',
    });

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]).toMatchObject({
      eventDate: "2026-05-01",
      description: "Mensalidade Pilates",
      amount: "1200.50",
      type: "income",
    });
    expect(result.transactions[1]).toMatchObject({
      amount: "800.00",
      type: "expense",
    });
  });

  it("parseia OFX SGML brasileiro", () => {
    const result = parseOfxTransactions({
      accountId: "acc-1",
      content: `
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20260501120000[-3:BRT]
            <TRNAMT>720.00
            <FITID>abc-1
            <MEMO>Pacote Pilates
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20260502120000[-3:BRT]
            <TRNAMT>-320.40
            <FITID>abc-2
            <MEMO>Energia
        </BANKTRANLIST>
      `,
    });

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.externalId).toBe("abc-1");
    expect(result.transactions[1]).toMatchObject({
      cashDate: "2026-05-02",
      amount: "320.40",
      type: "expense",
    });
  });

  it("marca duplicatas por external_id ou chave semântica", () => {
    const duplicateKey = buildDuplicateKey({
      accountId: "acc-1",
      date: "2026-05-01",
      amount: "100.00",
      description: "Teste",
    });
    const result = markDuplicates(
      [
        {
          externalId: null,
          eventDate: "2026-05-01",
          cashDate: "2026-05-01",
          description: "Teste",
          amount: "100.00",
          type: "income",
          source: "csv",
          duplicateKey,
        },
      ],
      new Set(),
      new Set([duplicateKey]),
    );

    expect(result[0]?.isDuplicate).toBe(true);
  });

  it("extrai JSON de fatura retornado pela IA", () => {
    const result = parseInvoiceJsonFromText(`\`\`\`json
{
  "closingDate": "2026-05-10",
  "dueDate": "2026-05-20",
  "total": "3480.20",
  "transactions": [
    {
      "date": "2026-05-02",
      "description": "Vivo Empresas",
      "amount": "189.90",
      "installmentInfo": null
    }
  ]
}
\`\`\``);

    expect(result.dueDate).toBe("2026-05-20");
    expect(result.transactions[0]).toMatchObject({
      description: "Vivo Empresas",
      amount: "189.90",
    });
  });

  it("normaliza fechamento de fatura para o mês anterior quando passa do vencimento", () => {
    expect(normalizeInvoiceClosingDate("2026-03-27", "2026-03-13")).toBe("2026-02-27");
    expect(normalizeInvoiceClosingDate("2026-02-27", "2026-03-13")).toBe("2026-02-27");
  });

  it("extrai JSON de categorização retornado pela IA", () => {
    const result = parseCategorizationJson(`\`\`\`json
{
  "items": [
    { "index": 0, "categoryCode": "4.02.03", "confidence": 0.86 }
  ]
}
\`\`\``);

    expect(result.items[0]).toMatchObject({
      index: 0,
      categoryCode: "4.02.03",
      confidence: 0.86,
    });
  });

  it("aplica memória de categorização antes da IA", () => {
    const categories = [
      {
        id: "cat-sistemas",
        code: "4.02.07",
        name: "Sistemas",
        nature: "expense",
        is_active: true,
      },
    ] as never;
    const result = applyCategoryMemory(
      [
        {
          externalId: null,
          eventDate: "2026-05-01",
          cashDate: "2026-05-01",
          description: "Spotify Brasil",
          amount: "21.90",
          type: "expense",
          source: "csv",
          duplicateKey: "spotify",
          suggestedCategoryId: null,
          suggestedCategoryCode: null,
          suggestedCategoryName: null,
          aiConfidence: 0.45,
        },
      ],
      categories,
      [
        {
          category_id: "cat-sistemas",
          normalized_description: normalizeDescriptionForMemory("SPOTIFY BRASIL"),
          transaction_type: "expense",
        },
      ] as never,
    );

    expect(result[0]).toMatchObject({
      suggestedCategoryId: "cat-sistemas",
      suggestedCategoryName: "Sistemas",
      aiConfidence: 0.97,
    });
  });

  it("consolida memória aprendida e incrementa uso existente", () => {
    const rows = buildCategoryMemoryRows({
      organizationId: "org-1",
      now: "2026-05-24T12:00:00.000Z",
      transactions: [
        {
          categoryId: "cat-sistemas",
          description: "Spotify Brasil",
          type: "expense",
        },
        {
          categoryId: "cat-sistemas",
          description: "SPOTIFY  BRASIL",
          type: "expense",
        },
      ],
    });
    const merged = mergeCategoryMemoryUsage(rows, [
      {
        normalized_description: normalizeDescriptionForMemory("spotify brasil"),
        transaction_type: "expense",
        usage_count: 4,
      },
    ] as never);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      normalized_description: "spotify brasil",
      usage_count: 2,
    });
    expect(merged[0]?.usage_count).toBe(6);
  });
});
