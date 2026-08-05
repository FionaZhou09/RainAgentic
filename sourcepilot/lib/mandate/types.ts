/**
 * Mandate and approval EIP-712 types. Transcribed from INTERFACE-CONTRACTS.md §4 (frozen).
 * Do not alter a signature or reorder a field — `MandateInput.sol` mirrors the field order
 * below exactly, and WP3's Foundry test asserts the two produce the same digest.
 */
import type { Address, Bytes32 } from "@/lib/contracts/money";

export interface MandateDomainConfig {
  chainId: 31337 | 10143;
  verifyingContract: Address;
}

export const mandateDomain = (config: MandateDomainConfig) => ({
  name: "SourcePilot",
  version: "1",
  chainId: config.chainId,
  verifyingContract: config.verifyingContract,
} as const);

/** Twelve fields. This list is the source of truth; MandateInput.sol mirrors it in this exact order. */
export const MANDATE_TYPES = {
  ProcurementMandate: [
    { name: "principal",         type: "address" },
    { name: "agent",             type: "address" },
    { name: "purchaseRequestId", type: "bytes32" },
    { name: "fundingSource",     type: "bytes32" },
    { name: "maxTotal",          type: "uint256" },  // cents. TOTAL PAYABLE TO SUPPLIERS.
    { name: "autonomousMax",     type: "uint256" },  // cents, per transaction
    { name: "maxDepositBps",     type: "uint256" },  // OF SUPPLIER PO VALUE
    { name: "payeeScope",        type: "bytes32" },
    { name: "purpose",           type: "string"  },
    { name: "validAfter",        type: "uint256" },
    { name: "validUntil",        type: "uint256" },
    { name: "nonce",             type: "bytes32" },
  ],
} as const;

export interface ProcurementMandate {
  principal: Address; agent: Address;
  purchaseRequestId: Bytes32; fundingSource: Bytes32;
  maxTotal: bigint; autonomousMax: bigint; maxDepositBps: bigint;
  payeeScope: Bytes32; purpose: string;
  validAfter: bigint; validUntil: bigint; nonce: Bytes32;
}

// ---- approval: escalation is itself signed (D5) -----------------------------
export const APPROVAL_TYPES = {
  PaymentApproval: [
    { name: "mandateHash", type: "bytes32" },
    { name: "payeeHash",   type: "bytes32" },
    { name: "amount",      type: "uint256" },  // cents
    { name: "poValue",     type: "uint256" },  // D5: binds the deposit denominator
    { name: "stage",       type: "uint8"   },
    { name: "nonce",       type: "bytes32" },
  ],
} as const;

export interface PaymentApproval {
  mandateHash: Bytes32; payeeHash: Bytes32;
  amount: bigint; poValue: bigint; stage: number; nonce: Bytes32;
}

export type SerializedApproval = {
  mandateHash: Bytes32;
  payeeHash: Bytes32;
  amount: string;
  poValue: string;
  stage: number;
  nonce: Bytes32;
};

/** JSON-safe mandate: bigints as decimal strings (§7's convention). */
export type SerializedMandate = {
  [K in keyof ProcurementMandate]: ProcurementMandate[K] extends bigint
    ? string
    : ProcurementMandate[K];
};

/**
 * The cross-language pin. WP2 writes it Tuesday; WP3's Foundry test asserts against it,
 * so a digest mismatch fails red in a Solidity test rather than inside /api/pay.
 *
 * All uint256 values are DECIMAL STRINGS. Foundry reads them with
 * `vm.parseJsonString(...)` followed by `vm.parseUint(...)`, not `vm.parseJsonUint`.
 */
export interface DigestVector {
  registry: Address; mandate: SerializedMandate;
  expectedDigest: Bytes32; signature: `0x${string}`; expectedSigner: Address;
  payeeRefs: string[]; expectedPayeeScope: Bytes32; expectedLeaves: Bytes32[];
  /** D0: differs from `mandate` in ONE field, with `signature` unchanged.
   *  WP3 must prove create() reverts BadSignature on it. The Farhan question, as a test. */
  tamperedMandate: SerializedMandate;
  /** Which field was altered, so the Foundry test can assert the difference is singular. */
  tamperedField: keyof ProcurementMandate;
}
