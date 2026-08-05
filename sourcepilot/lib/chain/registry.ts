/**
 * ============================================================================
 * DECLARATION SURFACE ONLY — NO IMPLEMENTATION IN THIS FILE.
 * ============================================================================
 *
 * This file exists on Tuesday because WP2 and WP4 import `Stage`, `RevertReason`,
 * and `APPROVAL_ONCHAIN_VERIFY` from it, while WP5 — which owns the file — does not
 * run until Thursday. Manager ruling: declarations land now, WP5 fills in the viem
 * client Thursday **without altering a single declaration below**.
 *
 * This is a sequencing fix, not a contract change. Every type, constant, and
 * signature here is transcribed verbatim from `INTERFACE-CONTRACTS.md` §5 (frozen).
 * No signature in §5 may differ from what is written here. If you believe one is
 * wrong: stop and report it. Do not edit it, and do not work around it.
 *
 * WP5, Thursday: add the viem-backed `createRegistryClient()` below the
 * declarations. Do not redeclare these types locally anywhere else.
 *
 * D4: viem only. wagmi is NOT a dependency of this or any other module.
 */
import type { Address, Bytes32, Hex } from "@/lib/contracts/money";
import type { ProcurementMandate } from "@/lib/mandate/types";

export const STAGE = { sample: 0, deposit: 1, balance: 2 } as const;
export type Stage = keyof typeof STAGE;

/** 1:1 with the Solidity custom errors. WP5 decodes to this; WP6 renders one sentence per case. */
export type RevertReason =
  | "MandateExists" | "UnknownMandate" | "BadSignature" | "NotAgent" | "NotPrincipal"
  | "Revoked" | "NotYetValid" | "Expired" | "PayeeOutOfScope" | "ExceedsMaxTotal"
  | "DepositCapExceeded" | "BadPayeeSet" | "BadApproval" | "Unknown";

/**
 * One legible sentence per case. No raw revert strings on screen, ever.
 * WP6 asserts this mapping is TOTAL — a test fails if a `RevertReason` variant is
 * added without copy here (R3: "total" means total, `Unknown` and `BadApproval` included).
 */
export const REVERT_COPY: Record<RevertReason, string> = {
  MandateExists: "A mandate with these exact terms is already registered on-chain.",
  UnknownMandate: "No mandate is registered under that hash. Nothing was authorized.",
  BadSignature: "The signature does not match the mandate terms. The signed terms and the submitted terms disagree.",
  NotAgent: "Only the agent named in the signed mandate can request payment authorization.",
  NotPrincipal: "Only the principal who signed the mandate can revoke it.",
  Revoked: "Mandate revoked on-chain. No further payment can be authorized against it.",
  NotYetValid: "The mandate's validity window has not opened yet.",
  Expired: "The mandate's validity window has closed.",
  PayeeOutOfScope: "Destination is not in the signed payee scope. No payment request was constructed.",
  ExceedsMaxTotal: "Payment would exceed the signed cumulative payment ceiling.",
  DepositCapExceeded: "Deposit exceeds the signed cap as a share of supplier PO value.",
  BadPayeeSet: "The submitted payee set does not match the signed payee scope.",
  BadApproval: "The approval signature does not cover the values submitted with this payment.",
  Unknown: "The contract rejected this payment for an unrecognized reason. No payment was made.",
};

export interface RecordArgs {
  mandateHash: Bytes32; amountMinor: bigint; payeeHash: Bytes32;
  payeeSet: Bytes32[]; poValueMinor: bigint; stage: Stage;
}

export type SimulateResult =
  | { ok: true; remainingMinor: bigint }
  | { ok: false; reason: RevertReason; raw: string };

export type RecordResult =
  | { ok: true; txHash: Hex; remainingMinor: bigint; blockNumber: bigint }
  | { ok: false; reason: RevertReason; txHash: Hex | null };  // txHash non-null only when materializeRevert

/** D0. Unrecoverable. Never swallowed. */
export class MandateHashMismatch extends Error {}

export interface RegistryClient {
  /**
   * D0: `mandateHash` is READ BACK from the contract (simulate return value, confirmed against
   * the MandateCreated event). The client then asserts it equals hashMandate(m, registry)
   * and throws MandateHashMismatch on disagreement. We never send a hash and never trust ours.
   */
  create(m: ProcurementMandate, sig: Hex): Promise<{ txHash: Hex; mandateHash: Bytes32 }>;

  /** eth_call. Free, instant, yields the revert reason for the UI. ALWAYS called before record. */
  simulateRecord(a: RecordArgs): Promise<SimulateResult>;

  /** Real transaction, sent from the AGENT key. Never called if simulate failed, unless materializeRevert. */
  record(a: RecordArgs, opts?: { materializeRevert?: boolean }): Promise<RecordResult>;

  /** On user action only. NEVER in a poll loop — testnet caps eth_call at 25 rps. */
  remaining(mandateHash: Bytes32): Promise<bigint>;

  explorerTx(txHash: Hex): string;   // https://testnet.monadvision.com/tx/...

  /**
   * D4: revocation is NOT a client method. This returns the exact `cast send` line, printed by the
   * harness and pasted into a visible terminal on stage. Our server cannot revoke, and that is the point.
   */
  revokeCommand(mandateHash: Bytes32): string;
}

/**
 * R4. Drives DEMO_COPY.enforcementClaim (§8) — flipping this flag changes the sentence
 * said on stage, and WP9 asserts the two agree.
 *
 * ABORT CONDITION (R4 execution condition 4): if Wednesday's WP3 gate is not green on all
 * ten named tests, this stays false and we say the D5 sentence. (b) is an addition to a
 * working contract, never a repair of a broken one.
 *
 * FLIPPED TO TRUE — Wed 2026-08-05, WP3 gate green on all ten named tests
 * (`forge test` 24 passed / 0 failed). R4 (b) shipped: `record` ecrecovers the
 * PaymentApproval digest for `stage == 1` and requires signer == principal, else
 * BadApproval(). The tenth test — a valid approval over a DIFFERENT poValueMinor than the
 * one passed to record — is red-first and green, so (b) buys what it claims to buy.
 *
 * ⚠ CONTINGENT ON DEPLOYMENT. The stage sentence claims the CONTRACT enforces the deposit
 * cap. That is true of this bytecode, but the testnet deploy is still held pending funding.
 * If the deploy never lands, or lands different code, this MUST go back to false — the
 * sentence would otherwise overclaim about a contract nobody can inspect.
 */
export const APPROVAL_ONCHAIN_VERIFY = true;
