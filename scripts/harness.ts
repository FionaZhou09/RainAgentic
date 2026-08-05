import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createPublicClient, createWalletClient, defineChain, http, keccak256, parseAbi, toHex, type Address, type Hex } from "viem";
import { startAnvil } from "./start-anvil";
import { signApprovalWithWallet, signMandateWithWallet } from "./sign-mandate";
import { createViemRegistryClient, STAGE, type RegistryClient } from "../sourcepilot/lib/chain/registry";
import { evaluatePayment, type PayContext, type PayResponse } from "../sourcepilot/lib/contracts/api";
import { DEMO_COPY } from "../sourcepilot/lib/contracts/copy";
import { createEventStore } from "../sourcepilot/lib/events";
import { ASSUMPTIONS, FRAUD_PAYEE_REF, MANDATE_FIXTURE, PAYEE_REFS, PR_1042, QUOTE_B, SUPPLIERS } from "../sourcepilot/lib/fixtures/pr-1042";
import { computePayeeScope, type PaymentApproval, type ProcurementMandate } from "../sourcepilot/lib/mandate";
import { MockRainAdapterImpl } from "../sourcepilot/lib/rain/mock";
import { newAttemptKey, type AttemptKey } from "../sourcepilot/lib/rain/port";
import { assessQuotes } from "../sourcepilot/lib/score";

const execFileAsync = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REVOKE_ABI = parseAbi(["function revoke(bytes32 mandateHash)"]);

export type HarnessRecord = {
  environment: "Local Anvil"; chainId: 31337; outcome: PayResponse["outcome"];
  amountMinor: number; attemptKey: AttemptKey; approvalNonce?: Hex; reason?: string;
  remainingMinor?: string; rainCalls: number; copy: string; mandateHash: Hex;
};
export type HarnessBeat = { beat: "autonomous_sample" | "escalation" | "changed_payee"; records: HarnessRecord[] };
export type LockedArc = HarnessBeat[] & { spentMinor: bigint; registryAddress: Address; mandateHash: Hex };
export type HarnessPayResponse = PayResponse & { environment: "Local Anvil"; chainId: 31337; mandateHash: Hex; rainCalls: number };

export interface DemoHarness {
  readonly rpcUrl: string; readonly registryAddress: Address; readonly stopped: boolean;
  runLockedArc(): Promise<LockedArc>;
  fireSample(n: 2 | 3): Promise<HarnessRecord>;
  runRevocationCloser(): Promise<HarnessPayResponse>;
  assertZeroRainCalls(): void;
  printRevokeCommand(): string;
  stop(): Promise<void>;
}

type Track = { context: PayContext; rain: MockRainAdapterImpl; registry: RegistryClient; mandateHash: Hex };

function record(track: Track, response: PayResponse, amountMinor: number, key: AttemptKey, rainBefore: number, approvalNonce?: Hex): HarnessRecord {
  const recordedNonce = response.outcome === "pending_approval" ? response.approvalPayload.nonce : approvalNonce;
  return { environment: "Local Anvil", chainId: 31337, outcome: response.outcome, amountMinor, attemptKey: key,
    approvalNonce: recordedNonce, reason: response.outcome === "blocked" ? response.reason : undefined,
    remainingMinor: "remainingMinor" in response ? response.remainingMinor : undefined,
    rainCalls: track.rain.calls.length - rainBefore, copy: DEMO_COPY.enforcementClaim, mandateHash: track.mandateHash };
}

export async function createDemoHarness(): Promise<DemoHarness> {
  const anvil = await startAnvil();
  let stopped = false;
  try {
    await execFileAsync("/Users/yingzhou/.foundry/bin/forge", ["build"], { cwd: resolve(ROOT, "sourcepilot/contracts") });
    const artifact = JSON.parse(await readFile(resolve(ROOT, "sourcepilot/contracts/out/MandateRegistry.sol/MandateRegistry.json"), "utf8"));
    const chain = defineChain({ id: 31337, name: "Local Anvil", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [anvil.rpcUrl] } } });
    const transport = http(anvil.rpcUrl);
    const publicClient = createPublicClient({ chain, transport });
    const unlocked = await publicClient.request({ method: "eth_accounts" }) as Address[];
    const [principal, agent] = unlocked;
    const deployerWallet = createWalletClient({ account: principal, chain, transport });
    const principalWallet = deployerWallet;
    const agentWallet = createWalletClient({ account: agent, chain, transport });
    const deploymentHash = await deployerWallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object as Hex });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: deploymentHash });
    if (!receipt.contractAddress) throw new Error("MandateRegistry deployment returned no address");
    const registryAddress = receipt.contractAddress;
    const environment = { chainId: 31337 as const, rpcUrl: anvil.rpcUrl, registryAddress, label: "Local Anvil" as const };
    const registry = createViemRegistryClient({ environment, publicClient, walletClient: agentWallet });
    const domain = { chainId: 31337 as const, verifyingContract: registryAddress };
    const scope = computePayeeScope(PAYEE_REFS);
    const assessment = assessQuotes(PR_1042, [QUOTE_B], SUPPLIERS, ASSUMPTIONS)[0];

    async function makeTrack(label: string): Promise<Track> {
      const now = Math.floor(Date.now() / 1000);
      const mandate: ProcurementMandate = { principal, agent, purchaseRequestId: PR_1042.idHash, fundingSource: keccak256(toHex("test funding")),
        maxTotal: MANDATE_FIXTURE.maxTotalMinor, autonomousMax: MANDATE_FIXTURE.autonomousMaxMinor, maxDepositBps: MANDATE_FIXTURE.maxDepositBps,
        payeeScope: scope.scope, purpose: "Purchase PR-1042 supplier payments", validAfter: BigInt(now - 60), validUntil: BigInt(now + 90 * 86400), nonce: keccak256(toHex(label)) };
      const signature = await signMandateWithWallet(principalWallet, principal, mandate, domain);
      const created = await registry.create(mandate, signature);
      const rain = new MockRainAdapterImpl({ statusDelaysMs: [0, 0, 0] });
      return { registry, rain, mandateHash: created.mandateHash, context: { purchaseRequest: PR_1042, quote: QUOTE_B,
        supplier: SUPPLIERS[1], assessment, mandate, mandateHash: created.mandateHash, payeeSet: scope.leaves, caller: agent,
        mandateDomain: domain, registry, rain, events: createEventStore(), attemptCache: new Map() } };
    }

    const locked = await makeTrack("purchase flow");
    const blockedRecords: HarnessRecord[] = [];
    let arc: LockedArc | undefined;
    let d3Step = 1;
    let revoked = false;

    async function pay(track: Track, amountMinor: number, stage: "sample" | "deposit", overrides: Partial<Parameters<typeof evaluatePayment>[0]> = {}) {
      const idempotencyKey = overrides.idempotencyKey ?? newAttemptKey();
      const before = track.rain.calls.length;
      const response = await evaluatePayment({ purchaseRequestId: PR_1042.id, supplierId: "SUP-B", payeeRef: SUPPLIERS[1].payeeRef,
        amountMinor, stage, idempotencyKey, ...overrides }, track.context);
      return { response, output: record(track, response, amountMinor, idempotencyKey, before, overrides.approvalNonce), key: idempotencyKey };
    }

    async function approve(track: Track, amountMinor: number) {
      const pending = await pay(track, amountMinor, "deposit");
      if (pending.response.outcome !== "pending_approval") throw new Error("Expected pending approval");
      const payload = pending.response.approvalPayload;
      const approval: PaymentApproval = { ...payload, amount: BigInt(payload.amount), poValue: BigInt(payload.poValue) };
      const approvalSig = await signApprovalWithWallet(principalWallet, principal, approval, domain);
      const approved = await pay(track, amountMinor, "deposit", { approvalSig, approvalNonce: approval.nonce, idempotencyKey: newAttemptKey() });
      return { pending: pending.output, approved: approved.output };
    }

    return {
      rpcUrl: anvil.rpcUrl, registryAddress,
      get stopped() { return stopped; },
      async runLockedArc() {
        if (arc) return arc;
        const sample = await pay(locked, 18_000, "sample");
        const escalation = await approve(locked, 147_900);
        const fraud = await pay(locked, 18_000, "sample", { payeeRef: FRAUD_PAYEE_REF });
        blockedRecords.push(fraud.output);
        const beats: HarnessBeat[] = [
          { beat: "autonomous_sample", records: [sample.output] },
          { beat: "escalation", records: [escalation.pending, escalation.approved] },
          { beat: "changed_payee", records: [fraud.output] },
        ];
        arc = Object.assign(beats, { spentMinor: 165_900n, registryAddress, mandateHash: locked.mandateHash });
        return arc;
      },
      async fireSample(n) {
        if (!arc) throw new Error("Run the locked arc before D3 samples");
        if (n !== d3Step + 1) throw new Error(`Expected fireSample(${d3Step + 1}) before fireSample(${n})`);
        if (revoked) throw new Error("Mandate already revoked");
        const result = await pay(locked, 18_000, "sample");
        if (n === 3) blockedRecords.push(result.output);
        d3Step = n;
        return result.output;
      },
      async runRevocationCloser() {
        if (d3Step !== 3) throw new Error("Run revocation closer only after D3 ceiling proof");
        if (revoked) throw new Error("Revocation closer already ran");
        const txHash = await principalWallet.writeContract({ address: registryAddress, abi: REVOKE_ABI, functionName: "revoke", args: [locked.mandateHash] });
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        revoked = true;
        const result = await pay(locked, 18_000, "sample", { materializeRevert: true });
        blockedRecords.push(result.output);
        return Object.assign(result.response, { environment: "Local Anvil" as const, chainId: 31337 as const,
          mandateHash: locked.mandateHash, rainCalls: result.output.rainCalls });
      },
      assertZeroRainCalls() {
        if (blockedRecords.length < 2 || blockedRecords.some((item) => item.rainCalls !== 0)) throw new Error("A blocked beat called Rain");
      },
      printRevokeCommand() { return locked.registry.revokeCommand(locked.mandateHash); },
      async stop() { if (!stopped) { stopped = true; await anvil.stop(); } },
    };
  } catch (error) {
    await anvil.stop();
    throw error;
  }
}

export async function runDemo() {
  const harness = await createDemoHarness();
  try {
    const arc = await harness.runLockedArc();
    const second = await harness.fireSample(2);
    const third = await harness.fireSample(3);
    const revocation = await harness.runRevocationCloser();
    harness.assertZeroRainCalls();
    const evidence = { environment: "Local Anvil" as const, chainId: 31337 as const, copy: DEMO_COPY,
      mandateHash: arc.mandateHash, spentMinor: arc.spentMinor, arc, second, third, revocation,
      revokeCommand: harness.printRevokeCommand() };
    return sanitizePresentation(evidence, 31337);
  } finally { await harness.stop(); }
}

function sanitizePresentation(value: unknown, chainId: 31337 | 10143): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizePresentation(item, chainId));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    chainId === 31337 && key === "monadTxHash" ? "localTxHash" : key,
    sanitizePresentation(item, chainId),
  ]));
}

async function main() { console.log(JSON.stringify(await runDemo(), (_, value) => typeof value === "bigint" ? value.toString() : value, 2)); }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
