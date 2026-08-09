/**
 * ============================================================================
 * CANONICAL DECLARATION SURFACE WITH VIEM IMPLEMENTATION BELOW.
 * ============================================================================
 *
 * Every type, constant, and signature here matches `INTERFACE-CONTRACTS.md` §5.
 * No signature in §5 may differ from what is written here. If you believe one is
 * wrong: stop and report it. Do not edit it, and do not work around it.
 *
 * D4: viem only. wagmi is NOT a dependency of this or any other module.
 */
import {
  BaseError,
  ContractFunctionRevertedError,
  parseAbi,
  parseEventLogs,
  type PublicClient,
  type WalletClient,
} from "viem";
import type { Bytes32, Hex } from "@/lib/contracts/money";
import type { ProcurementMandate } from "@/lib/mandate/types";
import { hashMandate } from "@/lib/mandate";
import type { ChainEnvironment } from "./config";

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
  /** A1 — required when stage === "deposit" and APPROVAL_ONCHAIN_VERIFY is true. */
  approvalSig?: Hex;
  /** A1 — must equal the signed PaymentApproval.nonce. The contract cannot derive it. */
  approvalNonce?: Bytes32;
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
   * the MandateCreated event). The client then asserts it equals hashMandate(m, explicitDomain)
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
 * ENABLED after the WP3 gate passed all ten named tests (`forge test` 24 passed /
 * 0 failed). R4 (b) shipped: `record` ecrecovers the
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

const ZERO_BYTES32 = `0x${"00".repeat(32)}` as Bytes32;

const REGISTRY_ABI = parseAbi([
  "error MandateExists()", "error UnknownMandate()", "error BadSignature()",
  "error NotAgent()", "error NotPrincipal()", "error Revoked()", "error NotYetValid()",
  "error Expired()", "error PayeeOutOfScope()", "error ExceedsMaxTotal()",
  "error DepositCapExceeded()", "error BadPayeeSet()", "error BadApproval()",
  "event MandateCreated(bytes32 indexed mandateHash, address indexed principal, address indexed agent)",
  "event PaymentAuthorized(bytes32 indexed mandateHash, uint256 amountMinor, bytes32 payeeHash, uint256 poValueMinor, uint8 stage, uint256 remainingMinor)",
  "function create((address principal,address agent,bytes32 purchaseRequestId,bytes32 fundingSource,uint256 maxTotal,uint256 autonomousMax,uint256 maxDepositBps,bytes32 payeeScope,string purpose,uint256 validAfter,uint256 validUntil,bytes32 nonce) m, bytes sig) returns (bytes32 mandateHash)",
  "function record(bytes32 mandateHash,uint256 amountMinor,bytes32 payeeHash,bytes32[] payeeSet,uint256 poValueMinor,uint8 stage,bytes approvalSig,bytes32 approvalNonce) returns (uint256 remainingMinor)",
  "function remaining(bytes32 mandateHash) view returns (uint256)",
]);

const KNOWN_REVERTS = new Set<RevertReason>([
  "MandateExists", "UnknownMandate", "BadSignature", "NotAgent", "NotPrincipal",
  "Revoked", "NotYetValid", "Expired", "PayeeOutOfScope", "ExceedsMaxTotal",
  "DepositCapExceeded", "BadPayeeSet", "BadApproval",
]);

function decodeRevert(error: unknown): { reason: RevertReason; raw: string } {
  const raw = error instanceof Error ? error.message : String(error);
  if (error instanceof BaseError) {
    const reverted = error.walk((candidate) => candidate instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName;
      if (name && KNOWN_REVERTS.has(name as RevertReason)) {
        return { reason: name as RevertReason, raw };
      }
    }
  }
  return { reason: "Unknown", raw };
}

function recordArguments(a: RecordArgs) {
  return [
    a.mandateHash,
    a.amountMinor,
    a.payeeHash,
    a.payeeSet,
    a.poValueMinor,
    STAGE[a.stage],
    a.approvalSig ?? "0x",
    a.approvalNonce ?? ZERO_BYTES32,
  ] as const;
}

export function createViemRegistryClient(args: {
  environment: ChainEnvironment;
  publicClient: PublicClient;
  walletClient: WalletClient;
}): RegistryClient {
  const { environment, publicClient, walletClient } = args;
  const account = walletClient.account;
  if (!account) throw new Error("Registry wallet client requires an agent account");

  return {
    async create(m, sig) {
      const simulation = await publicClient.simulateContract({
        account,
        address: environment.registryAddress,
        abi: REGISTRY_ABI,
        functionName: "create",
        args: [m, sig],
      });
      const predicted = hashMandate(m, {
        chainId: environment.chainId,
        verifyingContract: environment.registryAddress,
      });
      if (simulation.result !== predicted) {
        throw new MandateHashMismatch(
          `Contract returned ${simulation.result}; local signing domain predicted ${predicted}`,
        );
      }

      const txHash = await walletClient.writeContract(simulation.request);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const created = parseEventLogs({
        abi: REGISTRY_ABI,
        eventName: "MandateCreated",
        logs: receipt.logs,
      });
      if (created.length !== 1 || created[0].args.mandateHash !== predicted) {
        throw new MandateHashMismatch("MandateCreated event does not match the simulated mandate hash");
      }
      return { txHash, mandateHash: predicted };
    },

    async simulateRecord(a) {
      try {
        const simulation = await publicClient.simulateContract({
          account,
          address: environment.registryAddress,
          abi: REGISTRY_ABI,
          functionName: "record",
          args: recordArguments(a),
        });
        return { ok: true, remainingMinor: simulation.result };
      } catch (error) {
        return { ok: false, ...decodeRevert(error) };
      }
    },

    async record(a, options) {
      let request;
      try {
        request = (await publicClient.simulateContract({
          account,
          address: environment.registryAddress,
          abi: REGISTRY_ABI,
          functionName: "record",
          args: recordArguments(a),
        })).request;
      } catch (error) {
        const { reason } = decodeRevert(error);
        if (!options?.materializeRevert) return { ok: false, reason, txHash: null };
        try {
          const txHash = await walletClient.writeContract({
            account,
            chain: walletClient.chain,
            address: environment.registryAddress,
            abi: REGISTRY_ABI,
            functionName: "record",
            args: recordArguments(a),
          });
          await publicClient.waitForTransactionReceipt({ hash: txHash });
          return { ok: false, reason, txHash };
        } catch {
          return { ok: false, reason, txHash: null };
        }
      }

      const txHash = await walletClient.writeContract(request);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const remainingMinor = await this.remaining(a.mandateHash);
      return { ok: true, txHash, remainingMinor, blockNumber: receipt.blockNumber };
    },

    remaining(mandateHash) {
      return publicClient.readContract({
        address: environment.registryAddress,
        abi: REGISTRY_ABI,
        functionName: "remaining",
        args: [mandateHash],
      });
    },

    explorerTx(txHash) {
      return environment.chainId === 10143
        ? `https://testnet.monadvision.com/tx/${txHash}`
        : `${environment.rpcUrl}/tx/${txHash}`;
    },

    revokeCommand(mandateHash) {
      return `cast send --rpc-url '${environment.rpcUrl}' '${environment.registryAddress}' 'revoke(bytes32)' '${mandateHash}'`;
    },
  };
}
