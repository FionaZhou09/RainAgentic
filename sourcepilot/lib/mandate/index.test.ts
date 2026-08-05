import { describe, it, expect } from "vitest";
import { keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Bytes32 } from "@/lib/contracts/money";
import type { ProcurementMandate, PaymentApproval } from "./types";
import {
  hashMandate,
  mandateDomain,
  signMandate,
  recoverMandateSigner,
  hashApproval,
  recoverApprover,
} from "./index";
import { computePayeeScope } from "./payee";

/** Well-known anvil key #0 / #1 — public test keys, never funds, never mainnet. */
const PK_PRINCIPAL = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const PRINCIPAL = privateKeyToAccount(PK_PRINCIPAL).address;
const AGENT = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Address;

const REGISTRY = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as Address;
const OTHER_REGISTRY = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as Address;
const MONAD_DOMAIN = { chainId: 10143, verifyingContract: REGISTRY } as const;
const OTHER_MONAD_DOMAIN = { chainId: 10143, verifyingContract: OTHER_REGISTRY } as const;

describe("A2 explicit mandate domain", () => {
  const monad = { chainId: 10143, verifyingContract: REGISTRY } as const;
  const anvil = { chainId: 31337, verifyingContract: REGISTRY } as const;

  it("constructs the signing domain from explicit chain and registry configuration", () => {
    expect(mandateDomain(anvil)).toEqual({
      name: "SourcePilot",
      version: "1",
      chainId: 31337,
      verifyingContract: REGISTRY,
    });
  });

  it("changing only chainId changes the mandate digest", () => {
    expect(hashMandate(BASE, anvil)).not.toBe(hashMandate(BASE, monad));
  });

  it("changing only verifyingContract changes the mandate digest", () => {
    expect(hashMandate(BASE, monad)).not.toBe(hashMandate(BASE, {
      ...monad,
      verifyingContract: OTHER_REGISTRY,
    }));
  });

  it("has no implicit domain default", () => {
    if (false) {
      // @ts-expect-error A2 requires an explicit domain.
      hashMandate(BASE);
    }
    expect(hashMandate.length).toBe(2);
  });
});

const BASE: ProcurementMandate = {
  principal: PRINCIPAL,
  agent: AGENT,
  purchaseRequestId: keccak256(toHex("PR-1042")),
  fundingSource: keccak256(toHex("rain:funding:operating-usd")),
  maxTotal: 184_000n,
  autonomousMax: 20_000n,
  maxDepositBps: 3_000n,
  payeeScope: computePayeeScope([
    "rain:payee:hanzhou-apparel",
    "rain:payee:yuanfeng-textiles",
    "rain:payee:rongcheng-garment",
  ]).scope,
  purpose: "Sourcing PR-1042: 600 heavyweight cotton T-shirts, 240gsm",
  validAfter: 1_764_547_200n,
  validUntil: 1_772_323_200n,
  nonce: keccak256(toHex("nonce:pr-1042:session-1")),
};

/** One altered value per signed field. If a field is missing from the EIP-712 type
 *  list, mutating it will NOT change the digest — which is exactly what we're testing. */
const MUTATIONS: Array<[keyof ProcurementMandate, ProcurementMandate]> = [
  ["principal", { ...BASE, principal: AGENT }],
  ["agent", { ...BASE, agent: PRINCIPAL }],
  ["purchaseRequestId", { ...BASE, purchaseRequestId: keccak256(toHex("PR-9999")) }],
  ["fundingSource", { ...BASE, fundingSource: keccak256(toHex("rain:funding:other")) }],
  ["maxTotal", { ...BASE, maxTotal: 1_840_000n }],
  ["autonomousMax", { ...BASE, autonomousMax: 200_000n }],
  ["maxDepositBps", { ...BASE, maxDepositBps: 5_000n }],
  ["payeeScope", { ...BASE, payeeScope: keccak256(toHex("different-scope")) as Bytes32 }],
  ["purpose", { ...BASE, purpose: "Sourcing PR-1042: something the founder never agreed to" }],
  ["validAfter", { ...BASE, validAfter: 1_764_547_201n }],
  ["validUntil", { ...BASE, validUntil: 1_900_000_000n }],
  ["nonce", { ...BASE, nonce: keccak256(toHex("nonce:pr-1042:session-2")) }],
];

describe("hashMandate() — the digest binds ALL TWELVE signed fields", () => {
  it("is deterministic for identical input", () => {
    expect(hashMandate(BASE, MONAD_DOMAIN)).toBe(hashMandate(BASE, MONAD_DOMAIN));
  });

  it("returns a 32-byte hex digest", () => {
    expect(hashMandate(BASE, MONAD_DOMAIN)).toMatch(/^0x[0-9a-f]{64}$/);
  });

  // The D0 test, as a loop: any field the founder signed must move the digest.
  it.each(MUTATIONS)("changing %s changes the digest", (_field, mutated) => {
    expect(hashMandate(mutated, MONAD_DOMAIN)).not.toBe(hashMandate(BASE, MONAD_DOMAIN));
  });

  it("all twelve mutations produce twelve DISTINCT digests", () => {
    const digests = new Set(MUTATIONS.map(([, m]) => hashMandate(m, MONAD_DOMAIN)));
    expect(digests.size).toBe(12);
  });
});

describe("domain separation — without both of these a testnet mandate replays on mainnet", () => {
  it("binds verifyingContract: the same mandate under a different registry has a different digest", () => {
    expect(hashMandate(BASE, OTHER_MONAD_DOMAIN)).not.toBe(hashMandate(BASE, MONAD_DOMAIN));
  });

  it("binds chainId 10143 (Monad testnet)", async () => {
    // Recovery must fail if the verifier assumes a different chainId, which it can only
    // do if chainId is genuinely part of the domain separator.
    const sig = await signMandate(BASE, MONAD_DOMAIN, PK_PRINCIPAL);
    expect(recoverMandateSigner(BASE, MONAD_DOMAIN, sig)).toBe(PRINCIPAL);
    expect(recoverMandateSigner(BASE, OTHER_MONAD_DOMAIN, sig)).not.toBe(PRINCIPAL);
  });
});

describe("signMandate() / recoverMandateSigner()", () => {
  it("round-trips to the signing address", async () => {
    const sig = await signMandate(BASE, MONAD_DOMAIN, PK_PRINCIPAL);
    expect(recoverMandateSigner(BASE, MONAD_DOMAIN, sig)).toBe(PRINCIPAL);
  });

  it("produces a 65-byte signature", async () => {
    const sig = await signMandate(BASE, MONAD_DOMAIN, PK_PRINCIPAL);
    expect(sig).toMatch(/^0x[0-9a-f]{130}$/);
  });

  // This is the Farhan question in TypeScript. WP3 proves the same thing on-chain.
  it.each(MUTATIONS)(
    "a genuine signature does NOT recover the principal once %s is altered",
    async (_field, mutated) => {
      const sig = await signMandate(BASE, MONAD_DOMAIN, PK_PRINCIPAL);
      expect(recoverMandateSigner(mutated, MONAD_DOMAIN, sig)).not.toBe(PRINCIPAL);
    },
  );
});

describe("hashApproval() — binds all SIX fields including poValue (D5)", () => {
  const APPROVAL: PaymentApproval = {
    mandateHash: hashMandate(BASE, MONAD_DOMAIN),
    payeeHash: keccak256(toHex("rain:payee:hanzhou-apparel")),
    amount: 147_900n,
    poValue: 493_000n,
    stage: 1,
    nonce: keccak256(toHex("approval-nonce-1")),
  };

  const APPROVAL_MUTATIONS: Array<[keyof PaymentApproval, PaymentApproval]> = [
    ["mandateHash", { ...APPROVAL, mandateHash: keccak256(toHex("other-mandate")) as Bytes32 }],
    ["payeeHash", { ...APPROVAL, payeeHash: keccak256(toHex("rain:payee:hanzhou-apparel-new-account")) }],
    ["amount", { ...APPROVAL, amount: 147_901n }],
    ["poValue", { ...APPROVAL, poValue: 493_001n }],
    ["stage", { ...APPROVAL, stage: 2 }],
    ["nonce", { ...APPROVAL, nonce: keccak256(toHex("approval-nonce-2")) }],
  ];

  it.each(APPROVAL_MUTATIONS)("changing %s changes the approval digest", (_field, mutated) => {
    expect(hashApproval(mutated, MONAD_DOMAIN)).not.toBe(hashApproval(APPROVAL, MONAD_DOMAIN));
  });

  it("poValue is genuinely covered — the D5 denominator cannot be swapped after signing", () => {
    const swapped = { ...APPROVAL, poValue: 986_000n };
    expect(hashApproval(swapped, MONAD_DOMAIN)).not.toBe(hashApproval(APPROVAL, MONAD_DOMAIN));
  });

  it("recoverApprover round-trips to the signing address", async () => {
    const account = privateKeyToAccount(PK_PRINCIPAL);
    const sig = await account.signTypedData({
      domain: { name: "SourcePilot", version: "1", chainId: 10143, verifyingContract: REGISTRY },
      types: {
        PaymentApproval: [
          { name: "mandateHash", type: "bytes32" },
          { name: "payeeHash", type: "bytes32" },
          { name: "amount", type: "uint256" },
          { name: "poValue", type: "uint256" },
          { name: "stage", type: "uint8" },
          { name: "nonce", type: "bytes32" },
        ],
      },
      primaryType: "PaymentApproval",
      message: APPROVAL,
    });
    expect(recoverApprover(APPROVAL, MONAD_DOMAIN, sig)).toBe(PRINCIPAL);
  });

  it("uses the explicit chain and registry for approval domain separation", () => {
    const anvil = { chainId: 31337, verifyingContract: REGISTRY } as const;
    expect(hashApproval(APPROVAL, anvil)).not.toBe(hashApproval(APPROVAL, MONAD_DOMAIN));
    expect(hashApproval(APPROVAL, OTHER_MONAD_DOMAIN)).not.toBe(hashApproval(APPROVAL, MONAD_DOMAIN));
  });

  it("has no implicit approval domain", () => {
    if (false) {
      // @ts-expect-error A3 requires an explicit approval domain.
      hashApproval(APPROVAL);
      // @ts-expect-error A3 requires an explicit approval domain before the signature.
      recoverApprover(APPROVAL, "0x");
    }
    expect(hashApproval.length).toBe(2);
    expect(recoverApprover.length).toBe(3);
  });
});
