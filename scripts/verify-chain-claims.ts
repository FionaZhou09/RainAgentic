import { readdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { APPROVAL_ONCHAIN_VERIFY } from "../sourcepilot/lib/chain/registry";
import { DEMO_COPY, ENFORCEMENT_CLAIM } from "../sourcepilot/lib/contracts/copy";

export type ClaimSource = { path: string; content: string };
export type ClaimInput = {
  chainId: number; registryAddress: string; sources: ClaimSource[];
  approvalOnchainVerify?: boolean; shippedEnforcementClaim?: string;
};

const HASH = /0x[0-9a-fA-F]{64}/;
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
    const { runDemo } = await import("./harness");
    sources.push({ path: "scripts/harness-output", content: JSON.stringify(await runDemo(), (_, value) => typeof value === "bigint" ? value.toString() : value) });
  }
  verifyChainClaims({ chainId, registryAddress, sources });
  console.log(`Chain claims verified for ${chainId === 31337 ? "Local Anvil" : "Monad Testnet"} across ${sources.length} source/evidence records.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
