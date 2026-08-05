import { describe, expect, it } from "vitest";
import { REVERT_COPY, type RevertReason } from "@/lib/chain/registry";
import type { Bytes32, Hex } from "@/lib/contracts/money";
import type { PayRequest, PayResponse } from "@/lib/contracts/api";
import { newAttemptKey, type AttemptKey } from "@/lib/rain/port";
import {
  buildApprovalFollowUp,
  buildApprovalModel,
  type ApprovalMandateSummary,
} from "@/components/approval-model";
import { environmentLabel } from "@/components/environment-label";
import { DEMO_COPY } from "@/lib/contracts/copy";

const hash = (character: string) => `0x${character.repeat(64)}` as Bytes32;
const signature = `0x${"12".repeat(65)}` as Hex;
const pendingKey = "11111111-1111-4111-8111-111111111111" as AttemptKey;
const nextKey = "22222222-2222-4222-8222-222222222222" as AttemptKey;
const summary: ApprovalMandateSummary = {
  maxTotalMinor: "184000",
  autonomousMaxMinor: "20000",
  maxDepositBps: 3000,
  expiryLabel: DEMO_COPY.mandateExpiryLabel,
  payeeScope: hash("a"),
  payeePreimage: "rain:payee:hanzhou-apparel",
};
const pending: Extract<PayResponse, { outcome: "pending_approval" }> = {
  outcome: "pending_approval",
  paymentId: "pay_pending",
  reason: "Principal approval required.",
  approvalPayload: {
    mandateHash: hash("1"), payeeHash: hash("2"), amount: "123300", poValue: "411000", stage: 1, nonce: hash("3"),
  },
  chainCalled: false,
  rainCalled: false,
  events: [],
};

describe("approval UI logic", () => {
  it("keeps the RevertReason copy map total", () => {
    const reasons = [
      "MandateExists", "UnknownMandate", "BadSignature", "NotAgent", "NotPrincipal", "Revoked",
      "NotYetValid", "Expired", "PayeeOutOfScope", "ExceedsMaxTotal", "DepositCapExceeded",
      "BadPayeeSet", "BadApproval", "Unknown",
    ] satisfies RevertReason[];
    expect(Object.keys(REVERT_COPY).sort()).toEqual([...reasons].sort());
  });

  it("renders all six signed approval fields and no chain or Rain activity", () => {
    const model = buildApprovalModel(pending, summary, "Local Anvil");
    expect(model.signedFields?.map(({ value }) => value)).toEqual(Object.values(pending.approvalPayload).map(String));
    expect(model.zeroEffects).toEqual(["No chain transaction was submitted.", "Rain was not called."]);
  });

  it("creates a new AttemptKey and preserves the returned approval nonce", () => {
    const request: PayRequest = {
      purchaseRequestId: "PR-1042", supplierId: "SUP-B", payeeRef: "rain:payee:hanzhou-apparel",
      amountMinor: 123300, stage: "deposit", idempotencyKey: pendingKey,
    };
    const followUp = buildApprovalFollowUp(request, pending, signature, () => nextKey);
    expect(followUp.idempotencyKey).toBe(nextKey);
    expect(followUp.idempotencyKey).not.toBe(pendingKey);
    expect(followUp.approvalNonce).toBe(pending.approvalPayload.nonce);
    expect(followUp.approvalSig).toBe(signature);
  });

  it("refuses a reused pending AttemptKey", () => {
    const request = { purchaseRequestId: "PR-1042", supplierId: "SUP-B", payeeRef: "rain:payee:hanzhou-apparel", amountMinor: 123300, stage: "deposit", idempotencyKey: pendingKey } as const;
    expect(() => buildApprovalFollowUp(request, pending, signature, () => pendingKey)).toThrow(/new AttemptKey/);
  });

  it("uses only the public AttemptKey factory boundary", () => {
    expect(newAttemptKey.length).toBe(0);
    expect(buildApprovalFollowUp.toString()).not.toMatch(/privateKey|signTypedData|signMessage/);
  });

  it("shows approved and autonomous transaction evidence without a numeric score", () => {
    for (const outcome of ["approved", "autonomous"] as const) {
      const response = {
        outcome, paymentId: `pay_${outcome}`, rainPaymentId: `rain_${outcome}`,
        transactionHash: hash("4"), explorerUrl: "http://localhost:8545/tx/0x44", remainingMinor: "18100", events: [],
        ...(outcome === "approved" ? { approver: `0x${"5".repeat(40)}` as const } : {}),
      } as Extract<PayResponse, { outcome: typeof outcome }>;
      const model = buildApprovalModel(response, summary, "Local Anvil");
      expect(model.chainEvidence?.txHash).toBe(response.transactionHash);
      expect(model.chainEvidence?.label).toBe("localTxHash");
      expect(model.rainPaymentId).toBe(response.rainPaymentId);
      expect(model.chainEvidence?.remainingMinor).toBe("18100");
      expect(model.displayNumericScore).toBe(false);
    }
  });

  it("labels canonical transaction evidence as Monad-only on Monad Testnet", () => {
    const response = {
      outcome: "autonomous", paymentId: "pay", rainPaymentId: "rain", transactionHash: hash("9"),
      explorerUrl: "https://testnet.monadvision.com/tx/0x99", remainingMinor: "100", events: [],
    } as Extract<PayResponse, { outcome: "autonomous" }>;
    const model = buildApprovalModel(response, summary, "Monad Testnet");
    expect(model.chainEvidence).toMatchObject({ label: "monadTxHash", txHash: response.transactionHash });
  });

  it.each(["Environment not configured", "Unsupported chain (1)"] as const)(
    "uses the neutral transactionHash label for %s",
    (environment) => {
      const response = {
        outcome: "autonomous", paymentId: "pay", rainPaymentId: "rain", transactionHash: hash("8"),
        explorerUrl: "", remainingMinor: "100", events: [],
      } as Extract<PayResponse, { outcome: "autonomous" }>;
      expect(buildApprovalModel(response, summary, environment).chainEvidence?.label).toBe("transactionHash");
    },
  );

  it("distinguishes neutral off-chain advice from on-chain rejection with zero Rain", () => {
    const blocked: Extract<PayResponse, { outcome: "blocked" }> = {
      outcome: "blocked", paymentId: "pay_blocked", layer: "onchain", reason: "PayeeOutOfScope",
      message: REVERT_COPY.PayeeOutOfScope, transactionHash: null, rainCalled: false, events: [],
    };
    const model = buildApprovalModel(blocked, summary, "Local Anvil");
    expect(model.message).toBe(REVERT_COPY.PayeeOutOfScope);
    expect(model.layerLabel).toBe("On-chain contract rejection");
    expect(model.zeroEffects).toEqual(["Rain was not called."]);
    expect(model.advisory).toContain("informational");
  });

  it("labels supported, missing, and unsupported chain configuration truthfully", () => {
    expect(environmentLabel("31337")).toBe("Local Anvil");
    expect(environmentLabel("10143")).toBe("Monad Testnet");
    expect(environmentLabel(undefined)).toBe("Environment not configured");
    expect(environmentLabel("1")).toBe("Unsupported chain (1)");
  });

  it("exposes a keyboard-operable approval boundary", () => {
    const model = buildApprovalModel(pending, summary, "Local Anvil");
    expect(model.approvalControl).toEqual({ inputId: "approval-signature", submitType: "submit", statusLive: "polite" });
  });
});
