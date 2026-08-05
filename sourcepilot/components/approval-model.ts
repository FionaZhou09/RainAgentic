import { REVERT_COPY } from "@/lib/chain/registry";
import { DEMO_COPY } from "@/lib/contracts/copy";
import type { PayRequest, PayResponse } from "@/lib/contracts/api";
import type { Bytes32, Hex } from "@/lib/contracts/money";
import type { SerializedApproval } from "@/lib/mandate/types";
import type { AttemptKey } from "@/lib/rain/port";
import type { EnvironmentLabel } from "@/components/environment-label";

export interface ApprovalMandateSummary {
  maxTotalMinor: string;
  autonomousMaxMinor: string;
  maxDepositBps: number;
  expiryLabel: typeof DEMO_COPY.mandateExpiryLabel;
  payeeScope: Bytes32;
  payeePreimage: string;
}

export interface ApprovalModel {
  environment: EnvironmentLabel;
  mandate: ApprovalMandateSummary;
  response: PayResponse;
  stateTone: "positive" | "blocked" | "neutral";
  layerLabel: string;
  message: string;
  approvalPayload?: SerializedApproval;
  signedFields?: ReadonlyArray<{ label: string; value: string }>;
  chainEvidence?: { txHash: Hex; explorerUrl: string; remainingMinor: string };
  rainPaymentId?: string;
  advisory: typeof DEMO_COPY.landedReferenceLabel;
  displayNumericScore: false;
  zeroEffects: string[];
  approvalControl?: { inputId: "approval-signature"; submitType: "submit"; statusLive: "polite" };
}

export function buildApprovalModel(
  response: PayResponse,
  mandate: ApprovalMandateSummary,
  environment: EnvironmentLabel,
): ApprovalModel {
  if (response.outcome === "pending_approval") {
    return { environment, mandate, response, stateTone: "neutral", layerLabel: "Pending founder approval",
      message: response.reason, approvalPayload: response.approvalPayload,
      signedFields: Object.entries(response.approvalPayload).map(([label, value]) => ({ label, value: String(value) })),
      advisory: DEMO_COPY.landedReferenceLabel, displayNumericScore: false,
      zeroEffects: ["No chain transaction was submitted.", "Rain was not called."],
      approvalControl: { inputId: "approval-signature", submitType: "submit", statusLive: "polite" } };
  }
  if (response.outcome === "blocked") {
    const message = response.layer === "onchain" && response.reason in REVERT_COPY
      ? REVERT_COPY[response.reason as keyof typeof REVERT_COPY]
      : response.message;
    return { environment, mandate, response, stateTone: "blocked",
      layerLabel: response.layer === "onchain" ? "On-chain contract rejection" : "Off-chain sourcing failure",
      message, advisory: DEMO_COPY.landedReferenceLabel, displayNumericScore: false,
      zeroEffects: ["Rain was not called."] };
  }
  return { environment, mandate, response, stateTone: "positive",
    layerLabel: response.outcome === "approved" ? "Founder-approved payment" : "Autonomous payment",
    message: response.outcome === "approved" ? "Approval verified and payment authorized." : "Payment authorized within the autonomous threshold.",
    chainEvidence: { txHash: response.monadTxHash, explorerUrl: response.explorerUrl, remainingMinor: response.remainingMinor },
    rainPaymentId: response.rainPaymentId, advisory: DEMO_COPY.landedReferenceLabel, displayNumericScore: false, zeroEffects: [] };
}

export function buildApprovalFollowUp(
  pendingRequest: PayRequest,
  pendingResponse: Extract<PayResponse, { outcome: "pending_approval" }>,
  approvalSig: Hex,
  mintAttemptKey: () => AttemptKey,
): PayRequest {
  const idempotencyKey = mintAttemptKey();
  if (idempotencyKey === pendingRequest.idempotencyKey) {
    throw new Error("Approval follow-up requires a new AttemptKey");
  }
  return {
    ...pendingRequest,
    idempotencyKey,
    approvalSig,
    approvalNonce: pendingResponse.approvalPayload.nonce,
  };
}

export function formatMinor(minor: string): string {
  const value = BigInt(minor);
  return `$${(value / 100n).toLocaleString("en-US")}.${(value % 100n).toString().padStart(2, "0")}`;
}
