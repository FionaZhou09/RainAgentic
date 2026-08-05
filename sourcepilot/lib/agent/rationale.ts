import type { RequiredQuoteField } from "@/lib/contracts/sourcing";
import type { Rationale } from "@/lib/contracts/api";
import type { QuoteAssessment } from "@/lib/score";

export type { Rationale } from "@/lib/contracts/api";

export interface RationaleInput {
  assessment: QuoteAssessment;
  /** Already-authored assumption strings; rendered verbatim and never inferred here. */
  assumptions: readonly string[];
}

/** Pure slot filling over WP1 output. This module performs no cost or policy arithmetic. */
export function renderRationale({ assessment, assumptions }: RationaleInput): Rationale {
  const facts = [
    `Quote completeness: ${assessment.completenessPct}%.`,
    ...assessment.hardFailures.map(renderPolicyFact),
    ...assessment.advisories.map(renderPolicyFact),
  ];

  const missing = assessment.cost.kind === "incomplete"
    ? assessment.cost.missing
    : assessment.hardFailures
        .filter((failure) => failure.code === "MISSING_REQUIRED_FIELD")
        .flatMap((failure) => failure.field ? [failure.field] : []);

  return {
    facts,
    assumptions: [...assumptions],
    missingData: missing.map((field) => renderMissingData(assessment.supplierId, field)),
    decision: assessment.rank === null
      ? "Not selected because the assessment reports hard failures or incomplete cost data."
      : `Ranked ${assessment.rank} by the supplied assessment.`,
  };
}

function renderPolicyFact(note: { message: string; observed: string; limit: string }): string {
  return `${note.message} Observed: ${note.observed}. Limit: ${note.limit}.`;
}

function renderMissingData(supplierId: string, field: RequiredQuoteField): string {
  return `${supplierLabel(supplierId)} did not state ${field}.`;
}

function supplierLabel(supplierId: string): string {
  const fixtureLabel = /^SUP-([A-Z])$/.exec(supplierId)?.[1];
  return fixtureLabel ? `Supplier ${fixtureLabel}` : `Supplier ${supplierId}`;
}
