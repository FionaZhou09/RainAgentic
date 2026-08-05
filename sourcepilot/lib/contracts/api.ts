import type { Hex, Address, Bytes32 } from "./money";
import type { PurchaseRequest } from "./sourcing";
import type { CostAssumptions } from "@/lib/cost";
import type { QuoteAssessment } from "@/lib/score";
import type { SerializedMandate } from "@/lib/mandate/types";

export interface AnalyzeRequest { purchaseRequestId: string }

export interface Rationale {
  facts: string[];        // computed by /lib/cost and /lib/score. Slot-filled, never generated.
  assumptions: string[];  // duty label, hardcoded FX, freight assumption for C
  missingData: string[];  // named explicitly. "Supplier C did not state shipping."
  decision: string;
}

export interface AnalyzeResponse {
  pr: PurchaseRequest;
  assumptions: CostAssumptions;
  assessments: QuoteAssessment[];
  recommendation: { quoteId: string; rationale: Rationale };
}

export interface MandateRequest {
  mandate: SerializedMandate;
  signature: Hex;
  payeeRefs: string[];
}

export interface MandateResponse {
  mandateHash: Bytes32;
  monadTxHash: Hex;
  explorerUrl: string;
  payeeScope: Bytes32;
  payeePreimage: string;
  recoveredSigner: Address;
  constraints: {
    maxTotalMinor: string;
    autonomousMaxMinor: string;
    maxDepositBps: number;
    validAfter: number;
    validUntil: number;
  };
}

export type EventType =
  | "quotes_analyzed" | "mandate_registered" | "payment_attempted" | "precheck_failed"
  | "escalated" | "approval_signed" | "chain_authorized" | "chain_rejected"
  | "rain_instruction_created" | "rain_status" | "mandate_revoked";

export interface EventRecord {
  id: string;
  purchaseRequestId: string;
  type: EventType;
  actor: "user" | "agent" | "system";
  payload: Record<string, unknown>;
  createdAt: string;
}
