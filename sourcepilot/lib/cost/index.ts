/**
 * Landed cost. INTERFACE-CONTRACTS.md §3 (frozen).
 *
 * Pure, deterministic, integer-only. No model is in this path — the LLM never computes a
 * number that reaches a payment. Every figure here reproduces PRD §5's table to the cent.
 */
import { applyBps, cents, type Cents } from "@/lib/contracts/money";
import {
  REQUIRED_QUOTE_FIELDS,
  type QuoteInput,
  type RequiredQuoteField,
} from "@/lib/contracts/sourcing";
import type { Bps } from "@/lib/contracts/money";

export interface CostAssumptions {
  dutyRateBps: Bps;    // 1650
  paymentFeeBps: Bps;  // 100
  dutyLabel: string;   // "HTS 6109.10.00 MFN base rate — excludes Section 301 and trade-remedy tiers"
  fxNote: string;      // "USD only; FX hardcoded and out of scope"
}

export interface CostBreakdown {
  productSubtotal: Cents;
  samplingFee: Cents;
  shipping: Cents;
  /** product + sampling + seller-arranged freight. THE maxDepositBps DENOMINATOR. */
  poValue: Cents;
  dutyEstimate: Cents;   // applyBps(productSubtotal, dutyRateBps) — goes to customs, never a payee
  paymentFee: Cents;     // applyBps(poValue, paymentFeeBps)
  landedTotal: Cents;    // poValue + dutyEstimate + paymentFee
  landedPerUnitMilliCents: number;
  depositDue: Cents;     // applyBps(poValue, quote.depositBps)
}

export type CostResult =
  | { kind: "complete"; breakdown: CostBreakdown }
  | { kind: "incomplete"; missing: RequiredQuoteField[] };

/**
 * A field is missing only when it is `null` — not stated by the supplier.
 * A stated `0` is data. Conflating the two is how C's $0.00 sampling fee would
 * become a phantom gap, and how a real gap would become a silent zero.
 */
export function missingRequiredFields(q: QuoteInput): RequiredQuoteField[] {
  return REQUIRED_QUOTE_FIELDS.filter((field) => q[field] === null || q[field] === undefined);
}

/**
 * No partial totals. If any required field is unstated the quote is unquotable, and we
 * say so rather than quietly substituting a zero — inventing a freight figure for C
 * would make it look cheapest and would be a lie a data engineer spots in ten seconds.
 */
export function computeLandedCost(q: QuoteInput, a: CostAssumptions): CostResult {
  const missing = missingRequiredFields(q);
  if (missing.length > 0) return { kind: "incomplete", missing };

  // Non-null by the guard above.
  const unitPrice = q.unitPrice as Cents;
  const quantity = q.quantity as number;
  const shipping = q.shipping as Cents;
  const depositBps = q.depositBps as Bps;
  const samplingFee = (q.samplingFee ?? cents(0)) as Cents;

  const productSubtotal = cents(unitPrice * quantity);
  const poValue = cents(productSubtotal + samplingFee + shipping);
  const dutyEstimate = applyBps(productSubtotal, a.dutyRateBps);
  const paymentFee = applyBps(poValue, a.paymentFeeBps);
  const landedTotal = cents(poValue + dutyEstimate + paymentFee);

  return {
    kind: "complete",
    breakdown: {
      productSubtotal,
      samplingFee,
      shipping,
      poValue,
      dutyEstimate,
      paymentFee,
      landedTotal,
      landedPerUnitMilliCents: (landedTotal * 1_000) / quantity,
      depositDue: applyBps(poValue, depositBps),
    },
  };
}
