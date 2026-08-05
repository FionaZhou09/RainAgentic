/**
 * EIP-712 mandate hashing, signing, and recovery. INTERFACE-CONTRACTS.md §4 (frozen).
 *
 * D4: viem only for chain work — wagmi is not a dependency of this or any other module.
 *
 * On the @noble/* imports: §4 freezes `recoverMandateSigner` and `recoverApprover` as
 * SYNCHRONOUS, while viem's recovery helpers are all async. Signature recovery is pure
 * secp256k1 arithmetic with no I/O, so we do it synchronously against @noble/curves —
 * the same library viem itself uses — rather than change a frozen signature. Both noble
 * packages are declared dependencies of this workspace, never relied on transitively.
 */
import { hashTypedData, hexToBytes, bytesToHex, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import type { Address, Bytes32, Hex } from "@/lib/contracts/money";
import {
  MANDATE_DOMAIN,
  MANDATE_TYPES,
  APPROVAL_TYPES,
  type ProcurementMandate,
  type PaymentApproval,
} from "./types";

export * from "./types";
export * from "./payee";

/**
 * ⚠ D0 — LOCAL PREDICTION ONLY.
 *
 * This value is NEVER transmitted to the contract as an input. `MandateRegistry.create`
 * takes NO mandateHash parameter; it recomputes the digest on-chain from all twelve
 * signed fields and RETURNS it. This function exists so the client can assert equality
 * against the hash the contract returned, and throw `MandateHashMismatch` if they differ.
 *
 * If you are about to pass the result of this function into a contract call: stop.
 * Accepting a caller-supplied digest is the exact defect ruling D0 was raised to kill.
 */
export function hashMandate(m: ProcurementMandate, registry: Address): Bytes32 {
  return hashTypedData({
    domain: MANDATE_DOMAIN(registry),
    types: MANDATE_TYPES,
    primaryType: "ProcurementMandate",
    message: m,
  });
}

/**
 * Signs the mandate with `pk`. Harness and test use only — on stage the founder signs
 * in a real browser wallet, screen-recorded (D4).
 */
export async function signMandate(
  m: ProcurementMandate,
  registry: Address,
  pk: Hex,
): Promise<Hex> {
  return privateKeyToAccount(pk).signTypedData({
    domain: MANDATE_DOMAIN(registry),
    types: MANDATE_TYPES,
    primaryType: "ProcurementMandate",
    message: m,
  });
}

/**
 * Recovers the signer of `sig` over `m`.
 *
 * Recovery runs against the mandate PASSED IN, not the one that was signed — so pairing a
 * genuine signature with an altered mandate recovers some other address, never the
 * principal. That is precisely what WP3 enforces on-chain as `BadSignature`.
 */
export function recoverMandateSigner(
  m: ProcurementMandate,
  registry: Address,
  sig: Hex,
): Address {
  return recoverSigner(hashMandate(m, registry), sig);
}

export function hashApproval(a: PaymentApproval, registry: Address): Bytes32 {
  return hashTypedData({
    domain: MANDATE_DOMAIN(registry),
    types: APPROVAL_TYPES,
    primaryType: "PaymentApproval",
    message: a,
  });
}

export function recoverApprover(
  a: PaymentApproval,
  registry: Address,
  sig: Hex,
): Address {
  return recoverSigner(hashApproval(a, registry), sig);
}

/** Synchronous ecrecover over an already-computed EIP-712 digest. */
function recoverSigner(digest: Bytes32, sig: Hex): Address {
  const bytes = hexToBytes(sig);
  if (bytes.length !== 65) {
    throw new Error(`recoverSigner: expected a 65-byte signature, got ${bytes.length}`);
  }

  // Accept both the {0,1} and EIP-155-era {27,28} encodings of v.
  let recoveryBit = bytes[64];
  if (recoveryBit === 27 || recoveryBit === 28) recoveryBit -= 27;
  if (recoveryBit !== 0 && recoveryBit !== 1) {
    throw new Error(`recoverSigner: invalid recovery byte ${bytes[64]}`);
  }

  const publicKey = secp256k1.Signature.fromBytes(bytes.slice(0, 64))
    .addRecoveryBit(recoveryBit)
    .recoverPublicKey(hexToBytes(digest))
    .toBytes(false)   // uncompressed, 65 bytes
    .slice(1);        // drop the 0x04 prefix

  // Address is the last 20 bytes of keccak256(pubkey); getAddress restores EIP-55 casing.
  return getAddress(`0x${bytesToHex(keccak_256(publicKey)).slice(-40)}`);
}
