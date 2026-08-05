import { describe, it, expect } from "vitest";
import type { DigestVector, ProcurementMandate } from "./types";
import { hashMandate, recoverMandateSigner } from "./index";
import { computePayeeScope } from "./payee";
import { deserializeMandate } from "./serialize";
import vectorJson from "./__fixtures__/digest-vector.json";

const vector = vectorJson as unknown as DigestVector;

describe("digest-vector.json — the cross-language pin WP3 asserts against", () => {
  it("exists and carries every field of the DigestVector shape", () => {
    for (const key of [
      "registry", "mandate", "expectedDigest", "signature", "expectedSigner",
      "payeeRefs", "expectedPayeeScope", "expectedLeaves", "tamperedMandate", "tamperedField",
    ]) {
      expect(vector, `missing ${key}`).toHaveProperty(key);
    }
  });

  it("serializes every uint256 as a DECIMAL STRING, not a JSON number", () => {
    // Foundry reads these with vm.parseJsonString + vm.parseUint. A JSON number here
    // would silently lose precision on a large uint and break the Solidity side.
    for (const field of ["maxTotal", "autonomousMax", "maxDepositBps", "validAfter", "validUntil"] as const) {
      expect(typeof vector.mandate[field]).toBe("string");
      expect(vector.mandate[field]).toMatch(/^[0-9]+$/);
    }
  });

  it("expectedDigest is reproducible from the twelve fields alone", () => {
    const m = deserializeMandate(vector.mandate);
    expect(hashMandate(m, vector.registry)).toBe(vector.expectedDigest);
  });

  it("expectedSigner recovers from the signature over the untampered mandate", () => {
    const m = deserializeMandate(vector.mandate);
    expect(recoverMandateSigner(m, vector.registry, vector.signature)).toBe(vector.expectedSigner);
    expect(vector.expectedSigner).toBe(m.principal);
  });

  it("payee scope and leaves reproduce from payeeRefs", () => {
    const { scope, leaves } = computePayeeScope(vector.payeeRefs);
    expect(scope).toBe(vector.expectedPayeeScope);
    expect(leaves).toEqual(vector.expectedLeaves);
    expect(vector.mandate.payeeScope).toBe(vector.expectedPayeeScope);
  });

  it("leaves are strictly ascending, so payeeSet can never trip BadPayeeSet", () => {
    for (let i = 1; i < vector.expectedLeaves.length; i++) {
      expect(BigInt(vector.expectedLeaves[i]) > BigInt(vector.expectedLeaves[i - 1])).toBe(true);
    }
  });
});

describe("tamperedMandate — D0's regression test, handed to WP3", () => {
  it("differs from the signed mandate in EXACTLY ONE field", () => {
    const keys = Object.keys(vector.mandate) as Array<keyof ProcurementMandate>;
    const differing = keys.filter(
      (k) => String(vector.mandate[k]) !== String(vector.tamperedMandate[k]),
    );
    expect(differing).toEqual([vector.tamperedField]);
  });

  it("alters a field that materially changes what the founder authorized", () => {
    // A cosmetic tamper would make WP3's BadSignature test prove nothing interesting.
    expect(["maxTotal", "autonomousMax", "maxDepositBps", "payeeScope", "agent"])
      .toContain(vector.tamperedField);
  });

  it("produces a DIFFERENT digest than the signed mandate", () => {
    const tampered = deserializeMandate(vector.tamperedMandate);
    expect(hashMandate(tampered, vector.registry)).not.toBe(vector.expectedDigest);
  });

  /**
   * THE test. A genuine signature paired with constraints the founder never agreed to
   * must not recover the principal. WP3 asserts the on-chain half: create() reverts
   * BadSignature on exactly this input.
   */
  it("does NOT recover the principal when paired with the unchanged signature", () => {
    const tampered = deserializeMandate(vector.tamperedMandate);
    const recovered = recoverMandateSigner(tampered, vector.registry, vector.signature);
    expect(recovered).not.toBe(vector.expectedSigner);
  });
});
