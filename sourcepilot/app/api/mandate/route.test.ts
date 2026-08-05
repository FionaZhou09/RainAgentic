import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPublicClient, createWalletClient, defineChain, http, keccak256, toHex, type Address, type Chain, type Hex } from "viem";
import { computePayeeScope, mandateDomain, MANDATE_TYPES, type ProcurementMandate } from "@/lib/mandate";
import { serializeMandate } from "@/lib/mandate/serialize";
import { createViemRegistryClient, MandateHashMismatch, type RegistryClient } from "@/lib/chain/registry";
import type { ChainEnvironment } from "@/lib/chain/config";
import { createEventStore } from "@/lib/events";
import { startAnvil, type RunningAnvil } from "../../../../scripts/start-anvil";
import { POST } from "./route";
import { verifyChainClaims } from "../../../../scripts/verify-chain-claims";

type Artifact = { abi: readonly unknown[]; bytecode: { object: Hex } };

describe("POST /api/mandate", () => {
  let anvil: RunningAnvil;
  let environment: ChainEnvironment;
  let registry: RegistryClient;
  let chain: Chain;
  let agent: Address;
  let mandate: ProcurementMandate;
  let signature: Hex;
  let payeeRefs: string[];

  beforeAll(async () => {
    const contractsDirectory = resolve(process.cwd(), "contracts");
    execFileSync("/Users/yingzhou/.foundry/bin/forge", ["build"], { cwd: contractsDirectory, stdio: "ignore" });
    anvil = await startAnvil();
    chain = defineChain({ id: 31337, name: "Local Anvil", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [anvil.rpcUrl] } } });
    const transport = http(anvil.rpcUrl);
    const publicClient = createPublicClient({ chain, transport });
    const wallet = createWalletClient({ chain, transport });
    const [principal, agentAddress] = await wallet.getAddresses();
    agent = agentAddress;
    const artifact = JSON.parse(readFileSync(resolve(contractsDirectory, "out/MandateRegistry.sol/MandateRegistry.json"), "utf8")) as Artifact;
    const deployment = await publicClient.waitForTransactionReceipt({ hash: await wallet.deployContract({ account: principal, abi: artifact.abi, bytecode: artifact.bytecode.object }) });
    environment = { chainId: 31337, rpcUrl: anvil.rpcUrl, registryAddress: deployment.contractAddress!, label: "Local Anvil" };
    registry = createViemRegistryClient({ environment, publicClient, walletClient: createWalletClient({ account: agent, chain, transport }) });
    payeeRefs = [" Rain:Payee:Allowed ", "rain:payee:second"];
    const scope = computePayeeScope(payeeRefs);
    const now = BigInt(Math.floor(Date.now() / 1000));
    mandate = { principal, agent, purchaseRequestId: keccak256(toHex("PR-1042")), fundingSource: keccak256(toHex("funding")), maxTotal: 184000n, autonomousMax: 20000n, maxDepositBps: 3000n, payeeScope: scope.scope, purpose: "Source PR-1042", validAfter: now - 60n, validUntil: now + 3600n, nonce: keccak256(toHex("sp03")) };
    signature = await wallet.signTypedData({ account: principal, domain: mandateDomain({ chainId: environment.chainId, verifyingContract: environment.registryAddress }), types: MANDATE_TYPES, primaryType: "ProcurementMandate", message: mandate });
  }, 30_000);

  afterAll(async () => anvil?.stop());

  const request = (body: unknown) => new Request("http://local/api/mandate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  it("uses explicit A2 domain and real Anvil RegistryClient, returning contract hash and real tx", async () => {
    const events = createEventStore();
    const response = await POST.withDependencies({ registry, environment, events })(request({ mandate: serializeMandate(mandate), signature, payeeRefs }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mandateHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(body.transactionHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(body.explorerUrl).toBe(registry.explorerTx(body.transactionHash));
    expect(body).not.toHaveProperty("monadTxHash");
    expect(body).not.toHaveProperty("monadTransaction");
    expect(() => verifyChainClaims({ chainId: 31337, registryAddress: environment.registryAddress, sources: [],
      runtimeResponses: [{ route: "/api/mandate", body }] })).not.toThrow();
    expect(body.payeeScope).toBe(mandate.payeeScope);
    expect(body.payeePreimage).toBe(computePayeeScope(payeeRefs).preimage);
    expect(body.recoveredSigner.toLowerCase()).toBe(mandate.principal.toLowerCase());
    expect(body.constraints).toEqual({ maxTotalMinor: "184000", autonomousMaxMinor: "20000", maxDepositBps: 3000, validAfter: Number(mandate.validAfter), validUntil: Number(mandate.validUntil) });
    expect(events.read("PR-1042").map((event) => event.type)).toEqual(["mandate_registered"]);
  });

  it("rejects malformed input, payee preimage mismatch, and wrong-domain signature with no success event", async () => {
    const wrongDomainMandate = { ...mandate, nonce: keccak256(toHex("wrong-domain")) };
    const wrongDomainSignature = await createWalletClient({ transport: http(anvil.rpcUrl) }).signTypedData({
      account: mandate.principal,
      domain: mandateDomain({ chainId: 10143, verifyingContract: environment.registryAddress }),
      types: MANDATE_TYPES,
      primaryType: "ProcurementMandate",
      message: wrongDomainMandate,
    });
    for (const body of [
      {},
      { mandate: serializeMandate({ ...mandate, nonce: keccak256(toHex("bad-scope")), payeeScope: keccak256(toHex("wrong")) }), signature, payeeRefs },
      { mandate: serializeMandate(wrongDomainMandate), signature: wrongDomainSignature, payeeRefs },
    ]) {
      const events = createEventStore();
      const response = await POST.withDependencies({ registry, environment, events })(request(body));
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(events.read("PR-1042")).toEqual([]);
    }
  });

  it("does not swallow fatal MandateHashMismatch or emit success", async () => {
    const events = createEventStore();
    const fresh = { ...mandate, nonce: keccak256(toHex("fatal")) };
    const wallet = createWalletClient({ transport: http(anvil.rpcUrl) });
    const fatalSignature = await wallet.signTypedData({ account: mandate.principal as Address, domain: mandateDomain({ chainId: environment.chainId, verifyingContract: environment.registryAddress }), types: MANDATE_TYPES, primaryType: "ProcurementMandate", message: fresh });
    const realPublicClient = createPublicClient({ chain, transport: http(anvil.rpcUrl) });
    const mismatchingPublicClient = Object.create(realPublicClient) as typeof realPublicClient;
    const simulate = realPublicClient.simulateContract.bind(realPublicClient) as (parameters: unknown) => Promise<Record<string, unknown>>;
    Object.defineProperty(mismatchingPublicClient, "simulateContract", {
      value: async (parameters: unknown) => ({ ...await simulate(parameters), result: `0x${"ff".repeat(32)}` }),
    });
    const fatalRegistry = createViemRegistryClient({
      environment,
      publicClient: mismatchingPublicClient,
      walletClient: createWalletClient({ account: agent, chain, transport: http(anvil.rpcUrl) }),
    });
    await expect(POST.withDependencies({ registry: fatalRegistry, environment, events })(request({ mandate: serializeMandate(fresh), signature: fatalSignature, payeeRefs }))).rejects.toBeInstanceOf(MandateHashMismatch);
    expect(events.read("PR-1042")).toEqual([]);
  });
});
