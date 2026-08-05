import { ApprovalClient } from "@/components/approval-client";
import { environmentLabel } from "@/components/environment-label";
import type { PayResponse } from "@/lib/contracts/api";
import type { Bytes32 } from "@/lib/contracts/money";
import { DEMO_COPY } from "@/lib/contracts/copy";
import { newAttemptKey } from "@/lib/rain/port";

const bytes32 = (character: string) => `0x${character.repeat(64)}` as Bytes32;

const pending: Extract<PayResponse, { outcome: "pending_approval" }> = {
  outcome: "pending_approval",
  paymentId: "pay_pr1042_deposit",
  reason: "Principal approval required.",
  approvalPayload: {
    mandateHash: bytes32("1"), payeeHash: bytes32("2"), amount: "147900",
    poValue: "493000", stage: 1, nonce: bytes32("3"),
  },
  chainCalled: false,
  rainCalled: false,
  events: [],
};

export default function ApprovePage() {
  const mandate = {
    maxTotalMinor: "184000",
    autonomousMaxMinor: "20000",
    maxDepositBps: 3000,
    expiryLabel: DEMO_COPY.mandateExpiryLabel,
    payeeScope: bytes32("a"),
    payeePreimage: "rain:payee:hanzhou-apparel\nrain:payee:rongcheng-garment\nrain:payee:yuanfeng-textiles",
  } as const;
  return <ApprovalClient initialResponse={pending} pendingRequest={{
    purchaseRequestId: "PR-1042",
    supplierId: "SUP-B",
    payeeRef: "rain:payee:hanzhou-apparel",
    amountMinor: 147900,
    stage: "deposit",
    idempotencyKey: newAttemptKey(),
  }} mandate={mandate} environment={environmentLabel(process.env.CHAIN_ID)} />;
}
