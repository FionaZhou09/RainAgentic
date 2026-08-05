/**
 * Demo fixtures. INTERFACE-CONTRACTS.md §9 (frozen), reconciled against PRD §5's
 * supplier table. Every derived figure in that table is unit-tested to the cent in
 * lib/cost — if a judge recomputes on their phone, it matches.
 *
 * Supplier identities per PRD §5: A = Yuanfeng Textiles, B = Hanzhou Apparel Co.,
 * C = Rongcheng Garment. B is the winner; A dies on its deposit, C on its terms.
 */
import { keccak256, toHex } from "viem";
import { cents, bps } from "@/lib/contracts/money";
import type { PurchaseRequest, QuoteInput, Supplier } from "@/lib/contracts/sourcing";
import type { CostAssumptions } from "@/lib/cost";

export const PR_1042: PurchaseRequest = {
  id: "PR-1042",
  idHash: keccak256(toHex("PR-1042")),
  product: "600 heavyweight cotton T-shirts, 240gsm",
  quantity: 600,
  landedPerUnitReference: cents(1200),   // D1: $12.00/unit, INFORMATIONAL — never a gate
  maxLeadTimeDays: 60,
  minSpecMatchPct: 90,
  maxDepositBps: bps(3000),
  destination: "US",
};

export const ASSUMPTIONS: CostAssumptions = {
  dutyRateBps: bps(1650),
  paymentFeeBps: bps(100),
  dutyLabel: "HTS 6109.10.00 MFN base rate — excludes Section 301 and trade-remedy tiers",
  fxNote: "USD only; FX hardcoded and out of scope",
};

/** A — Yuanfeng Textiles. Nominally cheapest; eliminated by a 50% deposit against a 30% cap. */
export const QUOTE_A: QuoteInput = {
  id: "Q-A", supplierId: "SUP-A", purchaseRequestId: "PR-1042",
  currency: "USD",
  unitPrice: cents(640), quantity: 600,
  samplingFee: cents(12_000), shipping: cents(98_000),
  leadTimeDays: 55, depositBps: bps(5000), specMatchPct: 95,
};

/** B — Hanzhou Apparel Co. The only quote satisfying every hard constraint.
 *  Its deposit sits at EXACTLY 3000 bps, so a `<` where `<=` is required
 *  hard-blocks our own winner on stage. */
export const QUOTE_B: QuoteInput = {
  id: "Q-B", supplierId: "SUP-B", purchaseRequestId: "PR-1042",
  currency: "USD",
  unitPrice: cents(685), quantity: 600,
  samplingFee: cents(18_000), shipping: cents(64_000),
  leadTimeDays: 45, depositBps: bps(3000), specMatchPct: 98,
};

/** C — Rongcheng Garment. Genuinely the cheapest per unit and probably cheapest landed.
 *  It is NOT secretly expensive — it is cheap and non-compliant. `shipping: null` means
 *  not stated (unquotable landed cost); `samplingFee: 0` means stated as zero. */
export const QUOTE_C: QuoteInput = {
  id: "Q-C", supplierId: "SUP-C", purchaseRequestId: "PR-1042",
  currency: "USD",
  unitPrice: cents(595), quantity: 600,
  samplingFee: cents(0), shipping: null,
  leadTimeDays: 70, depositBps: bps(10_000), specMatchPct: 87,
};

export const QUOTES: QuoteInput[] = [QUOTE_A, QUOTE_B, QUOTE_C];

export const SUPPLIERS: Supplier[] = [
  { id: "SUP-A", name: "Yuanfeng Textiles",  country: "CN", payeeRef: "rain:payee:yuanfeng-textiles",  verificationStatus: "unverified" },
  { id: "SUP-B", name: "Hanzhou Apparel Co.", country: "CN", payeeRef: "rain:payee:hanzhou-apparel",   verificationStatus: "unverified" },
  { id: "SUP-C", name: "Rongcheng Garment",   country: "CN", payeeRef: "rain:payee:rongcheng-garment", verificationStatus: "unverified" },
];

export const MANDATE_FIXTURE = {
  autonomousMaxMinor:  20_000n,   // $200.00 — the $180 sample sits under it
  maxTotalMinor:      184_000n,   // D3: $1,840. Demo spends $1,659, leaving $181.
  maxDepositBps:        3_000n,   // B is EXACTLY at the cap. Boundary test pinned.
  validAfterOffsetSec:     -60,   // clock skew
  validUntilOffsetDays:     90,   // mandate window 90 DAYS. Delivery deadline 60. Never conflate.
  signedAt: "prior session (Thursday) — visible timestamp in the UI",
} as const;

export const PAYEE_REFS = [
  "rain:payee:hanzhou-apparel",
  "rain:payee:yuanfeng-textiles",
  "rain:payee:rongcheng-garment",
];
/** The changed-bank-account case. MUST NOT be in PAYEE_REFS — the contract rejects it. */
export const FRAUD_PAYEE_REF = "rain:payee:hanzhou-apparel-new-account";
