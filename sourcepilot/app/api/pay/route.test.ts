import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPublicClient, createWalletClient, defineChain, http, keccak256, parseAbi, toHex, type Address, type Chain, type Hex, type PublicClient, type WalletClient } from "viem";
import { startAnvil, type RunningAnvil } from "../../../../scripts/start-anvil";
import { createViemRegistryClient } from "@/lib/chain/registry";
import { computePayeeScope, hashPayeeRef } from "@/lib/mandate/payee";
import { APPROVAL_TYPES, MANDATE_TYPES, mandateDomain, type PaymentApproval, type ProcurementMandate } from "@/lib/mandate";
import { createEventStore } from "@/lib/events";
import { MockRainAdapterImpl } from "@/lib/rain/mock";
import { newAttemptKey } from "@/lib/rain/port";
import { evaluatePayment, type PayContext, type PayRequest } from "@/lib/contracts/api";
import { POST } from "./route";

type Artifact = { abi: readonly unknown[]; bytecode: { object: Hex } };
const contractsDirectory = resolve(process.cwd(), "contracts");
const artifactPath = resolve(contractsDirectory, "out/MandateRegistry.sol/MandateRegistry.json");

describe("evaluatePayment with the real Anvil registry", () => {
  let anvil: RunningAnvil;
  let chain: Chain;
  let principal: Address;
  let agent: Address;
  let publicClient: PublicClient;
  let unlockedWallet: WalletClient;
  let ctx: PayContext;

  beforeAll(async () => {
    execFileSync("/Users/yingzhou/.foundry/bin/forge", ["build"], { cwd: contractsDirectory, stdio: "ignore" });
    anvil = await startAnvil();
    chain = defineChain({ id: 31337, name: "Local Anvil", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [anvil.rpcUrl] } } });
    publicClient = createPublicClient({ chain, transport: http(anvil.rpcUrl) });
    unlockedWallet = createWalletClient({ chain, transport: http(anvil.rpcUrl) });
    [principal, agent] = await unlockedWallet.getAddresses();
  }, 30_000);

  afterAll(async () => anvil?.stop());

  beforeEach(async () => {
    const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as Artifact;
    const deployHash = await unlockedWallet.deployContract({ account: principal, chain, abi: artifact.abi, bytecode: artifact.bytecode.object });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
    const registryAddress = receipt.contractAddress!;
    const scope = computePayeeScope(["rain:payee:allowed", "rain:payee:second"]);
    const now = BigInt(Math.floor(Date.now() / 1000));
    const mandate: ProcurementMandate = {
      principal, agent, purchaseRequestId: keccak256(toHex("PR-1042")), fundingSource: keccak256(toHex("funding")),
      maxTotal: 184_000n, autonomousMax: 20_000n, maxDepositBps: 3_000n, payeeScope: scope.scope,
      purpose: "SP-04", validAfter: now - 60n, validUntil: now + 3600n, nonce: keccak256(toHex(crypto.randomUUID())),
    };
    const domain = { chainId: 31337, verifyingContract: registryAddress } as const;
    const signature = await unlockedWallet.signTypedData({ account: principal, domain: mandateDomain(domain), types: MANDATE_TYPES, primaryType: "ProcurementMandate", message: mandate });
    const registry = createViemRegistryClient({ environment: { ...domain, rpcUrl: anvil.rpcUrl, registryAddress, label: "Local Anvil" }, publicClient, walletClient: createWalletClient({ account: agent, chain, transport: http(anvil.rpcUrl) }) });
    const created = await registry.create(mandate, signature);
    ctx = {
      purchaseRequest: { id: "PR-1042", idHash: mandate.purchaseRequestId, product: "shirts", quantity: 600, landedPerUnitReference: 1200 as never, maxLeadTimeDays: 60, minSpecMatchPct: 90, maxDepositBps: 3000 as never, destination: "US" },
      quote: { id: "Q-B", supplierId: "SUP-B", purchaseRequestId: "PR-1042", currency: "USD", unitPrice: 800 as never, quantity: 600, samplingFee: 3000 as never, shipping: 10000 as never, leadTimeDays: 45, depositBps: 3000 as never, specMatchPct: 95 },
      supplier: { id: "SUP-B", name: "B", country: "CN", payeeRef: "rain:payee:allowed", verificationStatus: "unverified" },
      assessment: { quoteId: "Q-B", supplierId: "SUP-B", completenessPct: 100, cost: { kind: "complete", breakdown: { productSubtotal: 480000 as never, samplingFee: 3000 as never, shipping: 10000 as never, poValue: 493000 as never, dutyEstimate: 0 as never, paymentFee: 0 as never, landedTotal: 493000 as never, landedPerUnitMilliCents: 0, depositDue: 147900 as never } }, hardFailures: [], advisories: [], score: 1, rank: 1 },
      mandate, mandateHash: created.mandateHash, payeeSet: scope.leaves, caller: agent, mandateDomain: domain,
      registry, rain: new MockRainAdapterImpl({ statusDelaysMs: [0, 0, 0] }), events: createEventStore(), attemptCache: new Map(),
      newPaymentId: () => "pay_test", newApprovalNonce: () => keccak256(toHex(crypto.randomUUID())),
    };
  });

  const request = (overrides: Partial<PayRequest> = {}): PayRequest => ({ purchaseRequestId: "PR-1042", supplierId: "SUP-B", payeeRef: "rain:payee:allowed", amountMinor: 18_000, stage: "sample", idempotencyKey: newAttemptKey(), ...overrides });

  async function signedApproval(amountMinor = 147_900) {
    const pending = await evaluatePayment(request({ amountMinor, stage: "deposit" }), ctx);
    if (pending.outcome !== "pending_approval") throw new Error("expected pending");
    const approval: PaymentApproval = { ...pending.approvalPayload, amount: BigInt(pending.approvalPayload.amount), poValue: BigInt(pending.approvalPayload.poValue) };
    const approvalSig = await unlockedWallet.signTypedData({ account: principal, domain: mandateDomain(ctx.mandateDomain), types: APPROVAL_TYPES, primaryType: "PaymentApproval", message: approval });
    return { approval, approvalSig };
  }

  it("executes autonomous simulate -> record -> Rain and decrements the ceiling", async () => {
    const result = await evaluatePayment(request(), ctx);
    expect(result).toMatchObject({ outcome: "autonomous", remainingMinor: "166000" });
    expect(await ctx.registry.remaining(ctx.mandateHash)).toBe(166_000n);
    expect(ctx.rain).toMatchObject({ calls: [expect.objectContaining({ method: "createPaymentInstruction" })] });
  });

  it("returns and caches a complete pending approval with zero chain and Rain calls", async () => {
    const req = request({ amountMinor: 147_900, stage: "deposit" });
    const before = await ctx.registry.remaining(ctx.mandateHash);
    const first = await evaluatePayment(req, ctx);
    const second = await evaluatePayment(req, ctx);
    expect(first).toBe(second);
    expect(first).toMatchObject({ outcome: "pending_approval", chainCalled: false, rainCalled: false, approvalPayload: { mandateHash: ctx.mandateHash, payeeHash: hashPayeeRef(req.payeeRef), amount: "147900", poValue: "493000", stage: 1, nonce: expect.stringMatching(/^0x[0-9a-f]{64}$/) } });
    expect(await ctx.registry.remaining(ctx.mandateHash)).toBe(before);
    expect((ctx.rain as MockRainAdapterImpl).calls).toHaveLength(0);
  });

  it("POST delegates to the exported evaluator", async () => {
    const response = await POST.withDependencies(ctx)(new Request("http://localhost/api/pay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request()) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ outcome: "autonomous", remainingMinor: "166000" });
  });

  it("generates a fresh pending nonce instead of accepting a caller-supplied one", async () => {
    const supplied = keccak256(toHex("caller nonce"));
    const first = await evaluatePayment(request({ amountMinor: 147_900, stage: "deposit", approvalNonce: supplied }), ctx);
    const second = await evaluatePayment(request({ amountMinor: 147_900, stage: "deposit", approvalNonce: supplied }), ctx);
    if (first.outcome !== "pending_approval" || second.outcome !== "pending_approval") throw new Error("expected pending");
    expect(first.approvalPayload.nonce).not.toBe(supplied);
    expect(second.approvalPayload.nonce).not.toBe(first.approvalPayload.nonce);
  });

  it("completes approval under a new AttemptKey and forwards the exact nonce", async () => {
    const { approval, approvalSig } = await signedApproval();
    const result = await evaluatePayment(request({ amountMinor: 147_900, stage: "deposit", approvalSig, approvalNonce: approval.nonce }), ctx);
    expect(result).toMatchObject({ outcome: "approved", approver: principal, remainingMinor: "36100" });
  });

  it("lets replay protection reach Solidity as BadApproval", async () => {
    const { approval, approvalSig } = await signedApproval(30_000);
    const approved = { amountMinor: 30_000, stage: "deposit" as const, approvalSig, approvalNonce: approval.nonce };
    expect(await evaluatePayment(request(approved), ctx)).toMatchObject({ outcome: "approved" });
    expect(await evaluatePayment(request(approved), ctx)).toMatchObject({ outcome: "blocked", layer: "onchain", reason: "BadApproval", rainCalled: false });
    expect((ctx.rain as MockRainAdapterImpl).calls).toHaveLength(1);
  });

  it.each(["nonce", "amount", "payee", "poValue", "stage", "mandate", "domain"] as const)("rejects an approval when %s changes", async (field) => {
    const { approval, approvalSig } = await signedApproval();
    const req = request({ amountMinor: 147_900, stage: "deposit", approvalSig, approvalNonce: approval.nonce });
    if (field === "nonce") req.approvalNonce = keccak256(toHex("wrong nonce"));
    if (field === "amount") req.amountMinor++;
    if (field === "payee") req.payeeRef = "rain:payee:second";
    if (field === "poValue" && ctx.assessment.cost.kind === "complete") ctx.assessment.cost.breakdown.poValue = 493_001 as never;
    if (field === "stage") req.stage = "balance";
    if (field === "mandate") ctx.mandateHash = keccak256(toHex("other mandate"));
    if (field === "domain") ctx.mandateDomain = { ...ctx.mandateDomain, verifyingContract: principal };
    const before = (ctx.rain as MockRainAdapterImpl).calls.length;
    expect(await evaluatePayment(req, ctx)).toMatchObject({ outcome: "blocked", layer: "offchain", reason: "BadApproval", rainCalled: false });
    expect((ctx.rain as MockRainAdapterImpl).calls).toHaveLength(before);
  });

  it("blocks missing nonce and altered approved fields before chain and Rain", async () => {
    const sig = `0x${"11".repeat(65)}` as Hex;
    const before = await ctx.registry.remaining(ctx.mandateHash);
    const result = await evaluatePayment(request({ amountMinor: 147_900, stage: "deposit", approvalSig: sig }), ctx);
    expect(result).toMatchObject({ outcome: "blocked", layer: "offchain", reason: "BadApproval", rainCalled: false });
    expect(await ctx.registry.remaining(ctx.mandateHash)).toBe(before);
    expect((ctx.rain as MockRainAdapterImpl).calls).toHaveLength(0);
  });

  it("lets changed payee reach Solidity and returns PayeeOutOfScope with zero Rain", async () => {
    const result = await evaluatePayment(request({ payeeRef: "rain:payee:fraud" }), ctx);
    expect(result).toMatchObject({ outcome: "blocked", layer: "onchain", reason: "PayeeOutOfScope", rainCalled: false });
    expect((ctx.rain as MockRainAdapterImpl).calls).toHaveLength(0);
  });

  it.each(["MISSING_REQUIRED_FIELD", "LEAD_TIME_OVER", "SPEC_MATCH_UNDER"] as const)("blocks permitted %s sourcing failure off-chain", async (code) => {
    ctx.assessment.hardFailures = [{ code, message: code, observed: "bad", limit: "good", ...(code === "MISSING_REQUIRED_FIELD" ? { field: "shipping" as const } : {}) }];
    const result = await evaluatePayment(request(), ctx);
    expect(result).toMatchObject({ outcome: "blocked", layer: "offchain", reason: code, rainCalled: false });
  });

  it("blocks caller mismatch off-chain", async () => {
    ctx.caller = principal;
    expect(await evaluatePayment(request(), ctx)).toMatchObject({ outcome: "blocked", layer: "offchain", reason: "NotAgent", rainCalled: false });
  });

  it("does not let deposit or price advisory become an off-chain gate", async () => {
    ctx.assessment.hardFailures = [{ code: "DEPOSIT_OVER_CAP", message: "advisory sourcing badge", observed: "100%", limit: "30%" }];
    ctx.assessment.advisories = [{ code: "LANDED_OVER_REFERENCE", message: "price", observed: "$13", limit: "$12" }];
    const result = await evaluatePayment(request(), ctx);
    expect(result.outcome).toBe("autonomous");
  });

  it("treats identical content under distinct AttemptKeys as distinct attempts", async () => {
    const first = await evaluatePayment(request(), ctx);
    const second = await evaluatePayment(request(), ctx);
    expect(first).not.toBe(second);
    expect(await ctx.registry.remaining(ctx.mandateHash)).toBe(148_000n);
  });

  it("lets revocation reach Solidity and never calls Rain", async () => {
    await unlockedWallet.writeContract({ account: principal, chain, address: ctx.mandateDomain.verifyingContract, abi: parseAbi(["function revoke(bytes32 mandateHash)"]), functionName: "revoke", args: [ctx.mandateHash] });
    const result = await evaluatePayment(request({ materializeRevert: true }), ctx);
    expect(result).toMatchObject({ outcome: "blocked", layer: "onchain", reason: "Revoked", rainCalled: false });
    expect((ctx.rain as MockRainAdapterImpl).calls).toHaveLength(0);
  });
});
