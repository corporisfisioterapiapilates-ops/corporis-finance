import { z } from "zod";

export const transactionTypeSchema = z.enum(["income", "expense", "transfer"]);
export const transactionStatusSchema = z.enum(["pending", "cleared"]);

const moneySchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Informe um valor válido.")
  .refine((value) => Number(value) > 0, "O valor precisa ser maior que zero.");

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.");

export const transactionInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    type: transactionTypeSchema,
    account_id: z.string().uuid("Selecione a conta."),
    category_id: z.string().uuid("Selecione a categoria.").nullable(),
    counter_account_id: z.string().uuid("Selecione a conta de destino.").nullable(),
    amount: moneySchema,
    description: z
      .string()
      .trim()
      .min(1, "Informe a descrição.")
      .max(160, "Descrição muito longa."),
    event_date: dateSchema,
    cash_date: dateSchema,
    status: transactionStatusSchema.default("cleared"),
    notes: z.string().trim().max(500, "Observação muito longa.").optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "transfer") {
      if (!value.counter_account_id) {
        ctx.addIssue({
          code: "custom",
          path: ["counter_account_id"],
          message: "Selecione a conta de destino.",
        });
      }
      if (value.counter_account_id === value.account_id) {
        ctx.addIssue({
          code: "custom",
          path: ["counter_account_id"],
          message: "A conta de destino precisa ser diferente da origem.",
        });
      }
      return;
    }

    if (!value.category_id) {
      ctx.addIssue({
        code: "custom",
        path: ["category_id"],
        message: "Selecione a categoria.",
      });
    }
  });

export type TransactionInput = z.infer<typeof transactionInputSchema>;
