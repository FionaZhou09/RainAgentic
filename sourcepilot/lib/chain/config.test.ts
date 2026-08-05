import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

describe("tracked environment example schema", () => {
  it("covers check-env and runtime variables without containing private key values", () => {
    const example = readFileSync(resolve(process.cwd(), ".env.secrets.local.example"), "utf8");
    const checkEnvSource = readFileSync(resolve(process.cwd(), "../scripts/check-env.ts"), "utf8");
    const values = new Map(
      example
        .split("\n")
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const separator = line.indexOf("=");
          return [line.slice(0, separator), line.slice(separator + 1)] as const;
        }),
    );
    const checkEnvVariables = [
      ...checkEnvSource.matchAll(/requireEnv\("([A-Z0-9_]+)"\)/g),
    ].map((match) => match[1]);
    const required = new Set([
      ...checkEnvVariables,
      "CHAIN_ID",
      "CHAIN_RPC_URL",
      "MANDATE_REGISTRY_ADDRESS",
      "MONAD_TESTNET_RPC_URL_BACKUP_1",
      "MONAD_TESTNET_RPC_URL_BACKUP_2",
    ]);

    expect([...required].filter((name) => !values.has(name))).toEqual([]);
    expect(values.get("MONAD_TESTNET_RPC_URL")).toMatch(/^https:\/\//);
    expect(values.get("MONAD_TESTNET_RPC_URL_BACKUP1")).toMatch(/^https:\/\//);
    expect(values.get("MONAD_TESTNET_RPC_URL_BACKUP2")).toMatch(/^https:\/\//);
    expect([...values.entries()].filter(([name, value]) => name.endsWith("PRIVATE_KEY") && value))
      .toEqual([]);
  });
});
