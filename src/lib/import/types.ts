import { z } from "zod";

export const rawTransactionSchema = z.object({
  externalId: z.string().nullable(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cashDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1),
  amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  type: z.enum(["income", "expense"]),
  source: z.enum(["ofx", "csv", "pdf_invoice"]),
  duplicateKey: z.string(),
});

export type RawTransaction = z.infer<typeof rawTransactionSchema>;

export type ImportParseResult = {
  transactions: RawTransaction[];
  warnings: string[];
};
