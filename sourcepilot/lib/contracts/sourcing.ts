/**
 * Sourcing types. Transcribed from INTERFACE-CONTRACTS.md §2 (frozen), amended for D1.
 * Do not alter a signature.
 */
import type { Bps, Cents, Bytes32 } from "./money";

export interface PurchaseRequest {
  id: string;                    // "PR-1042"
  idHash: Bytes32;               // keccak256(utf8(id)) — the signed purchaseRequestId
  product: string;
  quantity: number;              // 600
  /**
   * D1: $12.00/unit. INFORMATIONAL REFERENCE ONLY.
   * Rendered as a badge, emitted in the rationale, and NEVER an elimination gate.
   * A quote over this budget still ranks. See `advisories` in lib/score.
   */
  landedPerUnitReference: Cents; // cents(1200)
  maxLeadTimeDays: number;       // 60   — hard gate
  minSpecMatchPct: number;       // 90   — hard gate
  /** Mirrors the mandate's maxDepositBps for UI badging. THE CONTRACT IS THE AUTHORITY. */
  maxDepositBps: Bps;            // 3000 — hard gate (sourcing-side badge only)
  destination: "US";
}

/** Exactly six. `samplingFee` is intentionally absent: a stated $0.00 is data, not a gap. */
export const REQUIRED_QUOTE_FIELDS = [
  "unitPrice", "quantity", "shipping", "leadTimeDays", "depositBps", "specMatchPct",
] as const;
export type RequiredQuoteField = (typeof REQUIRED_QUOTE_FIELDS)[number];

/** null = not stated by the supplier. 0 = stated as zero. These are different facts. */
export interface QuoteInput {
  id: string; supplierId: string; purchaseRequestId: string;
  currency: "USD";
  unitPrice: Cents | null; quantity: number | null;
  samplingFee: Cents | null; shipping: Cents | null;   // seller-arranged freight; part of PO value
  leadTimeDays: number | null; depositBps: Bps | null; specMatchPct: number | null;
}

export interface Supplier {
  id: string; name: string; country: string;
  payeeRef: string;                  // raw; normalize before hashing (lib/mandate/payee)
  verificationStatus: "unverified";  // we do not verify suppliers. Out of scope, say so.
}
