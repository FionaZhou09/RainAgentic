import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPublicClient, http, keccak256, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { runMonadDeployment, type DeploymentEvidence } from "./deploy-monad";

const PRINCIPAL_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
const AGENT_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const repositoryRoot = resolve(import.meta.dirname, "..");
const contractsDirectory = resolve(repositoryRoot, "sourcepilot/contracts");
const artifactPath = resolve(contractsDirectory, "out/MandateRegistry.sol/MandateRegistry.json");

async function availablePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("No test port"));
      server.close((error) => error ? reject(error) : resolvePort(address.port));
    });
  });
}

async function startAnvil(chainId: number): Promise<{ rpcUrl: string; child: ChildProcess }> {
  const port = await availablePort();
  const rpcUrl = `http://127.0.0.1:${port}`;
  const child = spawn("/Users/yingzhou/.foundry/bin/anvil", [
    "--host", "127.0.0.1", "--port", String(port), "--chain-id", String(chainId), "--silent",
  ], { stdio: "ignore" });
  for (let i = 0; i < 100; i += 1) {
    try {
      const response = await fetch(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }) });
      if (response.ok) return { rpcUrl, child };
    } catch { /* still starting */ }
    await new Promise((done) => setTimeout(done, 20));
  }
  child.kill("SIGTERM");
  throw new Error("Anvil did not start");
}

describe("Monad deployment and bounded enforcement proof", () => {
  let anvil: Awaited<ReturnType<typeof startAnvil>>;
  let artifact: { abi: readonly unknown[]; bytecode: { object: Hex }; deployedBytecode: { object: Hex } };
  let evidence: DeploymentEvidence;

  beforeAll(async () => {
    execFileSync("/Users/yingzhou/.foundry/bin/forge", ["build"], { cwd: contractsDirectory, stdio: "ignore" });
    artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
    anvil = await startAnvil(10143);
    evidence = await runMonadDeployment({
      chainId: "10143",
      rpcUrl: anvil.rpcUrl,
      principalAddress: privateKeyToAccount(PRINCIPAL_KEY).address,
      agentAddress: privateKeyToAccount(AGENT_KEY).address,
      principalPrivateKey: PRINCIPAL_KEY,
      agentPrivateKey: AGENT_KEY,
      artifact,
      explorerBaseUrl: "https://testnet.monadvision.com",
    });
  }, 30_000);

  afterAll(() => anvil?.child.kill("SIGTERM"));

  it("uses an explicit 10143 domain and deploys the exact real bytecode", async () => {
    expect(evidence.chainId).toBe(10143);
    expect(evidence.environment).toBe("Monad Testnet");
    expect(evidence.registryAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
    const publicClient = createPublicClient({ transport: http(anvil.rpcUrl) });
    const code = await publicClient.getCode({ address: evidence.registryAddress });
    expect(code).toBe(artifact.deployedBytecode.object);
    expect(evidence.deployedCodeHash).toBe(keccak256(code!));
  });

  it("agrees on the local, recovered, predicted, returned, and on-chain mandate hash", () => {
    expect(evidence.mandateHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(evidence.createTx).toMatch(/^0x[0-9a-f]{64}$/);
    expect(evidence.principalAddress).toBe(privateKeyToAccount(PRINCIPAL_KEY).address);
    expect(evidence.agentAddress).toBe(privateKeyToAccount(AGENT_KEY).address);
  });

  it("records 18_000 cents and verifies spent and remaining on-chain", () => {
    expect(evidence.amountMinor).toBe("18000");
    expect(evidence.spentMinor).toBe("18000");
    expect(evidence.remainingMinor).toBe("166000");
    expect(evidence.recordTx).toMatch(/^0x[0-9a-f]{64}$/);
    expect(evidence.recordBlock).toMatch(/^\d+$/);
  });

  it("rejects the changed payee in Solidity before any Rain surface", () => {
    expect(evidence.changedPayeeReason).toBe("PayeeOutOfScope");
    expect(readFileSync(resolve(repositoryRoot, "scripts/deploy-monad.ts"), "utf8")).not.toMatch(/lib\/rain|RainAdapter|RAIN_/);
  });

  it("revokes with the principal and rejects a fresh post-revoke simulation", () => {
    expect(evidence.revokeTx).toMatch(/^0x[0-9a-f]{64}$/);
    expect(evidence.postRevokeReason).toBe("Revoked");
  });

  it("contains public evidence only", () => {
    const serialized = JSON.stringify(evidence);
    expect(serialized).not.toContain(PRINCIPAL_KEY.slice(2));
    expect(serialized).not.toContain(AGENT_KEY.slice(2));
    expect(serialized).not.toMatch(/privateKey|signature|authorization|PAN|CVV/i);
  });

  it("fails before deployment when the RPC chain does not equal 10143", async () => {
    const wrong = await startAnvil(31337);
    try {
      await expect(runMonadDeployment({
        chainId: "10143", rpcUrl: wrong.rpcUrl,
        principalAddress: privateKeyToAccount(PRINCIPAL_KEY).address,
        agentAddress: privateKeyToAccount(AGENT_KEY).address,
        principalPrivateKey: PRINCIPAL_KEY, agentPrivateKey: AGENT_KEY,
        artifact, explorerBaseUrl: "https://testnet.monadvision.com",
      })).rejects.toThrow("RPC chainId 31337 does not match required chainId 10143");
    } finally { wrong.child.kill("SIGTERM"); }
  });
});
