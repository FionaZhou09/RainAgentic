import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  toHex,
  type Address,
  type Chain,
  type Hex,
} from "viem";
import { computePayeeScope, hashPayeeRef } from "@/lib/mandate/payee";
import { hashMandate, mandateDomain } from "@/lib/mandate";
import { MANDATE_TYPES, type ProcurementMandate } from "@/lib/mandate/types";
import type { ChainEnvironment } from "./config";
import {
  createViemRegistryClient,
  MandateHashMismatch,
  type RegistryClient,
} from "./registry";
import { startAnvil, type RunningAnvil } from "../../../scripts/start-anvil";

type Artifact = { abi: readonly unknown[]; bytecode: { object: Hex } };

const contractsDirectory = resolve(process.cwd(), "contracts");
const artifactPath = resolve(contractsDirectory, "out/MandateRegistry.sol/MandateRegistry.json");

describe("createViemRegistryClient against MandateRegistry on Anvil", () => {
  let anvil: RunningAnvil;
  let chain: Chain;
  let environment: ChainEnvironment;
  let client: RegistryClient;
  let principal: Address;
  let agent: Address;
  let mandate: ProcurementMandate;
  let signature: Hex;
  let mandateHash: Hex;
  let payeeSet: Hex[];
  let allowedPayee: Hex;

  beforeAll(async () => {
    execFileSync("/Users/yingzhou/.foundry/bin/forge", ["build"], {
      cwd: contractsDirectory,
      stdio: "ignore",
    });
    anvil = await startAnvil();

    chain = defineChain({
      id: 31337,
      name: "Local Anvil",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [anvil.rpcUrl] } },
    });
    const transport = http(anvil.rpcUrl);
    const publicClient = createPublicClient({ chain, transport });
    const unlockedWallet = createWalletClient({ chain, transport });
    [principal, agent] = await unlockedWallet.getAddresses();

    const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as Artifact;
    const deployHash = await unlockedWallet.deployContract({
      account: principal,
      abi: artifact.abi,
      bytecode: artifact.bytecode.object,
    });
    const deployment = await publicClient.waitForTransactionReceipt({ hash: deployHash });
    if (!deployment.contractAddress) throw new Error("MandateRegistry deployment returned no address");

    environment = {
      chainId: 31337,
      rpcUrl: anvil.rpcUrl,
      registryAddress: deployment.contractAddress,
      label: "Local Anvil",
    };
    const agentWallet = createWalletClient({ account: agent, chain, transport });
    client = createViemRegistryClient({ environment, publicClient, walletClient: agentWallet });

    const scope = computePayeeScope(["rain:payee:allowed", "rain:payee:second"]);
    payeeSet = scope.leaves;
    allowedPayee = hashPayeeRef("rain:payee:allowed");
    const now = BigInt(Math.floor(Date.now() / 1000));
    mandate = {
      principal,
      agent,
      purchaseRequestId: keccak256(toHex("PR-SP01")),
      fundingSource: keccak256(toHex("funding:sp01")),
      maxTotal: 184_000n,
      autonomousMax: 20_000n,
      maxDepositBps: 3_000n,
      payeeScope: scope.scope,
      purpose: "SP-01 real Anvil integration",
      validAfter: now - 60n,
      validUntil: now + 3_600n,
      nonce: keccak256(toHex("sp01-mandate")),
    };
    signature = await unlockedWallet.signTypedData({
      account: principal,
      domain: mandateDomain({
        chainId: environment.chainId,
        verifyingContract: environment.registryAddress,
      }),
      types: MANDATE_TYPES,
      primaryType: "ProcurementMandate",
      message: mandate,
    });
  }, 30_000);

  afterAll(async () => anvil?.stop());

  it("create returns the Solidity hash and confirms the MandateCreated event", async () => {
    const result = await client.create(mandate, signature);
    mandateHash = result.mandateHash;

    expect(result.mandateHash).toBe(hashMandate(mandate, {
      chainId: environment.chainId,
      verifyingContract: environment.registryAddress,
    }));
  });

  it("throws MandateHashMismatch when the predicted and returned hashes differ", async () => {
    const changedMandate = { ...mandate, nonce: keccak256(toHex("sp01-mismatch")) };
    const changedSignature = await createWalletClient({ chain, transport: http(anvil.rpcUrl) })
      .signTypedData({
        account: principal,
        domain: mandateDomain({
          chainId: environment.chainId,
          verifyingContract: environment.registryAddress,
        }),
        types: MANDATE_TYPES,
        primaryType: "ProcurementMandate",
        message: changedMandate,
      });
    const realPublicClient = createPublicClient({ chain, transport: http(anvil.rpcUrl) });
    const mismatchingPublicClient = Object.create(realPublicClient) as typeof realPublicClient;
    const originalSimulate = realPublicClient.simulateContract.bind(realPublicClient) as
      (parameters: unknown) => Promise<Record<string, unknown>>;
    Object.defineProperty(mismatchingPublicClient, "simulateContract", {
      value: async (parameters: unknown) => ({
        ...await originalSimulate(parameters),
        result: `0x${"ff".repeat(32)}`,
      }),
    });
    const mismatched = createViemRegistryClient({
      environment,
      publicClient: mismatchingPublicClient,
      walletClient: createWalletClient({ account: agent, chain, transport: http(anvil.rpcUrl) }),
    });

    await expect(mismatched.create(changedMandate, changedSignature))
      .rejects.toBeInstanceOf(MandateHashMismatch);
  });

  it("decodes a simulation custom error without sending a transaction", async () => {
    const result = await client.simulateRecord({
      mandateHash,
      amountMinor: 18_000n,
      payeeHash: hashPayeeRef("rain:payee:fraud"),
      payeeSet,
      poValueMinor: 0n,
      stage: "sample",
    });

    expect(result).toMatchObject({ ok: false, reason: "PayeeOutOfScope" });
  });

  it("records a real transaction and reports the decremented remaining value", async () => {
    const result = await client.record({
      mandateHash,
      amountMinor: 18_000n,
      payeeHash: allowedPayee,
      payeeSet,
      poValueMinor: 0n,
      stage: "sample",
    });

    expect(result).toMatchObject({ ok: true, remainingMinor: 166_000n });
    expect(await client.remaining(mandateHash)).toBe(166_000n);
  });

  it("builds revocation for the configured environment and contract", () => {
    const command = client.revokeCommand(mandateHash);
    expect(command).toContain(environment.rpcUrl);
    expect(command).toContain(environment.registryAddress);
    expect(command).not.toContain("PRIVATE_KEY");
  });
});
