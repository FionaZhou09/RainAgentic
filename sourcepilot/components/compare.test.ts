import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { REVERT_COPY, type RevertReason } from "@/lib/chain/registry";
import { ASSUMPTIONS, PR_1042, QUOTES, SUPPLIERS } from "@/lib/fixtures/pr-1042";
import { assessQuotes } from "@/lib/score";
import { buildCompareModel, buildSupplierRows, policyBadgeTone } from "@/components/compare-model";

describe("comparison UI logic", () => {
  const assessments = assessQuotes(PR_1042, QUOTES, SUPPLIERS, ASSUMPTIONS);

  it("maps every contract revert reason to legible copy", () => {
    const reasons = [
      "MandateExists", "UnknownMandate", "BadSignature", "NotAgent", "NotPrincipal",
      "Revoked", "NotYetValid", "Expired", "PayeeOutOfScope", "ExceedsMaxTotal",
      "DepositCapExceeded", "BadPayeeSet", "BadApproval", "Unknown",
    ] satisfies RevertReason[];

    expect(Object.keys(REVERT_COPY).sort()).toEqual([...reasons].sort());
    expect(Object.values(REVERT_COPY).every((copy) => copy.length > 24)).toBe(true);
  });

  it("keeps advisory badges neutral and hard failures distinct", () => {
    expect(policyBadgeTone("advisory")).toBe("neutral");
    expect(policyBadgeTone("failure")).toBe("blocked");
  });

  it("renders Supplier C with all four required failure badges", () => {
    const rows = buildSupplierRows(PR_1042, QUOTES, SUPPLIERS, assessments);
    const supplierC = rows.find((row) => row.supplier.id === "SUP-C");

    expect(supplierC?.badges.map((badge) => badge.code)).toEqual([
      "MISSING_REQUIRED_FIELD",
      "LEAD_TIME_OVER",
      "SPEC_MATCH_UNDER",
      "DEPOSIT_OVER_CAP",
    ]);
  });

  it("exposes rank and environment while withholding numeric score", () => {
    const model = buildCompareModel(PR_1042, QUOTES, SUPPLIERS, assessments, "Local Anvil");

    expect(model.rows.find((row) => row.assessment.rank === 1)?.assessment.rank).toBe(1);
    expect(model.environment).toBe("Local Anvil");
    expect(model.displayRankingMetric).toBe(false);
  });

  it("does not combine fixed projector-width columns with clipped supplier cards", () => {
    const source = readFileSync(new URL("./compare-screen.tsx", import.meta.url), "utf8");

    expect(source).not.toContain("overflow-hidden rounded-2xl");
    expect(source).not.toMatch(/(?:^|\s)xl:grid-cols-\[minmax\(190px,0\.8fr\)_minmax\(360px,1\.5fr\)_minmax\(250px,1fr\)\]/);
    expect(source).toContain("2xl:grid-cols-[minmax(190px,0.8fr)_minmax(360px,1.5fr)_minmax(250px,1fr)]");
  });
});
