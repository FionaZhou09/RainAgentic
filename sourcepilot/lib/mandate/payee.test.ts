import { describe, it, expect } from "vitest";
import { keccak256, toHex, concatHex } from "viem";
import {
  normalizePayeeRef,
  hashPayeeRef,
  computePayeeScope,
  verifyPayeeScope,
} from "./payee";

const REFS = [
  "rain:payee:hanzhou-apparel",
  "rain:payee:yuanfeng-textiles",
  "rain:payee:rongcheng-garment",
];
const FRAUD_REF = "rain:payee:hanzhou-apparel-new-account";

describe("normalizePayeeRef() — trim, NFKC, lowercase, collapse internal whitespace", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizePayeeRef("  rain:payee:acme  ")).toBe("rain:payee:acme");
  });

  it("lowercases", () => {
    expect(normalizePayeeRef("RAIN:PAYEE:ACME")).toBe("rain:payee:acme");
  });

  it("applies NFKC — a fullwidth form and its ASCII form must not be different payees", () => {
    // U+FF21 FULLWIDTH LATIN CAPITAL LETTER A normalizes to "a" after NFKC + lowercase
    expect(normalizePayeeRef("ＡCME")).toBe("acme");
  });

  it("collapses internal whitespace runs to a single space", () => {
    expect(normalizePayeeRef("acme   trading    co")).toBe("acme trading co");
    expect(normalizePayeeRef("acme\t\ttrading")).toBe("acme trading");
  });

  it("is idempotent — normalize(normalize(x)) === normalize(x)", () => {
    const messy = ["  RAIN:Payee:  Acme   Co ", "ＡCME\t\tTRADING", "already-normal"];
    for (const raw of messy) {
      const once = normalizePayeeRef(raw);
      expect(normalizePayeeRef(once)).toBe(once);
    }
  });
});

describe("hashPayeeRef()", () => {
  it("hashes the NORMALIZED form, so casing and spacing cannot fork a payee", () => {
    expect(hashPayeeRef("  RAIN:PAYEE:ACME  ")).toBe(hashPayeeRef("rain:payee:acme"));
  });

  it("equals keccak256(utf8(normalized))", () => {
    expect(hashPayeeRef("rain:payee:acme")).toBe(keccak256(toHex("rain:payee:acme")));
  });

  it("gives a different hash to the fraud ref than to the real one", () => {
    expect(hashPayeeRef(FRAUD_REF)).not.toBe(hashPayeeRef("rain:payee:hanzhou-apparel"));
  });
});

describe("computePayeeScope()", () => {
  it("returns leaves in STRICTLY ASCENDING order regardless of input order", () => {
    const { leaves } = computePayeeScope(REFS);
    expect(leaves).toHaveLength(3);
    for (let i = 1; i < leaves.length; i++) {
      expect(BigInt(leaves[i]) > BigInt(leaves[i - 1])).toBe(true);
    }
  });

  it("is order-independent — shuffling the input yields an identical scope", () => {
    const a = computePayeeScope(REFS);
    const b = computePayeeScope([REFS[2], REFS[0], REFS[1]]);
    expect(b.scope).toBe(a.scope);
    expect(b.leaves).toEqual(a.leaves);
  });

  it("computes scope as keccak256(concat(leaves))", () => {
    const { scope, leaves } = computePayeeScope(REFS);
    expect(scope).toBe(keccak256(concatHex(leaves)));
  });

  it("throws on duplicates — 'strictly ascending' excludes equals", () => {
    expect(() => computePayeeScope([REFS[0], REFS[0]])).toThrow();
    // duplicates that differ only by casing/spacing are still duplicates after normalization
    expect(() => computePayeeScope([REFS[0], `  ${REFS[0].toUpperCase()}  `])).toThrow();
  });

  it("throws on an empty ref set — an empty scope would admit nobody but is a caller bug", () => {
    expect(() => computePayeeScope([])).toThrow();
  });

  it("publishes a preimage of the normalized refs in ascending-leaf order", () => {
    const { preimage, leaves } = computePayeeScope(REFS);
    const lines = preimage.split("\n");
    expect(lines).toHaveLength(3);
    // each published line must hash to the leaf at the same index
    lines.forEach((line, i) => expect(hashPayeeRef(line)).toBe(leaves[i]));
    // and each line is already normalized
    lines.forEach((line) => expect(normalizePayeeRef(line)).toBe(line));
  });
});

describe("verifyPayeeScope() — what a third party runs against published data", () => {
  it("returns true for the published preimage", () => {
    const { preimage, scope } = computePayeeScope(REFS);
    expect(verifyPayeeScope(preimage, scope)).toBe(true);
  });

  it("returns false when a ref is swapped for the fraud account", () => {
    const { scope } = computePayeeScope(REFS);
    const tampered = computePayeeScope([REFS[0], REFS[1], FRAUD_REF]).preimage;
    expect(verifyPayeeScope(tampered, scope)).toBe(false);
  });

  it("returns false when a ref is added", () => {
    const { scope } = computePayeeScope(REFS);
    const extra = computePayeeScope([...REFS, FRAUD_REF]).preimage;
    expect(verifyPayeeScope(extra, scope)).toBe(false);
  });

  it("returns false when a ref is removed", () => {
    const { scope } = computePayeeScope(REFS);
    const fewer = computePayeeScope([REFS[0], REFS[1]]).preimage;
    expect(verifyPayeeScope(fewer, scope)).toBe(false);
  });

  it("returns false for a preimage whose lines are not in ascending-leaf order", () => {
    const { preimage, scope } = computePayeeScope(REFS);
    const lines = preimage.split("\n");
    const reordered = [lines[1], lines[0], lines[2]].join("\n");
    expect(verifyPayeeScope(reordered, scope)).toBe(false);
  });
});
