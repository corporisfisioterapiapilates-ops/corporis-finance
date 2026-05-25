import { Decimal } from "decimal.js";

import type { DFCResult, DFCRow } from "./calculate";

export type DFCVerticalAnalysisResult = DFCResult;

export function toVerticalAnalysis(result: DFCResult): DFCVerticalAnalysisResult {
  const revenueRow = result.rows.find((row) => row.code === "1");
  const totalRevenue = new Decimal(revenueRow?.total ?? 0);

  return {
    ...result,
    rows: result.rows.map((row) => ({
      ...row,
      values: Object.fromEntries(
        result.months.map((month) => [
          month.key,
          percentOf(row.values[month.key] ?? "0", revenueRow?.values[month.key] ?? "0"),
        ]),
      ),
      total: percentOf(row.total, totalRevenue),
    })),
  };
}

function percentOf(value: string | number | Decimal, base: string | number | Decimal): string {
  const denominator = new Decimal(base);
  if (denominator.isZero()) {
    return "0.00";
  }
  return new Decimal(value).div(denominator).mul(100).toFixed(2);
}

export function isVerticalAnalysisBaseRow(row: DFCRow): boolean {
  return row.code === "1";
}
