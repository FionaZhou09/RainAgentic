#!/usr/bin/env tsx
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  keccak256,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createViemRegistryClient } from "../sourcepilot/lib/chain/registry";
import { computePayeeScope, hashPayeeRef } from "../sourcepilot/lib/mandate/payee";
import { hashMandate, recoverMandateSigner, signMandate } from "../sourcepilot/lib/mandate";

const REQUIRED_CHAIN_ID = 10143;
const MAX_TOTAL_MINOR = 184_000n;
const AMOUNT_MINOR = 18_000n;
const ALLOWED_PAYEE = "sourcepilot:monad-testnet:allowed-payee";
const CHANGED_PAYEE = "sourcepilot:monad-testnet:changed-payee";

type Artifact = Readonly<{
  abi: readonly unknown[];
  bytecode: { object: Hex };
  deployedBytecode: { object: Hex };
}>;

export type DeploymentEvidence = Readonly<{
  schemaVersion: "1.0";
  environment: "Monad Testnet";
  chainId: 10143;
  registryAddress: Address;
  deploymentTx: Hex;
  deploymentBlock: string;
  deploymentExplorer: string;
  deployedBytecode: Hex;
  deployedCodeHash: Hex;
  mandateHash: Hex;
  createTx: Hex;
  recordTx: Hex;
  recordBlock: string;
  amountMinor: "18000";
  spentMinor: string;
  remainingMinor: string;
  changedPayeeReason: "PayeeOutOfScope";
  revokeTx: Hex;
  postRevokeReason: "Revoked";
  principalAddress: Address;
  agentAddress: Address;
}>;

export type DeploymentInput = Readonly<{
  chainId: string;
  rpcUrl: string;
  principalAddress: Address;
  agentAddress: Address;
  principalPrivateKey: Hex;
  agentPrivateKey: Hex;
  artifact: Artifact;
  explorerBaseUrl: string;
}>;

function requireValue(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required configuration: ${name}`);
  return value;
}

function receiptSucceeded(label: string, status: string): void {
  if (status !== "success") throw new Error(`${label} transaction reverted`);
}

export async function runMonadDeployment(input: DeploymentInput): Promise<DeploymentEvidence> {
  if (input.chainId !== String(REQUIRED_CHAIN_ID)) {
    throw new Error(`Configured chainId ${input.chainId} does not match required chainId ${REQUIRED_CHAIN_ID}`);
  }
  const principalAccount = privateKeyToAccount(input.principalPrivateKey);
  const agentAccount = privateKeyToAccount(input.agentPrivateKey);
  if (principalAccount.address !== getAddress(input.principalAddress)) throw new Error("Principal key does not derive to configured principal address");
  if (agentAccount.address !== getAddress(input.agentAddress)) throw new Error("Agent key does not derive to configured agent address");

  const chain = defineChain({
    id: REQUIRED_CHAIN_ID,
    name: "Monad Testnet",
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: [input.rpcUrl] } },
  });
  const transport = http(input.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const rpcChainId = await publicClient.getChainId();
  if (rpcChainId !== REQUIRED_CHAIN_ID) throw new Error(`RPC chainId ${rpcChainId} does not match required chainId ${REQUIRED_CHAIN_ID}`);

  const principalWallet = createWalletClient({ account: principalAccount, chain, transport });
  const agentWallet = createWalletClient({ account: agentAccount, chain, transport });
  const deploymentTx = await principalWallet.deployContract({ abi: input.artifact.abi, bytecode: input.artifact.bytecode.object });
  const deploymentReceipt = await publicClient.waitForTransactionReceipt({ hash: deploymentTx });
  receiptSucceeded("Deployment", deploymentReceipt.status);
  if (!deploymentReceipt.contractAddress) throw new Error("Successful deployment receipt has no contract address");
  const registryAddress = deploymentReceipt.contractAddress;
  const deployedBytecode = await publicClient.getCode({ address: registryAddress });
  if (!deployedBytecode || deployedBytecode === "0x") throw new Error("Deployed registry has empty code");
  if (deployedBytecode !== input.artifact.deployedBytecode.object) throw new Error("Deployed bytecode does not match the tested MandateRegistry artifact");

  const scope = computePayeeScope([ALLOWED_PAYEE]);
  const deploymentBlock = await publicClient.getBlock({ blockNumber: deploymentReceipt.blockNumber });
  const nonce = keccak256(toHex(`${deploymentBlock.hash}:${registryAddress}:${principalAccount.address}:${agentAccount.address}`));
  const mandate = {
    principal: principalAccount.address,
    agent: agentAccount.address,
    purchaseRequestId: keccak256(toHex("SP-10-MONAD-ENFORCEMENT")),
    fundingSource: keccak256(toHex("sourcepilot:testnet-funded-wallet")),
    maxTotal: MAX_TOTAL_MINOR,
    autonomousMax: 20_000n,
    maxDepositBps: 3_000n,
    payeeScope: scope.scope,
    purpose: "SourcePilot Monad testnet bounded enforcement proof",
    validAfter: deploymentBlock.timestamp > 60n ? deploymentBlock.timestamp - 60n : 0n,
    validUntil: deploymentBlock.timestamp + 7_776_000n,
    nonce,
  } as const;
  const domain = { chainId: REQUIRED_CHAIN_ID as const, verifyingContract: registryAddress };
  const localMandateHash = hashMandate(mandate, domain);
  const signature = await signMandate(mandate, domain, input.principalPrivateKey);
  if (recoverMandateSigner(mandate, domain, signature) !== principalAccount.address) throw new Error("Recovered mandate signer does not match principal");

  const registry = createViemRegistryClient({
    environment: { chainId: REQUIRED_CHAIN_ID, rpcUrl: input.rpcUrl, registryAddress, label: "Monad Testnet" },
    publicClient,
    walletClient: agentWallet,
  });
  const created = await registry.create(mandate, signature);
  if (created.mandateHash !== localMandateHash) throw new Error("RegistryClient mandate prediction does not match local hash");
  const createReceipt = await publicClient.getTransactionReceipt({ hash: created.txHash });
  receiptSucceeded("Create", createReceipt.status);
  const onChainMandateHash = await publicClient.readContract({
    address: registryAddress,
    abi: input.artifact.abi,
    functionName: "hashMandate",
    args: [mandate],
  }) as Hex;
  if (onChainMandateHash !== localMandateHash) throw new Error("On-chain mandate hash does not match canonical local hash");

  const recordArgs = {
    mandateHash: created.mandateHash,
    amountMinor: AMOUNT_MINOR,
    payeeHash: hashPayeeRef(ALLOWED_PAYEE),
    payeeSet: scope.leaves,
    poValueMinor: 0n,
    stage: "sample" as const,
  };
  const record = await registry.record(recordArgs);
  if (!record.ok) throw new Error(`Record unexpectedly failed: ${record.reason}`);
  const recordReceipt = await publicClient.getTransactionReceipt({ hash: record.txHash });
  receiptSucceeded("Record", recordReceipt.status);
  const remainingMinor = await registry.remaining(created.mandateHash);
  const spentMinor = MAX_TOTAL_MINOR - remainingMinor;
  if (spentMinor !== AMOUNT_MINOR || remainingMinor !== 166_000n) throw new Error("On-chain spent/remaining values disagree with the 18,000-cent record");

  const changedPayee = await registry.simulateRecord({ ...recordArgs, payeeHash: hashPayeeRef(CHANGED_PAYEE) });
  if (changedPayee.ok || changedPayee.reason !== "PayeeOutOfScope") throw new Error("Changed-payee simulation did not fail with PayeeOutOfScope");

  const revokeTx = await principalWallet.writeContract({ address: registryAddress, abi: input.artifact.abi, functionName: "revoke", args: [created.mandateHash] });
  const revokeReceipt = await publicClient.waitForTransactionReceipt({ hash: revokeTx });
  receiptSucceeded("Revoke", revokeReceipt.status);
  const postRevoke = await registry.simulateRecord(recordArgs);
  if (postRevoke.ok || postRevoke.reason !== "Revoked") throw new Error("Post-revoke simulation did not fail with Revoked");

  return {
    schemaVersion: "1.0", environment: "Monad Testnet", chainId: REQUIRED_CHAIN_ID,
    registryAddress, deploymentTx, deploymentBlock: deploymentReceipt.blockNumber.toString(),
    deploymentExplorer: `${input.explorerBaseUrl}/tx/${deploymentTx}`,
    deployedBytecode, deployedCodeHash: keccak256(deployedBytecode),
    mandateHash: created.mandateHash, createTx: created.txHash,
    recordTx: record.txHash, recordBlock: record.blockNumber.toString(), amountMinor: "18000",
    spentMinor: spentMinor.toString(), remainingMinor: remainingMinor.toString(),
    changedPayeeReason: "PayeeOutOfScope", revokeTx, postRevokeReason: "Revoked",
    principalAddress: principalAccount.address, agentAddress: agentAccount.address,
  };
}

async function main(): Promise<void> {
  const commonGitDir = execFileSync("git", ["rev-parse", "--git-common-dir"], { encoding: "utf8" }).trim();
  const mainRepository = dirname(resolve(commonGitDir));
  loadEnv({ path: resolve(mainRepository, "sourcepilot/.env.secrets.local"), quiet: true });
  const artifact = JSON.parse(await readFile(resolve(import.meta.dirname, "../sourcepilot/contracts/out/MandateRegistry.sol/MandateRegistry.json"), "utf8")) as Artifact;
  const evidence = await runMonadDeployment({
    chainId: requireValue("CHAIN_ID", process.env.CHAIN_ID),
    rpcUrl: requireValue("CHAIN_RPC_URL", process.env.CHAIN_RPC_URL),
    principalAddress: requireValue("PRINCIPAL_ADDRESS", process.env.PRINCIPAL_ADDRESS) as Address,
    agentAddress: requireValue("AGENT_ADDRESS", process.env.AGENT_ADDRESS) as Address,
    principalPrivateKey: requireValue("PRINCIPAL_PRIVATE_KEY", process.env.PRINCIPAL_PRIVATE_KEY) as Hex,
    agentPrivateKey: requireValue("AGENT_PRIVATE_KEY", process.env.AGENT_PRIVATE_KEY) as Hex,
    artifact,
    explorerBaseUrl: "https://testnet.monadvision.com",
  });
  const outputPath = resolve(import.meta.dirname, "../output/monad/deployment.json");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({ registryAddress: evidence.registryAddress, deploymentTx: evidence.deploymentTx, deploymentBlock: evidence.deploymentBlock, mandateHash: evidence.mandateHash, createTx: evidence.createTx, recordTx: evidence.recordTx, recordBlock: evidence.recordBlock, revokeTx: evidence.revokeTx }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
