import type { Hex, Address, Bytes32 } from "./money";
import type { PurchaseRequest } from "./sourcing";
import type { CostAssumptions } from "@/lib/cost";
import type { QuoteAssessment } from "@/lib/score";
import type { SerializedApproval, SerializedMandate } from "@/lib/mandate/types";
import { STAGE, REVERT_COPY, type Stage, type RegistryClient, type RevertReason } from "@/lib/chain/registry";
import type { AttemptKey, RainPort } from "@/lib/rain/port";
import type { PolicyFailureCode } from "@/lib/score";
import type { ProcurementMandate, MandateDomainConfig } from "@/lib/mandate/types";
import type { QuoteInput, Supplier } from "./sourcing";
import type { EventStore } from "@/lib/events";
import { recoverApprover, type PaymentApproval } from "@/lib/mandate";
import { hashPayeeRef } from "@/lib/mandate/payee";

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
  transactionHash: Hex;
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

export interface PayRequest {
  purchaseRequestId: string;
  supplierId: string;
  payeeRef: string;
  amountMinor: number;
  stage: Stage;
  idempotencyKey: AttemptKey;
  approvalSig?: Hex;
  approvalNonce?: Bytes32;
  materializeRevert?: boolean;
}

export type PayResponse =
  | { outcome: "autonomous"; paymentId: string; rainPaymentId: string;
      transactionHash: Hex; explorerUrl: string; remainingMinor: string; events: EventRecord[] }
  | { outcome: "pending_approval"; paymentId: string; reason: string;
      approvalPayload: SerializedApproval; chainCalled: false; rainCalled: false; events: EventRecord[] }
  | { outcome: "approved"; paymentId: string; rainPaymentId: string;
      transactionHash: Hex; explorerUrl: string; remainingMinor: string; approver: Address; events: EventRecord[] }
  | { outcome: "blocked"; paymentId: string; layer: "offchain" | "onchain";
      reason: RevertReason | PolicyFailureCode; message: string;
      transactionHash: Hex | null; rainCalled: false; events: EventRecord[] };

export interface PayContext {
  purchaseRequest: PurchaseRequest;
  quote: QuoteInput;
  supplier: Supplier;
  assessment: QuoteAssessment;
  mandate: ProcurementMandate;
  mandateHash: Bytes32;
  payeeSet: Bytes32[];
  caller: Address;
  mandateDomain: MandateDomainConfig;
  registry: RegistryClient;
  rain: RainPort;
  events: EventStore;
  attemptCache: Map<AttemptKey, PayResponse>;
  newPaymentId?: () => string;
  newApprovalNonce?: () => Bytes32;
}

const ZERO_BYTES32 = `0x${"00".repeat(32)}` as Bytes32;

/**
 * THE ORDER IS THE CONTRACT (D7). Do not reorder or add checks to step 2.
 * 1. AttemptKey cache.
 * 2. Only required fields, lead/spec sourcing failures, and caller identity.
 * 3. Pending escalation before chain or Rain.
 * 4. Complete approval reconstruction and verification.
 * 5. Simulate the real contract call.
 * 6. Record the real contract transaction.
 * 7. First Rain call.
 * 8. Persist events/result and cache the exact response.
 */
export async function evaluatePayment(req: PayRequest, ctx: PayContext): Promise<PayResponse> {
  // 1. Idempotency lookup uses only the per-attempt key.
  const cached = ctx.attemptCache.get(req.idempotencyKey);
  if (cached) return cached;
  const paymentId = ctx.newPaymentId?.() ?? `pay_${crypto.randomUUID()}`;
  emit(ctx, req, "payment_attempted", "agent", { paymentId, supplierId: req.supplierId, amountMinor: req.amountMinor, stage: req.stage });

  // 2. Exactly the three permitted off-chain check classes.
  const sourcingFailure = ctx.assessment.hardFailures.find((f) =>
    f.code === "MISSING_REQUIRED_FIELD" || f.code === "LEAD_TIME_OVER" || f.code === "SPEC_MATCH_UNDER");
  if (!req.purchaseRequestId || !req.supplierId)
    return cache(ctx, req, makeBlocked(ctx, req, paymentId, "offchain", "MISSING_REQUIRED_FIELD", "Payment request is missing a required field."));
  if (sourcingFailure)
    return cache(ctx, req, makeBlocked(ctx, req, paymentId, "offchain", sourcingFailure.code, sourcingFailure.message));
  if (ctx.caller.toLowerCase() !== ctx.mandate.agent.toLowerCase())
    return cache(ctx, req, makeBlocked(ctx, req, paymentId, "offchain", "NotAgent", REVERT_COPY.NotAgent));

  const payeeHash = hashPayeeRef(req.payeeRef);
  const poValue = ctx.assessment.cost.kind === "complete" ? BigInt(ctx.assessment.cost.breakdown.poValue) : 0n;
  const approval: PaymentApproval = { mandateHash: ctx.mandateHash, payeeHash, amount: BigInt(req.amountMinor), poValue,
    stage: STAGE[req.stage], nonce: req.approvalSig ? (req.approvalNonce ?? ZERO_BYTES32) : (ctx.newApprovalNonce?.() ?? randomNonce()) };

  // 3. Escalation returns before chain or Rain and always mints a fresh nonce.
  if (approval.amount > ctx.mandate.autonomousMax && !req.approvalSig) {
    const approvalPayload: SerializedApproval = { ...approval, amount: approval.amount.toString(), poValue: approval.poValue.toString() };
    emit(ctx, req, "escalated", "agent", { paymentId, approvalPayload });
    return cache(ctx, req, { outcome: "pending_approval", paymentId, reason: "Principal approval required.", approvalPayload,
      chainCalled: false, rainCalled: false, events: ctx.events.read(req.purchaseRequestId) });
  }

  // 4. The current six fields are reconstructed; supplied nonce and signature are forwarded unchanged.
  let approver: Address | undefined;
  if (req.approvalSig) {
    if (!req.approvalNonce) return cache(ctx, req, makeBlocked(ctx, req, paymentId, "offchain", "BadApproval", REVERT_COPY.BadApproval));
    try { approver = recoverApprover(approval, ctx.mandateDomain, req.approvalSig); } catch { approver = undefined; }
    if (!approver || approver.toLowerCase() !== ctx.mandate.principal.toLowerCase())
      return cache(ctx, req, makeBlocked(ctx, req, paymentId, "offchain", "BadApproval", REVERT_COPY.BadApproval));
    emit(ctx, req, "approval_signed", "user", { paymentId, approver, approvalNonce: req.approvalNonce });
  }

  const args = { mandateHash: ctx.mandateHash, amountMinor: BigInt(req.amountMinor), payeeHash, payeeSet: ctx.payeeSet,
    poValueMinor: poValue, stage: req.stage, approvalSig: req.approvalSig, approvalNonce: req.approvalNonce };

  // 5. All payment authority checks remain in Solidity.
  const simulated = await ctx.registry.simulateRecord(args);
  if (!simulated.ok) {
    let txHash: Hex | null = null;
    if (req.materializeRevert && simulated.reason === "Revoked") {
      const materialized = await ctx.registry.record(args, { materializeRevert: true });
      if (!materialized.ok) txHash = materialized.txHash;
    }
    return cache(ctx, req, makeBlocked(ctx, req, paymentId, "onchain", simulated.reason, REVERT_COPY[simulated.reason], txHash));
  }

  // 6. Real transaction follows successful simulation.
  const recorded = await ctx.registry.record(args);
  if (!recorded.ok)
    return cache(ctx, req, makeBlocked(ctx, req, paymentId, "onchain", recorded.reason, REVERT_COPY[recorded.reason], recorded.txHash));
  emit(ctx, req, "chain_authorized", "system", { paymentId, txHash: recorded.txHash, remainingMinor: recorded.remainingMinor.toString() });

  // 7. First Rain call, after chain authorization.
  const rain = await ctx.rain.createPaymentInstruction({ mandateHash: ctx.mandateHash, payeeRef: req.payeeRef,
    amountMinorUnits: req.amountMinor, currency: "USD", purchaseRequestId: req.purchaseRequestId, stage: req.stage, idempotencyKey: req.idempotencyKey });

  // 8. Persist success and cache the exact response object.
  emit(ctx, req, "rain_instruction_created", "system", { paymentId, rainPaymentId: rain.paymentId, status: rain.status });
  const common = { paymentId, rainPaymentId: rain.paymentId, transactionHash: recorded.txHash,
    explorerUrl: ctx.registry.explorerTx(recorded.txHash), remainingMinor: recorded.remainingMinor.toString(), events: ctx.events.read(req.purchaseRequestId) };
  return cache(ctx, req, approver ? { outcome: "approved", ...common, approver } : { outcome: "autonomous", ...common });
}

function emit(ctx: PayContext, req: PayRequest, type: EventType, actor: EventRecord["actor"], payload: Record<string, unknown>): void {
  ctx.events.append({ purchaseRequestId: req.purchaseRequestId, type, actor, payload });
}
function cache(ctx: PayContext, req: PayRequest, response: PayResponse): PayResponse {
  ctx.attemptCache.set(req.idempotencyKey, response); return response;
}
function makeBlocked(ctx: PayContext, req: PayRequest, paymentId: string, layer: "offchain" | "onchain",
  reason: RevertReason | PolicyFailureCode, message: string, transactionHash: Hex | null = null): PayResponse {
  emit(ctx, req, layer === "onchain" ? "chain_rejected" : "precheck_failed", "system", { paymentId, reason });
  return { outcome: "blocked", paymentId, layer, reason, message, transactionHash, rainCalled: false, events: ctx.events.read(req.purchaseRequestId) };
}
function randomNonce(): Bytes32 { return `0x${crypto.randomUUID().replaceAll("-", "").padEnd(64, "0")}`; }

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
