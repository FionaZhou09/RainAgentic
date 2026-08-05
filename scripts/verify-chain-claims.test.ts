import { describe, expect, it } from "vitest";
import { verifyChainClaims, type ClaimInput } from "./verify-chain-claims";

const local = (content: string, path = "sourcepilot/app/page.tsx"): ClaimInput => ({
  chainId: 31337,
  registryAddress: "0x1111111111111111111111111111111111111111",
  sources: [{ path, content }],
});

describe("chain-claim verifier mutations", () => {
  it.each([
    "deployed on Monad",
    "Monad transaction",
    "https://testnet.monadvision.com/tx/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "Monad tx: 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  ])("rejects forbidden local-to-Monad claim: %s", (mutation) => {
    expect(() => verifyChainClaims(local(mutation))).toThrow();
  });

  it("requires explicit environment metadata for transaction evidence", () => {
    expect(() => verifyChainClaims(local(JSON.stringify({ txHash: `0x${"a".repeat(64)}` }), "output/playwright/evidence.json"))).toThrow(/environment/i);
  });

  it("rejects every governed banned string", () => {
    for (const mutation of [
      "replay the same request",
      "the contract enforces the 30% cap",
      "the contract enforces the thirty percent cap",
      "expires at the end of the month",
    ]) {
      expect(() => verifyChainClaims(local(mutation))).toThrow();
    }
  });

  it("rejects shipped enforcement copy that disagrees with APPROVAL_ONCHAIN_VERIFY", () => {
    expect(() => verifyChainClaims({ ...local("safe"), approvalOnchainVerify: true, shippedEnforcementClaim: "wrong claim" })).toThrow(/enforcement/i);
  });

  it("rejects mismatched Monad evidence registry metadata", () => {
    expect(() => verifyChainClaims({
      chainId: 10143,
      registryAddress: "0x1111111111111111111111111111111111111111",
      sources: [{ path: "output/playwright/evidence.json", content: JSON.stringify({ environment: "Monad Testnet", registryAddress: "0x2222222222222222222222222222222222222222" }) }],
    })).toThrow(/registry/i);
  });

  it("rejects local labels in final Monad evidence", () => {
    expect(() => verifyChainClaims({
      chainId: 10143,
      registryAddress: "0x1111111111111111111111111111111111111111",
      sources: [{ path: "output/playwright/evidence.json", content: JSON.stringify({ environment: "Local Anvil", registryAddress: "0x1111111111111111111111111111111111111111" }) }],
    })).toThrow(/local|anvil/i);
  });
});
