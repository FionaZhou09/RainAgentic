import { describe, it, expect } from "vitest";
import { cents, bps, fmtUSD } from "@/lib/contracts/money";
import { computeLandedCost, missingRequiredFields } from "./index";
import { ASSUMPTIONS, QUOTE_A, QUOTE_B, QUOTE_C } from "@/lib/fixtures/pr-1042";

/** Every figure below is recomputable from PRD §5's table by hand. That is the point:
 *  a judge with a phone gets the same numbers. */

describe("A landed = $5,623.00, perUnit 9.3717, deposit@5000 = $2,470.00", () => {
  const result = computeLandedCost(QUOTE_A, ASSUMPTIONS);

  it("is complete", () => {
    expect(result.kind).toBe("complete");
  });

  it("reproduces every line of A to the cent", () => {
    if (result.kind !== "complete") throw new Error("expected complete");
    const b = result.breakdown;
    expect(b.productSubtotal).toBe(384_000);   // 640 * 600
    expect(b.samplingFee).toBe(12_000);
    expect(b.shipping).toBe(98_000);
    expect(b.poValue).toBe(494_000);           // product + sampling + freight
    expect(b.dutyEstimate).toBe(63_360);       // 16.5% of subtotal
    expect(b.paymentFee).toBe(4_940);          // 1.0% of PO value
    expect(b.landedTotal).toBe(562_300);
    expect(fmtUSD(b.landedTotal)).toBe("$5,623.00");
    expect(b.depositDue).toBe(247_000);        // 50% of PO value
    expect(fmtUSD(b.depositDue)).toBe("$2,470.00");
  });

  it("reports landed per unit as 9.3717", () => {
    if (result.kind !== "complete") throw new Error("expected complete");
    expect(result.breakdown.landedPerUnitMilliCents).toBeCloseTo(937_166.667, 2);
  });
});

describe("B landed = $5,657.45, perUnit 9.4291, deposit@3000 = $1,479.00", () => {
  const result = computeLandedCost(QUOTE_B, ASSUMPTIONS);

  it("reproduces every line of B to the cent", () => {
    if (result.kind !== "complete") throw new Error("expected complete");
    const b = result.breakdown;
    expect(b.productSubtotal).toBe(411_000);   // 685 * 600
    expect(b.poValue).toBe(493_000);
    expect(b.dutyEstimate).toBe(67_815);
    expect(b.paymentFee).toBe(4_930);
    expect(b.landedTotal).toBe(565_745);
    expect(fmtUSD(b.landedTotal)).toBe("$5,657.45");
    expect(b.depositDue).toBe(147_900);        // 30% of PO value — the D3 deposit beat
    expect(fmtUSD(b.depositDue)).toBe("$1,479.00");
  });

  it("reports landed per unit as 9.4291", () => {
    if (result.kind !== "complete") throw new Error("expected complete");
    expect(result.breakdown.landedPerUnitMilliCents).toBeCloseTo(942_908.333, 2);
  });

  it("lands $34.45 above A — cost is effectively a tie, so terms decide", () => {
    const a = computeLandedCost(QUOTE_A, ASSUMPTIONS);
    if (a.kind !== "complete" || result.kind !== "complete") throw new Error("expected complete");
    expect(result.breakdown.landedTotal - a.breakdown.landedTotal).toBe(3_445);
  });
});

describe("C is incomplete, missing ['shipping']", () => {
  it("returns kind 'incomplete' and names shipping", () => {
    const result = computeLandedCost(QUOTE_C, ASSUMPTIONS);
    expect(result.kind).toBe("incomplete");
    if (result.kind !== "incomplete") throw new Error("expected incomplete");
    expect(result.missing).toEqual(["shipping"]);
  });

  it("emits NO partial totals — unquotable means unquotable", () => {
    const result = computeLandedCost(QUOTE_C, ASSUMPTIONS);
    expect(result).not.toHaveProperty("breakdown");
  });
});

describe("C samplingFee 0 is stated data, not missing", () => {
  it("does not list samplingFee as missing — null and 0 are different facts", () => {
    expect(QUOTE_C.samplingFee).toBe(0);
    expect(missingRequiredFields(QUOTE_C)).not.toContain("samplingFee");
  });

  it("lists only shipping as missing", () => {
    expect(missingRequiredFields(QUOTE_C)).toEqual(["shipping"]);
  });

  it("A and B are missing nothing", () => {
    expect(missingRequiredFields(QUOTE_A)).toEqual([]);
    expect(missingRequiredFields(QUOTE_B)).toEqual([]);
  });
});

describe("duty is charged on product subtotal, never on freight or sampling", () => {
  it("uses productSubtotal as the duty base", () => {
    const zeroDuty = computeLandedCost(QUOTE_A, { ...ASSUMPTIONS, dutyRateBps: bps(0) });
    const fullDuty = computeLandedCost(QUOTE_A, { ...ASSUMPTIONS, dutyRateBps: bps(10_000) });
    if (zeroDuty.kind !== "complete" || fullDuty.kind !== "complete") throw new Error("expected complete");
    expect(zeroDuty.breakdown.dutyEstimate).toBe(0);
    expect(fullDuty.breakdown.dutyEstimate).toBe(384_000);
  });

  it("payment fee is charged on PO value", () => {
    const result = computeLandedCost(QUOTE_A, { ...ASSUMPTIONS, paymentFeeBps: bps(10_000) });
    if (result.kind !== "complete") throw new Error("expected complete");
    expect(result.breakdown.paymentFee).toBe(494_000);
  });
});
