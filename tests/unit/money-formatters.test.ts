import { describe, expect, it } from "vitest";
import { currency, formatChange, percent } from "@/components/analytics/analytics-format";
import { formatMoney, round2 } from "@/lib/utils";

// These formatters are deliberately separate implementations; the tests pin
// each one's own output.

const DEFAULT_LOCALE = new Intl.NumberFormat().resolvedOptions().locale;

describe("formatMoney", () => {
  it("prints two decimals after the symbol, without grouping", () => {
    expect(formatMoney(12.5)).toBe("$12.50");
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(1234567.891)).toBe("$1234567.89");
  });

  it("prints missing and NaN amounts as $0.00", () => {
    expect(formatMoney(null)).toBe("$0.00");
    expect(formatMoney(undefined)).toBe("$0.00");
    expect(formatMoney(Number.NaN)).toBe("$0.00");
  });

  it("puts the minus sign after the symbol", () => {
    expect(formatMoney(-5)).toBe("$-5.00");
    expect(formatMoney(-0.001)).toBe("$-0.00");
  });

  it("rounds with toFixed and passes Infinity through", () => {
    expect(formatMoney(1.005)).toBe("$1.00");
    expect(formatMoney(Number.POSITIVE_INFINITY)).toBe("$Infinity");
  });

  it("takes another symbol, or none", () => {
    expect(formatMoney(10, "€")).toBe("€10.00");
    expect(formatMoney(10, "")).toBe("10.00");
  });
});

describe("round2", () => {
  it("rounds half up to cents, nudged by EPSILON", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(2.345)).toBe(2.35);
    expect(round2(10)).toBe(10);
  });

  it("rounds negative halves toward zero", () => {
    expect(round2(-1.005)).toBe(-1);
  });

  it("turns non-finite values into 0", () => {
    expect(round2(Number.NaN)).toBe(0);
    expect(round2(Number.POSITIVE_INFINITY)).toBe(0);
    expect(round2(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe("analytics currency", () => {
  it("formats whole dollars in the runtime's default locale", () => {
    const whole = (n: number) =>
      new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
    expect(currency(1234.5)).toBe(`$${whole(1234.5)}`);
    expect(currency(-1234.4)).toBe(`$${whole(-1234.4)}`);
  });

  it.runIf(DEFAULT_LOCALE === "en-US")("groups thousands and rounds half away from zero (en-US)", () => {
    expect(currency(0)).toBe("$0");
    expect(currency(999.5)).toBe("$1,000");
    expect(currency(1234.5)).toBe("$1,235");
    expect(currency(1234567.89)).toBe("$1,234,568");
    expect(currency(-1234.4)).toBe("$-1,234");
    expect(currency(-0.5)).toBe("$-1");
    // A small negative amount keeps its sign after rounding to zero.
    expect(currency(-0.4)).toBe("$-0");
  });
});

describe("analytics percent", () => {
  it("prints a ratio as a percentage with one decimal", () => {
    expect(percent(0.1234)).toBe("12.3%");
    expect(percent(0)).toBe("0.0%");
    expect(percent(1)).toBe("100.0%");
    expect(percent(-0.05)).toBe("-5.0%");
    expect(percent(0.0005)).toBe("0.1%");
    expect(percent(-0.0001)).toBe("-0.0%");
  });
});

describe("analytics formatChange", () => {
  it("adds a plus sign to zero and to growth", () => {
    expect(formatChange(0.1234)).toBe("+12.3%");
    expect(formatChange(1.5)).toBe("+150.0%");
    expect(formatChange(0)).toBe("+0.0%");
    expect(formatChange(-0)).toBe("+0.0%");
  });

  it("keeps the minus sign of a decline, even one that rounds to zero", () => {
    expect(formatChange(-0.05)).toBe("-5.0%");
    expect(formatChange(-0.0001)).toBe("-0.0%");
  });
});
