/**
 * Payee scope — the published-preimage scheme from INTERFACE-CONTRACTS.md §4 (frozen).
 *
 * The scope is a commitment to a set of payee references. The preimage is PUBLISHED
 * alongside the mandate, so any third party can reopen the commitment themselves.
 * A commitment only we can open is not auditable, which is the whole point.
 *
 * ONE implementation of normalization, UI and chain alike. If the UI normalized
 * differently from the hasher, a payee could be in scope on screen and out of scope
 * on chain — or worse, the reverse.
 */
import { keccak256, toHex, concatHex } from "viem";
import type { Bytes32 } from "@/lib/contracts/money";

/**
 * trim → NFKC → lowercase → collapse internal whitespace. In that order.
 *
 * NFKC before lowercase so compatibility forms (fullwidth, ligatures) fold to their
 * ASCII equivalents first; collapsing whitespace last so any whitespace introduced by
 * normalization is also collapsed. Idempotent by construction.
 */
export function normalizePayeeRef(raw: string): string {
  return raw
    .trim()
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** keccak256(utf8(normalizePayeeRef(raw))) */
export function hashPayeeRef(raw: string): Bytes32 {
  return keccak256(toHex(normalizePayeeRef(raw)));
}

export interface PayeeScope {
  scope: Bytes32;     // keccak256(concat(leaves)) — leaves STRICTLY ASCENDING
  leaves: Bytes32[];  // passed to record() as payeeSet
  preimage: string;   // newline-joined normalized refs. PUBLISHED alongside the mandate.
}

/**
 * Leaves are sorted strictly ascending as 256-bit big-endian integers — the same order
 * the contract checks, so a payeeSet built from `leaves` can never trip BadPayeeSet.
 *
 * `preimage` lists the normalized refs in ASCENDING-LEAF order (not input order), so a
 * verifier can walk preimage and leaves in lockstep without re-sorting.
 *
 * @throws on an empty set, or on duplicate refs after normalization — "strictly
 *         ascending" excludes equals, and a duplicate is always a caller bug.
 */
export function computePayeeScope(rawRefs: string[]): PayeeScope {
  if (rawRefs.length === 0) {
    throw new Error("computePayeeScope: refuse to build a scope from an empty ref set");
  }

  const normalized = rawRefs.map(normalizePayeeRef);
  const pairs = normalized.map((ref) => ({ ref, leaf: hashPayeeRef(ref) }));
  pairs.sort((a, b) => (BigInt(a.leaf) < BigInt(b.leaf) ? -1 : BigInt(a.leaf) > BigInt(b.leaf) ? 1 : 0));

  for (let i = 1; i < pairs.length; i++) {
    if (pairs[i].leaf === pairs[i - 1].leaf) {
      throw new Error(`computePayeeScope: duplicate payee ref after normalization: ${pairs[i].ref}`);
    }
  }

  const leaves = pairs.map((p) => p.leaf);
  return {
    scope: keccak256(concatHex(leaves)),
    leaves,
    preimage: pairs.map((p) => p.ref).join("\n"),
  };
}

/**
 * What a third party runs: re-derive the scope from the published preimage alone.
 * Rejects a preimage whose lines are not in strictly ascending leaf order, so a
 * reordered-but-same-set preimage cannot masquerade as the committed one.
 */
export function verifyPayeeScope(preimage: string, scope: Bytes32): boolean {
  const lines = preimage.split("\n");
  if (lines.length === 0 || lines.some((l) => l.length === 0)) return false;

  const leaves = lines.map(hashPayeeRef);
  for (let i = 1; i < leaves.length; i++) {
    if (!(BigInt(leaves[i]) > BigInt(leaves[i - 1]))) return false;
  }

  return keccak256(concatHex(leaves)) === scope;
}
