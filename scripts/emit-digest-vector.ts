#!/usr/bin/env tsx
/**
 * Emits lib/mandate/__fixtures__/digest-vector.json — the cross-language pin.
 *
 * WP2 writes it Tuesday; WP3's Foundry test asserts against it Wednesday, so a digest
 * mismatch between viem and Solidity fails red in a contract test rather than inside
 * /api/pay on Thursday.
 *
 * EVERY INPUT HERE IS FIXED. No Date.now(), no randomness, no environment. Re-running
 * this on a clean checkout must reproduce the file byte-for-byte, or the fixture is
 * not a pin. The signing key is the well-known anvil key #0 — public, universally
 * recognized as a test key, and deliberately NOT the demo principal's key, so nothing
 * gitignored is needed to regenerate this file.
 *
 * Run: pnpm emit:digest-vector
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Address } from "../sourcepilot/lib/contracts/money";
import type { DigestVector, ProcurementMandate } from "../sourcepilot/lib/mandate/types";
import { hashMandate, signMandate, recoverMandateSigner } from "../sourcepilot/lib/mandate/index";
import { computePayeeScope } from "../sourcepilot/lib/mandate/payee";
import { serializeMandate } from "../sourcepilot/lib/mandate/serialize";

/** anvil key #0 — public test key. Never funds, never mainnet, never the demo principal. */
const PK_PRINCIPAL = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
/** anvil address #1 — the agent our server signs as. */
const AGENT = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Address;
/** Deterministic stand-in for the deployed registry; WP3 re-signs against the real one if needed. */
const REGISTRY = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as Address;
const MONAD_DOMAIN = { chainId: 10143, verifyingContract: REGISTRY } as const;

const PAYEE_REFS = [
  "rain:payee:hanzhou-apparel",
  "rain:payee:yuanfeng-textiles",
  "rain:payee:rongcheng-garment",
];

/** Fixed absolute timestamps. 2025-12-01T00:00:00Z and +90 days — never derived from the clock. */
const VALID_AFTER = 1_764_547_200n;
const VALID_UNTIL = 1_772_323_200n;

async function main() {
  const principal = privateKeyToAccount(PK_PRINCIPAL).address;
  const { scope, leaves } = computePayeeScope(PAYEE_REFS);

  const mandate: ProcurementMandate = {
    principal,
    agent: AGENT,
    purchaseRequestId: keccak256(toHex("PR-1042")),
    fundingSource: keccak256(toHex("rain:funding:operating-usd")),
    maxTotal: 184_000n,        // D3: $1,840.00
    autonomousMax: 20_000n,    // $200.00 — the $180 sample sits under it
    maxDepositBps: 3_000n,     // B sits exactly at the cap
    payeeScope: scope,
    purpose: "Sourcing PR-1042: 600 heavyweight cotton T-shirts, 240gsm",
    validAfter: VALID_AFTER,
    validUntil: VALID_UNTIL,
    nonce: keccak256(toHex("nonce:pr-1042:session-1")),
  };

  const expectedDigest = hashMandate(mandate, MONAD_DOMAIN);
  const signature = await signMandate(mandate, MONAD_DOMAIN, PK_PRINCIPAL);
  const expectedSigner = recoverMandateSigner(mandate, MONAD_DOMAIN, signature);

  if (expectedSigner !== principal) {
    throw new Error(`emit-digest-vector: sign/recover round-trip failed (${expectedSigner} !== ${principal})`);
  }

  /**
   * D0's attack, frozen as a fixture: the ceiling the founder signed was $1,840.
   * This one says $18,400, and carries her genuine signature. A contract that accepts a
   * caller-supplied digest would authorize it. Ours recomputes and reverts BadSignature.
   */
  const tamperedField = "maxTotal" as const;
  const tamperedMandate: ProcurementMandate = { ...mandate, maxTotal: 1_840_000n };

  if (recoverMandateSigner(tamperedMandate, MONAD_DOMAIN, signature) === principal) {
    throw new Error("emit-digest-vector: tampered mandate still recovers the principal — vector is worthless");
  }

  const vector: DigestVector = {
    registry: REGISTRY,
    mandate: serializeMandate(mandate),
    expectedDigest,
    signature,
    expectedSigner,
    payeeRefs: PAYEE_REFS,
    expectedPayeeScope: scope,
    expectedLeaves: leaves,
    tamperedMandate: serializeMandate(tamperedMandate),
    tamperedField,
  };

  const out = resolve(
    import.meta.dirname,
    "../sourcepilot/lib/mandate/__fixtures__/digest-vector.json",
  );
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(vector, null, 2)}\n`, "utf8");

  console.log(`wrote ${out}`);
  console.log(`  expectedDigest  ${expectedDigest}`);
  console.log(`  expectedSigner  ${expectedSigner}`);
  console.log(`  payeeScope      ${scope}`);
  console.log(`  tamperedField   ${tamperedField} (${mandate.maxTotal} -> ${tamperedMandate.maxTotal})`);
}

main().catch((err) => {
  console.error("emit-digest-vector failed:", err);
  process.exit(1);
});
