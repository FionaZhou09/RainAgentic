import { describe, expect, it } from "vitest";
import { verifyChainClaims, type ClaimInput } from "./verify-chain-claims";

const local = (content: string, path = "sourcepilot/app/page.tsx"): ClaimInput => ({
  chainId: 31337,
  registryAddress: "0x1111111111111111111111111111111111111111",
  sources: [{ path, content }],
});

describe("chain-claim verifier mutations", () => {
  it("invokes both actual Local Anvil route handlers and rejects runtime key divergence", async () => {
    const module = await import("./verify-chain-claims") as Record<string, unknown>;
    expect(typeof module.verifyRuntimeRoutes).toBe("function");
    const verifyRuntimeRoutes = module.verifyRuntimeRoutes as (options?: {
      mutate?: (route: string, body: Record<string, unknown>) => Record<string, unknown>;
    }) => Promise<Array<{ route: string; body: Record<string, unknown> }>>;

    const actual = await verifyRuntimeRoutes();
    expect(actual.map(({ route }) => route).sort()).toEqual(["/api/mandate", "/api/pay"]);
    expect(actual.every(({ body }) => typeof body.transactionHash === "string"
      && !("monadTxHash" in body) && !("monadTransaction" in body))).toBe(true);

    for (const target of ["/api/mandate", "/api/pay"]) {
      await expect(verifyRuntimeRoutes({ mutate: (route, body) => route === target
        ? { ...body, monadTxHash: body.transactionHash, transactionHash: undefined }
        : body })).rejects.toThrow(/runtime|Monad|identifier/i);
    }
  }, 30_000);

  it("inspects actual configured route response objects under 31337", () => {
    const input = {
      ...local("safe"),
      runtimeResponses: [
        { route: "/api/mandate", body: { monadTxHash: `0x${"a".repeat(64)}` } },
        { route: "/api/pay", body: { transactionHash: `0x${"b".repeat(64)}` } },
      ],
    };
    expect(() => verifyChainClaims(input as ClaimInput)).toThrow(/runtime|Monad|identifier/i);
  });

  it("accepts truthful runtime transaction keys for both configured environments", () => {
    const localInput = { ...local("safe"), runtimeResponses: [{ route: "/api/pay", body: { transactionHash: `0x${"a".repeat(64)}` } }] };
    expect(() => verifyChainClaims(localInput as ClaimInput)).not.toThrow();
    expect(() => verifyChainClaims({ chainId: 10143, registryAddress: "0x1111111111111111111111111111111111111111", sources: [],
      runtimeResponses: [{ route: "/api/mandate", body: { transactionHash: `0x${"b".repeat(64)}` } }] } as ClaimInput)).not.toThrow();
  });
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

  it.each(["sourcepilot/app/page.tsx", "scripts/harness-output"])("rejects unlabeled transaction/hash presentation in %s", (path) => {
    expect(() => verifyChainClaims(local(`Transaction hash: 0x${"a".repeat(64)}`, path))).toThrow(/Local Anvil|unlabeled/i);
    expect(() => verifyChainClaims(local(`Local Anvil transaction hash: 0x${"a".repeat(64)}`, path))).not.toThrow();
  });

  it.each([
    `Local Anvil monadTxHash: 0x${"a".repeat(64)}`,
    JSON.stringify({ environment: "Local Anvil", monadTxHash: `0x${"a".repeat(64)}` }),
    JSON.stringify({ environment: "Local Anvil", monadTransaction: `0x${"a".repeat(64)}` }),
    `const monadTransaction = "0x${"a".repeat(64)}"`,
  ])("rejects Monad-specific 31337 presentation identifiers: %s", (mutation) => {
    expect(() => verifyChainClaims(local(mutation, "scripts/harness-output"))).toThrow(/Monad|Local Anvil/i);
    expect(() => verifyChainClaims(local(mutation, "sourcepilot/app/page.tsx"))).toThrow(/Monad|Local Anvil/i);
  });

  it.each([
    `Local Anvil localTxHash: 0x${"a".repeat(64)}`,
    JSON.stringify({ environment: "Local Anvil", transactionHash: `0x${"a".repeat(64)}` }),
  ])("permits explicitly local 31337 presentation: %s", (presentation) => {
    expect(() => verifyChainClaims(local(presentation, "scripts/harness-output"))).not.toThrow();
  });

  it("rejects every governed banned string", () => {
    for (const mutation of [
      "replay the same request",
      "the contract enforces the 30% cap",
      "the contract enforces the thirty percent cap",
      "expires at the end of the month",
      "expires in sixty days",
      "Supplier was over budget and eliminated",
    ]) {
      expect(() => verifyChainClaims(local(mutation))).toThrow();
    }
  });

  it.each([true, false])("rejects shipped enforcement copy that disagrees when APPROVAL_ONCHAIN_VERIFY=%s", (flag) => {
    expect(() => verifyChainClaims({ ...local("safe"), approvalOnchainVerify: flag, shippedEnforcementClaim: "wrong claim" })).toThrow(/enforcement/i);
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
