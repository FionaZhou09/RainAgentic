import { describe, it, expect } from "vitest";
import { cents, bps, applyBps, fmtUSD, perUnit } from "./money";

describe("cents()", () => {
  it("accepts integers", () => {
    expect(cents(0)).toBe(0);
    expect(cents(184_000)).toBe(184_000);
    expect(cents(-100)).toBe(-100);
  });

  it("throws RangeError on a non-integer — a float must never enter money arithmetic", () => {
    expect(() => cents(12.5)).toThrow(RangeError);
    expect(() => cents(0.1 + 0.2)).toThrow(RangeError);
  });

  it("throws RangeError on NaN and Infinity", () => {
    expect(() => cents(NaN)).toThrow(RangeError);
    expect(() => cents(Infinity)).toThrow(RangeError);
  });
});

describe("bps()", () => {
  it("accepts the full inclusive range [0, 10_000]", () => {
    expect(bps(0)).toBe(0);
    expect(bps(3_000)).toBe(3_000);
    expect(bps(10_000)).toBe(10_000);
  });

  it("throws RangeError outside [0, 10_000]", () => {
    expect(() => bps(-1)).toThrow(RangeError);
    expect(() => bps(10_001)).toThrow(RangeError);
  });

  it("throws RangeError on a non-integer", () => {
    expect(() => bps(1650.5)).toThrow(RangeError);
  });
});

describe("applyBps() — the ONLY rounding rule: half-up, at cent granularity", () => {
  // These five are the figures the whole demo is recomputed against (PRD §5).
  it("reproduces every pinned figure from the supplier table exactly", () => {
    expect(applyBps(cents(384_000), bps(1_650))).toBe(63_360);   // A duty
    expect(applyBps(cents(411_000), bps(1_650))).toBe(67_815);   // B duty
    expect(applyBps(cents(494_000), bps(100))).toBe(4_940);      // A payment fee
    expect(applyBps(cents(493_000), bps(100))).toBe(4_930);      // B payment fee
    expect(applyBps(cents(494_000), bps(5_000))).toBe(247_000);  // A deposit @ 50%
    expect(applyBps(cents(493_000), bps(3_000))).toBe(147_900);  // B deposit @ 30%
  });

  it("rounds half UP, not half-even and not down", () => {
    // 100 * 50 / 10000 = 0.5 -> 1
    expect(applyBps(cents(100), bps(50))).toBe(1);
    // 300 * 50 / 10000 = 1.5 -> 2  (half-even would give 2 here too)
    expect(applyBps(cents(300), bps(50))).toBe(2);
    // 500 * 50 / 10000 = 2.5 -> 3  (half-even would give 2 — this is the discriminating case)
    expect(applyBps(cents(500), bps(50))).toBe(3);
  });

  it("returns an exact integer for every result", () => {
    for (let rate = 0; rate <= 10_000; rate += 137) {
      expect(Number.isInteger(applyBps(cents(493_000), bps(rate)))).toBe(true);
    }
  });

  it("is exact at the boundaries", () => {
    expect(applyBps(cents(493_000), bps(0))).toBe(0);
    expect(applyBps(cents(493_000), bps(10_000))).toBe(493_000);
  });
});

describe("fmtUSD()", () => {
  it("formats cents as display dollars", () => {
    expect(fmtUSD(cents(562_300))).toBe("$5,623.00");
    expect(fmtUSD(cents(565_745))).toBe("$5,657.45");
    expect(fmtUSD(cents(147_900))).toBe("$1,479.00");
    expect(fmtUSD(cents(0))).toBe("$0.00");
  });
});

describe("perUnit()", () => {
  it("reproduces A and B's per-unit landed figures to four decimals", () => {
    expect(perUnit(cents(562_300), 600).display).toBe("9.3717");
    expect(perUnit(cents(565_745), 600).display).toBe("9.4291");
  });

  it("keeps exactMilliCents unrounded so display rounding never re-enters arithmetic", () => {
    expect(perUnit(cents(562_300), 600).exactMilliCents).toBeCloseTo(937_166.667, 3);
  });
});
