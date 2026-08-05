/**
 * Quote assessment. INTERFACE-CONTRACTS.md §3 (frozen), amended for D1.
 *
 * D1 is enforced by SHAPE here, not by vigilance: there is no price-related member of
 * `PolicyFailureCode`, so "eliminated for being over budget" is not a state this module
 * can represent. Price lives in `advisories` and is rendered as a neutral badge.
 *
 * Payment-authority failures (ceiling, payee scope, window, revocation, deposit) come
 * from the CONTRACT, never from here.
 */
import { computeLandedCost, type CostAssumptions, type CostResult } from "@/lib/cost";
import { missingRequiredFields } from "@/lib/cost";
import { REQUIRED_QUOTE_FIELDS, type PurchaseRequest, type QuoteInput, type RequiredQuoteField, type Supplier } from "@/lib/contracts/sourcing";

export type PolicyFailureCode =
  | "MISSING_REQUIRED_FIELD" | "LEAD_TIME_OVER" | "SPEC_MATCH_UNDER" | "DEPOSIT_OVER_CAP";

/** D1: no longer a failure code. Advisory only, and it CANNOT appear in `hardFailures`. */
export type AdvisoryCode = "LANDED_OVER_REFERENCE";

export interface PolicyNote<C extends string> {
  code: C;
  field?: RequiredQuoteField;
  message: string;   // human-readable, rendered verbatim as a badge
  observed: string;  // "70 days"
  limit: string;     // "60 days"
}
export type PolicyFailure  = PolicyNote<PolicyFailureCode>;
export type PolicyAdvisory = PolicyNote<AdvisoryCode>;

export interface ScoreWeights { landedCost: number; leadTime: number; specMatch: number; completeness: number }

/**
 * NOT pinned by INTERFACE-CONTRACTS.md — `assessQuotes` takes no weights argument, so
 * these must live as a module constant. They cannot move the demo: B is the only quote
 * that clears every hard gate, so it ranks 1 under any non-degenerate weighting.
 * Documented as an implementation choice rather than a spec value.
 */
export const DEFAULT_WEIGHTS: ScoreWeights = {
  landedCost: 0.40,
  leadTime: 0.20,
  specMatch: 0.30,
  completeness: 0.10,
};

export interface QuoteAssessment {
  quoteId: string; supplierId: string;
  /** 100 * present/6. A=100, B=100, C=83.3 */
  completenessPct: number;
  cost: CostResult;
  /** Sourcing eliminations only, and — per D1 — price is not among them. */
  hardFailures: PolicyFailure[];
  /** D1: informational. Rendered as a neutral badge. NEVER affects rank or eligibility. */
  advisories: PolicyAdvisory[];
  /** null when cost is incomplete. Never score an unquotable quote. */
  score: number | null;
  rank: number | null;  // null iff hardFailures.length > 0 || score === null
}

export function assessQuotes(
  pr: PurchaseRequest,
  quotes: QuoteInput[],
  suppliers: Supplier[],
  a: CostAssumptions,
): QuoteAssessment[] {
  const assessments: QuoteAssessment[] = quotes.map((q) => {
    const cost = computeLandedCost(q, a);
    const missing = missingRequiredFields(q);

    const hardFailures: PolicyFailure[] = [];

    for (const field of missing) {
      hardFailures.push({
        code: "MISSING_REQUIRED_FIELD",
        field,
        message: `Supplier did not state ${field}. Landed cost cannot be quoted.`,
        observed: "not stated",
        limit: "required",
      });
    }

    if (q.leadTimeDays !== null && q.leadTimeDays > pr.maxLeadTimeDays) {
      hardFailures.push({
        code: "LEAD_TIME_OVER",
        message: `Lead time exceeds the ${pr.maxLeadTimeDays}-day delivery deadline.`,
        observed: `${q.leadTimeDays} days`,
        limit: `${pr.maxLeadTimeDays} days`,
      });
    }

    if (q.specMatchPct !== null && q.specMatchPct < pr.minSpecMatchPct) {
      hardFailures.push({
        code: "SPEC_MATCH_UNDER",
        message: `Spec match is below the ${pr.minSpecMatchPct}% floor.`,
        observed: `${q.specMatchPct}%`,
        limit: `${pr.minSpecMatchPct}%`,
      });
    }

    // `<=` is the pinned boundary: B sits at EXACTLY 3000 bps and must pass.
    if (q.depositBps !== null && q.depositBps > pr.maxDepositBps) {
      hardFailures.push({
        code: "DEPOSIT_OVER_CAP",
        message: `Deposit exceeds the ${pr.maxDepositBps / 100}% cap on supplier PO value.`,
        observed: `${q.depositBps / 100}%`,
        limit: `${pr.maxDepositBps / 100}%`,
      });
    }

    // D1: advisory only. Never pushed into hardFailures, never consulted for rank.
    const advisories: PolicyAdvisory[] = [];
    if (cost.kind === "complete") {
      const perUnitCents = cost.breakdown.landedPerUnitMilliCents / 1_000;
      if (perUnitCents > pr.landedPerUnitReference) {
        advisories.push({
          code: "LANDED_OVER_REFERENCE",
          message: "Landed cost per unit is above the informational budget reference.",
          observed: `$${(perUnitCents / 100).toFixed(4)}/unit`,
          limit: `$${(pr.landedPerUnitReference / 100).toFixed(2)}/unit`,
        });
      }
    }

    const present = REQUIRED_QUOTE_FIELDS.length - missing.length;
    const completenessPct = Math.round((100 * present) / REQUIRED_QUOTE_FIELDS.length * 10) / 10;

    return {
      quoteId: q.id,
      supplierId: q.supplierId,
      completenessPct,
      cost,
      hardFailures,
      advisories,
      score: null as number | null,
      rank: null as number | null,
    };
  });

  // Score only quotes that cleared every hard gate AND produced a complete cost.
  const eligible = assessments.filter(
    (x) => x.hardFailures.length === 0 && x.cost.kind === "complete",
  );

  if (eligible.length > 0) {
    const landed = eligible.map((x) => (x.cost as Extract<CostResult, { kind: "complete" }>).breakdown.landedTotal);
    const leads = eligible.map((x) => quotes.find((q) => q.id === x.quoteId)!.leadTimeDays!);
    const specs = eligible.map((x) => quotes.find((q) => q.id === x.quoteId)!.specMatchPct!);

    for (const x of eligible) {
      const q = quotes.find((qq) => qq.id === x.quoteId)!;
      const b = (x.cost as Extract<CostResult, { kind: "complete" }>).breakdown;
      x.score =
        DEFAULT_WEIGHTS.landedCost * normalizeLowerIsBetter(b.landedTotal, landed) +
        DEFAULT_WEIGHTS.leadTime * normalizeLowerIsBetter(q.leadTimeDays!, leads) +
        DEFAULT_WEIGHTS.specMatch * normalizeHigherIsBetter(q.specMatchPct!, specs) +
        DEFAULT_WEIGHTS.completeness * (x.completenessPct / 100);
    }

    [...eligible]
      .sort((p, r) => r.score! - p.score!)
      .forEach((x, i) => { x.rank = i + 1; });
  }

  void suppliers;  // suppliers are carried for rendering; assessment needs no field from them
  return assessments;
}

/** 1 when best (lowest) in the set, 0 when worst. Degenerate single-element sets score 1. */
function normalizeLowerIsBetter(value: number, all: number[]): number {
  const min = Math.min(...all), max = Math.max(...all);
  return max === min ? 1 : (max - value) / (max - min);
}

function normalizeHigherIsBetter(value: number, all: number[]): number {
  const min = Math.min(...all), max = Math.max(...all);
  return max === min ? 1 : (value - min) / (max - min);
}
