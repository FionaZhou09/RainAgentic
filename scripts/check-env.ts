#!/usr/bin/env tsx
/**
 * WP0 environment gate. Every check must pass before downstream packages
 * (WP3, WP5, WP8, WP9c) are allowed to assume the environment works.
 * Exits 0 iff everything below is true; exits 1 and prints exactly what
 * failed otherwise. No polling — each RPC call runs once.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { createPublicClient, http, formatEther, type Address } from "viem";

// Deliberately .env.secrets.local, not .env.local — see that file's header comment
// for why (Claude Code's file-watcher diffs out-of-band edits to any path previously
// touched by the Write/Edit tools, which leaked two prior unfunded keypairs).
loadEnv({ path: resolve(import.meta.dirname, "../sourcepilot/.env.secrets.local") });

const EXPECTED_CHAIN_ID = 10143;

const monadTestnet = {
  id: EXPECTED_CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [requireEnv("MONAD_TESTNET_RPC_URL")] } },
} as const;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

type CheckResult = { name: string; ok: boolean; detail: string };
const results: CheckResult[] = [];

async function check(name: string, fn: () => Promise<string> | string) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
  } catch (err) {
    results.push({ name, ok: false, detail: err instanceof Error ? err.message : String(err) });
  }
}

async function main() {
  const primaryUrl = requireEnv("MONAD_TESTNET_RPC_URL");
  const backupUrls = [
    requireEnv("MONAD_TESTNET_RPC_URL_BACKUP1"),
    requireEnv("MONAD_TESTNET_RPC_URL_BACKUP2"),
  ];

  const primaryClient = createPublicClient({ chain: monadTestnet, transport: http(primaryUrl) });

  await check("chainId === 10143 (primary RPC)", async () => {
    const chainId = await primaryClient.getChainId();
    if (chainId !== EXPECTED_CHAIN_ID) {
      throw new Error(`got chainId ${chainId}, expected ${EXPECTED_CHAIN_ID}`);
    }
    return `chainId ${chainId}`;
  });

  await check("primary RPC reads a block", async () => {
    const block = await primaryClient.getBlock();
    return `block #${block.number} @ ${primaryUrl}`;
  });

  for (const [i, url] of backupUrls.entries()) {
    await check(`backup RPC ${i + 1} responds`, async () => {
      const client = createPublicClient({ chain: monadTestnet, transport: http(url) });
      const block = await client.getBlock();
      return `block #${block.number} @ ${url}`;
    });
  }

  const addressVars: [string, string][] = [
    ["PRINCIPAL_ADDRESS", "principal (revoke key)"],
    ["AGENT_ADDRESS", "agent"],
    ["SUPPLIER_A_ADDRESS", "supplier A"],
    ["SUPPLIER_B_ADDRESS", "supplier B"],
  ];

  for (const [envVar, label] of addressVars) {
    await check(`${label} funded with MON`, async () => {
      const address = requireEnv(envVar) as Address;
      const balance = await primaryClient.getBalance({ address });
      if (balance <= 0n) {
        throw new Error(`${address} has 0 MON — fund at faucet.monad.xyz (2h cooldown per token)`);
      }
      return `${address} has ${formatEther(balance)} MON`;
    });
  }

  await check("cloudflared present", () => {
    const out = execSync("cloudflared --version", { encoding: "utf8" }).trim();
    return out;
  });

  const width = Math.max(...results.map((r) => r.name.length));
  let allOk = true;
  for (const r of results) {
    const status = r.ok ? "PASS" : "FAIL";
    if (!r.ok) allOk = false;
    console.log(`[${status}] ${r.name.padEnd(width)}  ${r.detail}`);
  }

  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error("check-env.ts crashed:", err);
  process.exit(1);
});
