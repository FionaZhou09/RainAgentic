import { describe, expect, it } from "vitest";
import { ASSUMPTIONS, PR_1042, QUOTES, SUPPLIERS } from "@/lib/fixtures/pr-1042";
import { assessQuotes, type QuoteAssessment } from "@/lib/score";
import { renderRationale } from "./rationale";

const assessments = assessQuotes(PR_1042, QUOTES, SUPPLIERS, ASSUMPTIONS);
const bySupplier = (supplierId: string) =>
  assessments.find((assessment) => assessment.supplierId === supplierId)!;

describe("renderRationale", () => {
  it("renders byte-identical output for the same WP1 assessment", () => {
    const input = {
      assessment: bySupplier("SUP-B"),
      assumptions: [ASSUMPTIONS.dutyLabel, ASSUMPTIONS.fxNote],
    };

    const first = JSON.stringify(renderRationale(input));
    const second = JSON.stringify(renderRationale(input));

    expect(second).toBe(first);
  });

  it("keeps facts, assumptions, missing data, and decision separate", () => {
    const rationale = renderRationale({
      assessment: bySupplier("SUP-B"),
      assumptions: [ASSUMPTIONS.dutyLabel, ASSUMPTIONS.fxNote],
    });

    expect(Object.keys(rationale)).toEqual(["facts", "assumptions", "missingData", "decision"]);
    expect(rationale.assumptions).toEqual([ASSUMPTIONS.dutyLabel, ASSUMPTIONS.fxNote]);
    expect(rationale.missingData).toEqual([]);
    expect(rationale.facts).not.toContain(ASSUMPTIONS.dutyLabel);
    expect(rationale.decision).not.toContain(ASSUMPTIONS.fxNote);
  });

  it("explicitly names Supplier C's missing shipping data", () => {
    const rationale = renderRationale({
      assessment: bySupplier("SUP-C"),
      assumptions: ["Freight is not estimated when supplier shipping is unstated."],
    });

    expect(rationale.missingData).toContain("Supplier C did not state shipping.");
  });

  it("renders no numeric token that is absent from the assessment input", () => {
    const assessment: QuoteAssessment = {
      quoteId: "quote-no-digits",
      supplierId: "SUP-X",
      completenessPct: 83.3,
      cost: {
        kind: "complete",
        breakdown: {
          productSubtotal: 411_000 as never,
          samplingFee: 17_000 as never,
          shipping: 61_000 as never,
          poValue: 489_000 as never,
          dutyEstimate: 67_815 as never,
          paymentFee: 4_930 as never,
          landedTotal: 561_745 as never,
          landedPerUnitMilliCents: 942_910,
          depositDue: 146_700 as never,
        },
      },
      hardFailures: [{
        code: "LEAD_TIME_OVER",
        message: "Lead time is outside policy.",
        observed: "forty-five days",
        limit: "sixty days",
      }],
      advisories: [],
      score: null,
      rank: null,
    };
    const rendered = renderRationale({ assessment, assumptions: [] });
    const renderedNumbers: string[] = JSON.stringify(rendered).match(/\d+(?:\.\d+)?/g) ?? [];
    const inputNumbers: string[] = JSON.stringify(assessment).match(/\d+(?:\.\d+)?/g) ?? [];

    expect(renderedNumbers.length).toBeGreaterThan(0);
    expect(renderedNumbers.every((number) => inputNumbers.includes(number))).toBe(true);
  });
});
