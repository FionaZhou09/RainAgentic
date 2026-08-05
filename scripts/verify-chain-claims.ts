import { readdir, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, defineChain, http, keccak256, toHex, type Hex } from "viem";
import { APPROVAL_ONCHAIN_VERIFY } from "../sourcepilot/lib/chain/registry";
import { createViemRegistryClient } from "../sourcepilot/lib/chain/registry";
import { DEMO_COPY, ENFORCEMENT_CLAIM } from "../sourcepilot/lib/contracts/copy";
import { POST as mandatePost } from "../sourcepilot/app/api/mandate/route";
import { POST as payPost } from "../sourcepilot/app/api/pay/route";
import { createEventStore } from "../sourcepilot/lib/events";
import { ASSUMPTIONS, MANDATE_FIXTURE, PAYEE_REFS, PR_1042, QUOTE_B, SUPPLIERS } from "../sourcepilot/lib/fixtures/pr-1042";
import { computePayeeScope, mandateDomain, MANDATE_TYPES, type ProcurementMandate } from "../sourcepilot/lib/mandate";
import { serializeMandate } from "../sourcepilot/lib/mandate/serialize";
import { MockRainAdapterImpl } from "../sourcepilot/lib/rain/mock";
import { newAttemptKey } from "../sourcepilot/lib/rain/port";
import { assessQuotes } from "../sourcepilot/lib/score";
import { startAnvil } from "./start-anvil";

export type ClaimSource = { path: string; content: string };
export type ClaimInput = {
  chainId: number; registryAddress: string; sources: ClaimSource[];
  approvalOnchainVerify?: boolean; shippedEnforcementClaim?: string;
  runtimeResponses?: Array<{ route: "/api/mandate" | "/api/pay"; body: unknown }>;
};

const HASH = /0x[0-9a-fA-F]{64}/;
const execFileAsync = promisify(execFile);
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const BANNED = [
  /replay the same request/i,
  /enforces the 30%/i,
  /enforces the thirty percent/i,
  /expires at the end of the month/i,
  /expires in sixty days/i,
  /over budget[^\n]{0,80}(?:eliminat|reject|fail|not ranked)/i,
];

function evidencePath(path: string): boolean { return /(?:^|\/)(?:output|evidence)(?:\/|$)|evidence\.json$/i.test(path); }
function presentationPath(path: string): boolean { return evidencePath(path) || /scripts\/harness-output$|sourcepilot\/(?:app|components)\//i.test(path); }
function stripComments(content: string): string { return content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""); }
function fail(path: string, message: string): never { throw new Error(`${path}: ${message}`); }

export function verifyChainClaims(input: ClaimInput): void {
  const expected = (input.approvalOnchainVerify ?? APPROVAL_ONCHAIN_VERIFY)
    ? ENFORCEMENT_CLAIM.approvalVerified : ENFORCEMENT_CLAIM.callerAsserted;
  if ((input.shippedEnforcementClaim ?? DEMO_COPY.enforcementClaim) !== expected) fail("DEMO_COPY", "enforcement claim does not match APPROVAL_ONCHAIN_VERIFY");
  if (input.chainId !== 31337 && input.chainId !== 10143) fail("CHAIN_ID", `unsupported chain ${input.chainId}`);

  for (const response of input.runtimeResponses ?? []) {
    const keys = collectKeys(response.body);
    if (keys.has("monadTxHash") || keys.has("monadTransaction")) {
      fail(`runtime ${response.route}`, `Monad-specific runtime identifier is forbidden on configured chain ${input.chainId}`);
    }
  }

  for (const source of input.sources) {
    let content = stripComments(source.content);
    // This implementation literal is configuration, not presented evidence.
    if (source.path.endsWith("lib/chain/registry.ts")) content = content.replace(/https:\/\/testnet\.monadvision\.com\/tx\/[^`"'\s]*/g, "");
    for (const pattern of BANNED) if (pattern.test(content)) fail(source.path, `banned governed claim ${pattern}`);

    if (input.chainId === 31337) {
      if (presentationPath(source.path) && /monad(?:TxHash|Transaction)[^\n]*0x[0-9a-fA-F]{64}/i.test(content)) {
        fail(source.path, "Monad-specific transaction identifier cannot present Local Anvil evidence");
      }
      if (/deployed on Monad/i.test(content)) fail(source.path, "Local Anvil output claims deployment on Monad");
      if (/Monad transaction/i.test(content)) fail(source.path, "Local Anvil output claims a Monad transaction");
      if (/testnet\.monadvision\.com\/tx\//i.test(content)) fail(source.path, "Local Anvil output contains a Monad explorer transaction link");
      if (/Monad\s+(?:tx|hash)[^\n]*0x[0-9a-fA-F]{64}/i.test(content)) fail(source.path, "local hash is presented as Monad evidence");
      let metadataLabelsLocal = false;
      try { metadataLabelsLocal = JSON.parse(source.content).environment === "Local Anvil"; } catch { /* source text */ }
      for (const line of content.split("\n")) {
        if (/(?:transaction|\btx\b|hash)[^\n]*0x[0-9a-fA-F]{64}/i.test(line)
          && !/Local Anvil/i.test(line) && !metadataLabelsLocal) {
          fail(source.path, "unlabeled transaction/hash presentation requires Local Anvil environment metadata under chain 31337");
        }
      }
    } else if (evidencePath(source.path)) {
      if (/Local Anvil|\bAnvil\b/i.test(content)) fail(source.path, "final Monad evidence contains a local/Anvil label");
    }

    if (evidencePath(source.path)) {
      let metadata: Record<string, unknown>;
      try { metadata = JSON.parse(source.content); } catch { fail(source.path, "evidence with a transaction hash requires JSON environment metadata"); }
      if (HASH.test(content) && (typeof metadata.environment !== "string" || !metadata.environment)) fail(source.path, "final evidence requires explicit environment metadata");
      if (input.chainId === 31337 && metadata.environment !== "Local Anvil") fail(source.path, "31337 evidence must be labeled Local Anvil");
      if (input.chainId === 10143) {
        if (metadata.environment !== "Monad Testnet") fail(source.path, "10143 evidence must be labeled Monad Testnet");
        if (String(metadata.registryAddress).toLowerCase() !== input.registryAddress.toLowerCase()) fail(source.path, "evidence registry address does not match MANDATE_REGISTRY_ADDRESS");
      }
    }
  }
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const item of value) collectKeys(item, keys);
  else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) { keys.add(key); collectKeys(item, keys); }
  return keys;
}

export async function verifyRuntimeRoutes(options: {
  mutate?: (route: string, body: Record<string, unknown>) => Record<string, unknown>;
} = {}): Promise<Array<{ route: "/api/mandate" | "/api/pay"; body: Record<string, unknown> }>> {
  const anvil = await startAnvil();
  try {
    const contractsDirectory = resolve(ROOT, "sourcepilot/contracts");
    await execFileAsync("/Users/yingzhou/.foundry/bin/forge", ["build"], { cwd: contractsDirectory });
    const artifact = JSON.parse(await readFile(resolve(contractsDirectory, "out/MandateRegistry.sol/MandateRegistry.json"), "utf8")) as {
      abi: readonly unknown[]; bytecode: { object: Hex };
    };
    const chain = defineChain({ id: 31337, name: "Local Anvil", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [anvil.rpcUrl] } } });
    const transport = http(anvil.rpcUrl);
    const publicClient = createPublicClient({ chain, transport });
    const unlocked = createWalletClient({ chain, transport });
    const [principal, agent] = await unlocked.getAddresses();
    const deployment = await publicClient.waitForTransactionReceipt({ hash: await unlocked.deployContract({
      account: principal, chain, abi: artifact.abi, bytecode: artifact.bytecode.object,
    }) });
    if (!deployment.contractAddress) throw new Error("Runtime route verification deployment returned no address");
    const environment = { chainId: 31337 as const, rpcUrl: anvil.rpcUrl, registryAddress: deployment.contractAddress, label: "Local Anvil" as const };
    const registry = createViemRegistryClient({ environment, publicClient,
      walletClient: createWalletClient({ account: agent, chain, transport }) });
    const scope = computePayeeScope(PAYEE_REFS);
    const now = Math.floor(Date.now() / 1000);
    const mandate: ProcurementMandate = { principal, agent, purchaseRequestId: PR_1042.idHash,
      fundingSource: keccak256(toHex("verify claims runtime funding")), maxTotal: MANDATE_FIXTURE.maxTotalMinor,
      autonomousMax: MANDATE_FIXTURE.autonomousMaxMinor, maxDepositBps: MANDATE_FIXTURE.maxDepositBps,
      payeeScope: scope.scope, purpose: "Verify actual route serialization", validAfter: BigInt(now - 60),
      validUntil: BigInt(now + 3600), nonce: keccak256(toHex("verify actual runtime routes")) };
    const domain = { chainId: 31337 as const, verifyingContract: environment.registryAddress };
    const signature = await unlocked.signTypedData({ account: principal, domain: mandateDomain(domain),
      types: MANDATE_TYPES, primaryType: "ProcurementMandate", message: mandate });

    const mandateResponse = await mandatePost.withDependencies({ registry, environment, events: createEventStore() })(
      new Request("http://local/api/mandate", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ mandate: serializeMandate(mandate), signature, payeeRefs: PAYEE_REFS }) }),
    );
    if (!mandateResponse.ok) throw new Error(`Actual /api/mandate verification failed with ${mandateResponse.status}`);
    const mandateBody = await mandateResponse.json() as Record<string, unknown>;
    const mandateHash = mandateBody.mandateHash as Hex;
    const assessment = assessQuotes(PR_1042, [QUOTE_B], SUPPLIERS, ASSUMPTIONS)[0];
    const payResponse = await payPost.withDependencies({ purchaseRequest: PR_1042, quote: QUOTE_B, supplier: SUPPLIERS[1],
      assessment, mandate, mandateHash, payeeSet: scope.leaves, caller: agent, mandateDomain: domain, registry,
      rain: new MockRainAdapterImpl({ statusDelaysMs: [0, 0, 0] }), events: createEventStore(), attemptCache: new Map() })(
      new Request("http://local/api/pay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        purchaseRequestId: PR_1042.id, supplierId: QUOTE_B.supplierId, payeeRef: SUPPLIERS[1].payeeRef,
        amountMinor: 18_000, stage: "sample", idempotencyKey: newAttemptKey(),
      }) }),
    );
    if (!payResponse.ok) throw new Error(`Actual /api/pay verification failed with ${payResponse.status}`);
    const actual = [
      { route: "/api/mandate" as const, body: mandateBody },
      { route: "/api/pay" as const, body: await payResponse.json() as Record<string, unknown> },
    ].map(({ route, body }) => ({ route, body: options.mutate?.(route, body) ?? body }));
    verifyChainClaims({ chainId: 31337, registryAddress: environment.registryAddress, sources: [], runtimeResponses: actual });
    for (const { route, body } of actual) {
      if (typeof body.transactionHash !== "string") fail(`runtime ${route}`, "canonical transactionHash is required");
    }
    return actual;
  } finally {
    await anvil.stop();
  }
}

async function collect(directory: string): Promise<ClaimSource[]> {
  const output: ClaimSource[] = [];
  try {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) output.push(...await collect(path));
      else if (!entry.name.includes(".test.") && [".ts", ".tsx", ".js", ".jsx", ".json"].includes(extname(entry.name))) output.push({ path, content: await readFile(path, "utf8") });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return output;
}

async function main() {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const chainId = Number(process.env.CHAIN_ID ?? "31337");
  const registryAddress = process.env.MANDATE_REGISTRY_ADDRESS ?? (chainId === 31337 ? "0x0000000000000000000000000000000000000000" : "");
  if (!registryAddress) throw new Error("Missing required environment variable: MANDATE_REGISTRY_ADDRESS");
  const sources = (await Promise.all([
    collect(resolve(root, "sourcepilot/app")), collect(resolve(root, "sourcepilot/components")), collect(resolve(root, "sourcepilot/lib")),
    collect(resolve(root, "output")),
  ])).flat();
  if (chainId === 31337) {
    const runtimeResponses = await verifyRuntimeRoutes();
    const { runDemo } = await import("./harness");
    const harnessOutput = await runDemo();
    sources.push({ path: "scripts/harness-output", content: JSON.stringify(harnessOutput, (_, value) => typeof value === "bigint" ? value.toString() : value) });
    verifyChainClaims({ chainId, registryAddress, sources, runtimeResponses });
  } else {
    verifyChainClaims({ chainId, registryAddress, sources });
  }
  console.log(`Chain claims verified for ${chainId === 31337 ? "Local Anvil" : "Monad Testnet"} across ${sources.length} source/evidence records.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
