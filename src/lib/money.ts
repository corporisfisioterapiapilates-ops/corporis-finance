import { Decimal } from "decimal.js";

// Dinheiro NUNCA usa number na lógica. Valor canônico = string (Postgres numeric).
// Decimal.js faz somas/arredondamento. Formatação só na borda de exibição.

Decimal.set({ rounding: Decimal.ROUND_HALF_EVEN });

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formata valor monetário em `R$ 1.234,56`. Aceita string do numeric ou number. */
export function formatBRL(value: string | number): string {
  const d = new Decimal(value === "" || value == null ? 0 : value);
  return BRL.format(d.toNumber()).replace(/\u00a0/g, " ");
}

/** Converte input pt-BR ("1.234,56", "R$ 1.234,56", "-12,5") para string canônica "1234.56". */
export function parseBRL(input: string): string {
  if (!input) return "0.00";
  const negative = /-/.test(input);
  const cleaned = input
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/-/g, "");
  if (cleaned === "" || cleaned === ".") return "0.00";
  const d = new Decimal(cleaned);
  return (negative ? d.negated() : d).toFixed(2);
}

/** Soma uma lista de valores monetários sem erro de ponto flutuante. */
export function sumMoney(values: Array<string | number>): string {
  return values.reduce((acc, v) => acc.plus(new Decimal(v || 0)), new Decimal(0)).toFixed(2);
}

/** Sinal do valor: 1 positivo, -1 negativo, 0 neutro. */
export function moneySign(value: string | number): -1 | 0 | 1 {
  const d = new Decimal(value || 0);
  return d.isZero() ? 0 : d.isNegative() ? -1 : 1;
}
