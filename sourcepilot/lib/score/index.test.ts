import { describe, it, expect } from "vitest";
import { bps } from "@/lib/contracts/money";
import { assessQuotes } from "./index";
import type { PolicyFailureCode } from "./index";
import { PR_1042, ASSUMPTIONS, QUOTES, SUPPLIERS, QUOTE_B } from "@/lib/fixtures/pr-1042";

const assess = (a = ASSUMPTIONS) => assessQuotes(PR_1042, QUOTES, SUPPLIERS, a);
const bySupplier = (id: string) => assess().find((x) => x.supplierId === id)!;
const codes = (id: string) => bySupplier(id).hardFailures.map((f) => f.code);

describe("hard gates", () => {
  it("A eliminated on DEPOSIT_OVER_CAP (5000 > 3000)", () => {
    expect(codes("SUP-A")).toContain("DEPOSIT_OVER_CAP");
    expect(bySupplier("SUP-A").rank).toBeNull();
  });

  it("C carries MISSING_REQUIRED_FIELD[shipping], LEAD_TIME_OVER (70>60) and SPEC_MATCH_UNDER (87<90)", () => {
    const c = bySupplier("SUP-C");
    expect(codes("SUP-C")).toContain("MISSING_REQUIRED_FIELD");
    expect(codes("SUP-C")).toContain("LEAD_TIME_OVER");
    expect(codes("SUP-C")).toContain("SPEC_MATCH_UNDER");
    expect(c.hardFailures.find((f) => f.code === "MISSING_REQUIRED_FIELD")?.field).toBe("shipping");
    expect(c.rank).toBeNull();
  });

  it("C also carries DEPOSIT_OVER_CAP — PRD §5 gives it 100% up front against a 30% cap", () => {
    // The frozen criteria say C "additionally carries" lead time and spec match; that is
    // a floor, not an exhaustive list. Asserting exactly three failures here would
    // contradict the fixture data.
    expect(codes("SUP-C")).toContain("DEPOSIT_OVER_CAP");
  });

  it("B at exactly 3000 bps passes the cap", () => {
    // The `<=` trap. A `<` here hard-blocks our own winner in front of the judges.
    expect(QUOTE_B.depositBps).toBe(3000);
    expect(PR_1042.maxDepositBps).toBe(3000);
    expect(codes("SUP-B")).not.toContain("DEPOSIT_OVER_CAP");
    expect(bySupplier("SUP-B").hardFailures).toEqual([]);
  });

  it("B is the only quote satisfying every hard constraint, and ranks 1", () => {
    const b = bySupplier("SUP-B");
    expect(b.hardFailures).toEqual([]);
    expect(b.rank).toBe(1);
    expect(b.score).not.toBeNull();
  });

  it("eliminated quotes never receive a rank", () => {
    for (const a of assess()) {
      if (a.hardFailures.length > 0) expect(a.rank).toBeNull();
    }
  });
});

describe("completeness", () => {
  it("C is incomplete, completeness 83.3%", () => {
    expect(bySupplier("SUP-C").completenessPct).toBeCloseTo(83.3, 1);
  });

  it("A and B are 100% complete", () => {
    expect(bySupplier("SUP-A").completenessPct).toBe(100);
    expect(bySupplier("SUP-B").completenessPct).toBe(100);
  });

  it("never scores an unquotable quote — that would imply we priced C", () => {
    expect(bySupplier("SUP-C").score).toBeNull();
    expect(bySupplier("SUP-C").cost.kind).toBe("incomplete");
  });
});

describe("D1 — landed cost is INFORMATIONAL and can eliminate nobody", () => {
  it("landed cost never appears in hardFailures", () => {
    // Compile-time: "LANDED_OVER_REFERENCE" is not assignable to PolicyFailureCode.
    const priceCodes: PolicyFailureCode[] = [
      "MISSING_REQUIRED_FIELD", "LEAD_TIME_OVER", "SPEC_MATCH_UNDER", "DEPOSIT_OVER_CAP",
    ];
    expect(priceCodes).not.toContain("LANDED_OVER_REFERENCE" as never);

    // Runtime: across every duty rate, no failure code is ever price-related.
    for (let rate = 0; rate <= 10_000; rate += 250) {
      for (const a of assess({ ...ASSUMPTIONS, dutyRateBps: bps(rate) })) {
        for (const f of a.hardFailures) {
          expect(f.code).not.toBe("LANDED_OVER_REFERENCE");
        }
      }
    }
  });

  it("advisories are separate from hardFailures and never affect rank", () => {
    // A duty rate high enough to blow past the $12.00/unit reference must still not
    // change who is eliminated or who wins.
    const extreme = assess({ ...ASSUMPTIONS, dutyRateBps: bps(10_000) });
    const b = extreme.find((x) => x.supplierId === "SUP-B")!;
    expect(b.advisories.some((x) => x.code === "LANDED_OVER_REFERENCE")).toBe(true);
    expect(b.hardFailures).toEqual([]);
    expect(b.rank).toBe(1);
  });

  /**
   * THE test that removes tariff policy from the critical path. If the effective duty
   * rate on Chinese apparel is 16.5% or 35% or anything else, the demo does not move.
   */
  it("property: for dutyRateBps 0..10000, eliminated set is constant {A, C} and B ranks 1", () => {
    for (let rate = 0; rate <= 10_000; rate++) {
      const result = assess({ ...ASSUMPTIONS, dutyRateBps: bps(rate) });

      const eliminated = result
        .filter((x) => x.hardFailures.length > 0)
        .map((x) => x.supplierId)
        .sort();
      expect(eliminated, `duty ${rate}bps`).toEqual(["SUP-A", "SUP-C"]);

      const winner = result.find((x) => x.rank === 1);
      expect(winner?.supplierId, `duty ${rate}bps`).toBe("SUP-B");
    }
  });
});
