import { DEMO_COPY } from "@/lib/contracts/copy";
import type { PurchaseRequest, QuoteInput, Supplier } from "@/lib/contracts/sourcing";
import type { PolicyFailureCode, QuoteAssessment } from "@/lib/score";

export type BadgeTone = "positive" | "blocked" | "neutral";

export interface SupplierBadge {
  code: PolicyFailureCode | "LANDED_OVER_REFERENCE" | "CLEARED";
  label: string;
  tone: BadgeTone;
}

export interface SupplierRow {
  supplier: Supplier;
  quote: QuoteInput;
  assessment: QuoteAssessment;
  badges: SupplierBadge[];
}

export interface CompareModel {
  environment: "Local Anvil" | "Monad Testnet";
  displayRankingMetric: false;
  rows: SupplierRow[];
}

export function policyBadgeTone(kind: "failure" | "advisory"): BadgeTone {
  return kind === "advisory" ? "neutral" : "blocked";
}

export function buildSupplierRows(
  purchaseRequest: PurchaseRequest,
  quotes: QuoteInput[],
  suppliers: Supplier[],
  assessments: QuoteAssessment[],
): SupplierRow[] {
  void purchaseRequest;

  return suppliers.map((supplier) => {
    const quote = quotes.find((candidate) => candidate.supplierId === supplier.id);
    const assessment = assessments.find((candidate) => candidate.supplierId === supplier.id);

    if (!quote || !assessment) {
      throw new Error(`Missing quote assessment for ${supplier.id}`);
    }

    const failures = assessment.hardFailures.map((failure) => ({
      code: failure.code,
      label: failure.message,
      tone: policyBadgeTone("failure"),
    } as const));
    const advisories = assessment.advisories.map((advisory) => ({
      code: advisory.code,
      label: advisory.message,
      tone: policyBadgeTone("advisory"),
    } as const));
    const badges: SupplierBadge[] = failures.length === 0 && advisories.length === 0
      ? [{ code: "CLEARED", label: DEMO_COPY.clearsTermsLabel, tone: "positive" }]
      : [...failures, ...advisories];

    return { supplier, quote, assessment, badges };
  });
}

export function buildCompareModel(
  purchaseRequest: PurchaseRequest,
  quotes: QuoteInput[],
  suppliers: Supplier[],
  assessments: QuoteAssessment[],
  environment: CompareModel["environment"],
): CompareModel {
  return {
    environment,
    displayRankingMetric: false,
    rows: buildSupplierRows(purchaseRequest, quotes, suppliers, assessments),
  };
}
