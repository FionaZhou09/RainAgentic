import { describe, expect, it } from "vitest";
import { mandateDomain } from "@/lib/mandate";
import { loadChainEnvironment } from "./config";

const registry = "0x0000000000000000000000000000000000001234";

describe("loadChainEnvironment", () => {
  it.each([
    ["31337", 31337, "Local Anvil"],
    ["10143", 10143, "Monad Testnet"],
  ] as const)("loads supported chain %s", (rawChainId, chainId, label) => {
    const environment = loadChainEnvironment({
      NODE_ENV: "test",
      CHAIN_ID: rawChainId,
      CHAIN_RPC_URL: "http://127.0.0.1:8545",
      MANDATE_REGISTRY_ADDRESS: registry,
    });

    expect(environment).toEqual({
      chainId,
      rpcUrl: "http://127.0.0.1:8545",
      registryAddress: registry,
      label,
    });
  });

  it.each(["CHAIN_ID", "CHAIN_RPC_URL", "MANDATE_REGISTRY_ADDRESS"])(
    "rejects a missing %s",
    (missing) => {
      const env: NodeJS.ProcessEnv = {
        NODE_ENV: "test",
        CHAIN_ID: "31337",
        CHAIN_RPC_URL: "http://127.0.0.1:8545",
        MANDATE_REGISTRY_ADDRESS: registry,
      };
      delete env[missing];

      expect(() => loadChainEnvironment(env)).toThrow(missing);
    },
  );

  it("rejects unsupported chains", () => {
    expect(() => loadChainEnvironment({
      NODE_ENV: "test",
      CHAIN_ID: "1",
      CHAIN_RPC_URL: "https://example.invalid",
      MANDATE_REGISTRY_ADDRESS: registry,
    })).toThrow("Unsupported chain");
  });

  it("uses the client chain and registry address in the signing domain", () => {
    const environment = loadChainEnvironment({
      NODE_ENV: "test",
      CHAIN_ID: "31337",
      CHAIN_RPC_URL: "http://127.0.0.1:8545",
      MANDATE_REGISTRY_ADDRESS: registry,
    });

    expect(mandateDomain({
      chainId: environment.chainId,
      verifyingContract: environment.registryAddress,
    })).toMatchObject({
      chainId: environment.chainId,
      verifyingContract: environment.registryAddress,
    });
  });
});
