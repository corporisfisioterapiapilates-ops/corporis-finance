import { describe, expect, it } from "vitest";

import { formatBRL, moneySign, parseBRL, sumMoney } from "@/lib/money";

describe("money helpers", () => {
  it("formats BRL with pt-BR separators", () => {
    expect(formatBRL("1234.56")).toBe("R$ 1.234,56");
    expect(formatBRL("0")).toBe("R$ 0,00");
  });

  it("parses pt-BR inputs into canonical numeric strings", () => {
    expect(parseBRL("R$ 1.234,56")).toBe("1234.56");
    expect(parseBRL("-12,5")).toBe("-12.50");
    expect(parseBRL("")).toBe("0.00");
  });

  it("sums money without floating point drift", () => {
    expect(sumMoney(["0.10", "0.20"])).toBe("0.30");
    expect(sumMoney(["1000.10", "2000.20", "-500.05"])).toBe("2500.25");
  });

  it("rounds sums to cents using Decimal.js", () => {
    expect(sumMoney(["10.005", "0"])).toBe("10.00");
    expect(sumMoney(["10.015", "0"])).toBe("10.02");
  });

  it("detects value signs", () => {
    expect(moneySign("12.00")).toBe(1);
    expect(moneySign("-0.01")).toBe(-1);
    expect(moneySign("0.00")).toBe(0);
  });
});
