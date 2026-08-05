# Technical Prep Brief — Rain × Monad, Agentic Commerce

Written for a strong generalist engineer who is new to both payments and crypto. Everything here is doable before you walk in the door Saturday.

---

## Part 1 — Domain grounding (read this once, ~20 minutes)

### 1.1 How a card payment actually works

Five parties, and the vocabulary matters because Rain's engineers use it casually:

- **Cardholder** — the person (or, now, their agent)
- **Merchant** and its **acquirer** — the merchant's bank
- **Network** — Visa/Mastercard. Rain is a *Principal Member* of both, which is unusual and is why they can issue directly rather than renting someone else's BIN.
- **Issuer** — the bank whose license the card is issued under (for Rain's Visa cards: Third National). Rain is the *program manager* / processor.

The flow has two distinct phases people constantly conflate:

1. **Authorization** — merchant asks "is this $47 good?", issuer says yes/no in ~100ms. Funds are *held*, not moved. **This is where Rain's Agent Control Layer intercepts.**
2. **Clearing & settlement** — hours to days later, money actually moves. The final amount can differ from the auth (tips, hotel incidentals, fuel).

Terms you should be able to use correctly:

- **PAN** — the 16-digit number. Static, reusable, 60 years old. The villain of Pooja Shah's essay.
- **MCC** — Merchant Category Code, a 4-digit merchant classification. "Hotels only" means an MCC allowlist. Know that MCCs are *coarse and often wrong* — this is a real limitation worth acknowledging on stage.
- **Network tokenization** — replacing the PAN at point of use (Visa, 2014). An improvement *around* the credential, not *to* it.
- **3DS / 3-D Secure** — cryptographic cardholder authentication layered on e-commerce. Assumes a human to challenge, which is exactly the problem with agents.
- **Single-use / scoped virtual card** — a card minted for one purchase, with limits, then cancelled. Rain's current agentic answer.

**The one-sentence version of Rain's thesis:** the credential should carry consent, not just account identity — and today it can't, so the constraints have to live at issuance time instead.

### 1.2 Stablecoins, only what you need

A stablecoin is a token redeemable ~1:1 for a fiat currency. USDC (Circle) is the relevant one. Key mechanics:

- **6 decimals.** $1.00 = `1000000`. Off-by-1000x bugs are the single most common hackathon error in this space.
- **ERC-20** is the token interface. **ERC-3009** (`transferWithAuthorization`) is what makes x402 work: you *sign* a transfer authorization off-chain, and someone else submits it and pays the gas. This is why an agent can pay without holding gas tokens.
- **EIP-712** is structured-data signing — human-readable typed signatures. You'll use this for both x402 and (if you build Mandate) your own consent object. **Learn this properly; it's the crux of both halves of your build.**
- **Permit2** (Uniswap) is a universal approval contract, used as the fallback path for tokens that don't support ERC-3009 and required for x402's `upto` scheme.

Rain's role: it converts between this world and the card/bank world — onramps, offramps, wallets, virtual accounts, cards.

### 1.3 The protocol landscape (so you can place your project on a map)

Worth 5 minutes because a judge may well ask "how does this relate to x402/ACP/AP2?" and a confident answer signals seriousness.

| Protocol | Who | What layer | Status |
|---|---|---|---|
| **x402** | x402 Foundation (Coinbase-originated; Monad Foundation is a member) | HTTP-native machine-to-machine payment. Reuses status code 402. | Live and real — Coinbase reported ~69k active agents / ~165M transactions / ~$50M cumulative volume by late April 2026 |
| **ACP** | OpenAI + Stripe | Agent↔merchant checkout handshake, 4 REST endpoints, Apache 2.0 | Spec is healthy; OpenAI's Instant Checkout surface was shut down in March 2026 after ~5 months of near-zero sales |
| **AP2** | now governed by the FIDO Alliance | Proving the *shopper authorized the spend* | Complementary to ACP, not competing |
| **UCP** | Google + Shopify | Merchant-hosted discovery and cart | Decentralized alternative to ACP |
| **ERC-8004** | Ethereum standard | Agent identity, reputation, validation registries | Deployed on Ethereum, Base, Polygon, Monad, BNB |
| **MCP / A2A** | Anthropic / Google | Tool access and agent-to-agent messaging — *not* payment | Widely adopted |

**The insight to carry on stage:** x402 solves machine-to-machine (software buys from software). Cards solve machine-to-human-merchant (agent buys from a real store on existing rails). ACP/AP2/UCP are fighting over the checkout handshake. **Nobody has solved portable, revocable, auditable delegated authority** — which is why that's the interesting place to stand. Note the ACP data point: it's a caution that the *protocol* was never the bottleneck. Trust was.

---

## Part 2 — Environment setup (do this Friday night)

### 2.1 Baseline

```bash
node --version    # need 18+, prefer 22 LTS
npm --version
git --version

# Foundry, if you're writing Solidity — you probably are
curl -L https://foundry.paradigm.xyz | bash && foundryup
forge --version
```

Also have ready: a code editor with an AI assistant configured (one of the judges builds Cursor — and more practically, you have 14 hours), Docker if your stack needs it, and a browser wallet extension (MetaMask or Rabby).

### 2.2 Monad networks

| | Mainnet | Testnet |
|---|---|---|
| Chain ID | `143` | `10143` |
| CAIP-2 (x402 needs this form) | `eip155:143` | `eip155:10143` |
| Primary RPC | `https://rpc.monad.xyz` (25 rps) | `https://testnet-rpc.monad.xyz` (50 rps; 25 for `eth_call`) |
| Fallback RPCs | `rpc1` / `rpc2` / `rpc3.monad.xyz`, `rpc-mainnet.monadinfra.com` | `rpc.ankr.com/monad_testnet`, `rpc-testnet.monadinfra.com` |
| Currency | MON | MON (the faucet token is often written tMON) |
| Explorer | `monadvision.com`, `monadscan.com` | `testnet.monadvision.com`, `testnet.monadscan.com` |
| Faucet | — | `https://faucet.monad.xyz` |

Websocket endpoints exist at the same hostnames with `wss://`. Add both networks to your wallet now.

Two things to know: public RPCs are rate-limited (20–50 rps depending on provider), so **if you plan to hammer it for a throughput demo, get an Alchemy or QuickNode key Friday** — a 429 live on stage is a preventable death. And **testnet was reset from genesis on 2025-12-16**, so treat any contract address you find in an older blog post as suspect and verify against the current docs.

There's also a `tempnet` (chain ID `20143`) for unreleased features. You don't want it — it resets and access is gated behind a form.

Properties worth quoting: ~0.3s blocks, single-slot finality, parallel execution, 10,000 TPS ceiling, EVM-equivalent. The reason this matters for your pitch: micropayments are only economically coherent when settlement is sub-cent and sub-second.

### 2.3 Faucets — do this Friday, the limits will bite you

```
MON (gas):     https://faucet.monad.xyz
USDC testnet:  https://faucet.circle.com  → select USDC, network "Monad Testnet"
               Sends 1 USDC per request
               ⚠️ ONE request per (token, testnet) every 2 HOURS
```

That 2-hour cooldown is the sharpest edge in this whole document. Get testnet USDC into **three or four separate addresses** Friday night: your buyer agent, your seller/resource server, a spare, and a clean one for the live demo. Discovering at 2pm Saturday that you need funded accounts and can only get 1 USDC every two hours is a genuinely afternoon-ending problem.

### 2.4 x402 on Monad — the concrete numbers

```
Facilitator:            https://x402-facilitator.molandak.org   (mainnet + testnet)
USDC (Monad testnet):   0x534b2f3A21130d7a60830c2Df862319e593943A3   (6 decimals)

# same addresses on mainnet and testnet:
Permit2 (canonical):    0x000000000022d473030f116ddee9f6b43ac78ba3
x402 ExactPermit2Proxy: 0x402085c248EeA27D92E8b30b2C58ed07f9E20001
x402 UptoPermit2Proxy:  0x4020A4f3b7b90ccA423B9fabCc0CE57C6C240002
```

Packages:

```bash
npm install @x402/core @x402/evm @x402/fetch @x402/next
```

**Version traps — read these twice, they will cost you hours:**

- The Monad facilitator supports **x402 v2 only.** Anything you find in a v1 blog post or older tutorial will silently not work. Migration notes: `https://docs.x402.org/guides/migration-v1-to-v2`
- `exact` scheme (fixed price): needs `@x402/evm >= 2.2.0`
- `upto` scheme (metered/variable): **use exactly `@x402/evm 2.12.0`.** Versions 2.9.0–2.11.0 ship the upto module but point at a proxy address that is *not deployed on Monad* (`0x402039b3...`). Payments fail at settlement **with no clear error.** The correct proxy (`0x4020A4f3...`) first landed in 2.12.0.
- Monad's USDC uses EIP-712 domain name **`"USDC"`** with version `"2"` — *not* `"USD Coin"`. Wrong domain name → signature verification fails with an unhelpful message.

The two facilitator schemes, from `GET /supported`:

| Scheme | Use for | Mechanism |
|---|---|---|
| `v2-eip155-exact` | fixed prices (default for USDC) | ERC-3009 `transferWithAuthorization`, or Permit2-proxy fallback |
| `v2-eip155-upto` | metered billing — LLM tokens, bandwidth, compute | Permit2 only. Client signs a *max*; facilitator settles actual usage ≤ max. Supports $0 settlement with no onchain tx. |

Facilitator endpoints: `GET /supported`, `POST /verify`, `POST /settle`. The facilitator pays gas on settle. One non-obvious status code: **`412 PRECONDITION_FAILED`** means the user's Permit2 allowance for the proxy is insufficient — approve and retry. It's distinct from 400 (malformed) and 402 (payment required).

Full guide: `https://docs.monad.xyz/guides/x402`

### 2.5 ERC-8004 registries (per Monad's ERC-8004 guide)

```
Identity Registry:    0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
Reputation Registry:  0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
Validation Registry:  not yet deployed
```

Verify these resolve on whichever network you're actually using before you build against them — testnet was reset in December and the guide doesn't split addresses by network.

Identity is an ERC-721 whose `tokenURI` points at an "agent card" JSON (name, endpoints, trust models, DID/ENS, payment wallet). Reputation is immutable structured feedback. SDKs: `https://sdk.ag0.xyz/` (TypeScript + Python). Browsers: `8004scan.io`, `agentscan.info`. Guide: `https://docs.monad.xyz/guides/erc-8004`

### 2.6 Rain — plan around the access gate

**`docs.rain.xyz` is behind an access code.** You cannot read the API reference before the event, and full partner access normally requires an NDA. Sandbox credentials are provisioned by the Rain team.

Practical consequences:

- **Getting credentials is your first task Saturday, before the 11:15 keynote.** Doors open at 9:00. Be there at 9:00, find a Rain engineer, and ask for the access code and sandbox keys immediately. Do not wait for the 11:30 workshop.
- **Design so that not having them cannot block you.** Put every Rain call behind one interface with two implementations:

```ts
// rain/port.ts — the only thing your app knows about Rain
export interface RainPort {
  issueScopedCard(req: {
    mandateId: string;
    limitMinorUnits: number;      // cents. NOT dollars.
    allowedMerchants?: string[];
    allowedMccs?: string[];
    validFrom: number;            // unix seconds
    validUntil: number;
    singleUse: boolean;
    idempotencyKey: string;       // always. always.
  }): Promise<{ cardId: string; last4: string; pan?: string; expiry: string }>;

  cancelCard(cardId: string): Promise<void>;
  getBalance(walletId: string): Promise<{ minorUnits: number; currency: string }>;
}
// → MockRainAdapter (Friday night, with a realistic auth webhook simulator)
// → LiveRainAdapter (Saturday, once you have keys)
```

Write `MockRainAdapter` Friday night. Include a fake authorization stream so your dashboard has data to render. Then swapping to live is one line, and if credentials arrive late you have lost nothing.

- **Ask these questions at the workshop** (write them down now; you will forget):
  1. What are the sandbox rate limits, and how do I simulate an *authorization* (not just issuance)?
  2. Is there a test-merchant simulator, or do I need real merchant transactions?
  3. Which Agent Control Layer fields are live in sandbox vs. roadmap? (It's beta — some fields may be documented but not enforced.)
  4. Webhook delivery in sandbox — real HTTP callbacks, or do I poll? Do I need a tunnel (`ngrok` / `cloudflared`)?
  5. Is there a card-issuance latency I should expect? (Matters if your demo issues a card live on stage.)
  6. Idempotency semantics on issuance — what's the key scope and TTL?

Install a tunnel Friday: `brew install cloudflared` (or ngrok). You will need it for webhooks, and setting it up at 3pm Saturday is a waste of your best hours.

### 2.7 Money-handling rules for the weekend

Non-negotiable, and they're also the things Farhan will probe:

1. **Integer minor units everywhere.** Cents for fiat, 6-decimal base units for USDC. Never a float, never a JS `Number` for anything that could exceed 2^53. `BigInt` for token math.
2. **Idempotency keys on every mutating call.** Agents retry. Retries double-spend.
3. **Never log a PAN, CVV, or private key.** Redact at the logger, not the call site. Someone will screenshot your terminal.
4. **Server-side signing only.** No private keys in client code, no keys in the repo. `.env.local` in `.gitignore` before your first commit.
5. **Replay protection on every signed object** — nonce plus `validAfter`/`validBefore`. Set `validAfter` ~60s in the past to absorb clock skew (Monad's own docs do this).
6. **Every state change appends to an audit log.** You need this for the product *and* for the demo — it's what makes the dashboard possible and it's Juan Blanco's whole area.

---

## Part 3 — Friday-night scaffold

Goal: walk in Saturday with a repo that already runs. Aim for 2–3 hours, not a full night.

```
/apps
  /console        Next.js — the audit/mandate dashboard (your demo surface)
  /agent          the buying agent (LLM + tools)
  /server         API: mandate verification, Rain adapter, webhook receiver
/packages
  /mandate        EIP-712 types + sign/verify + encoder  ← the crux
  /rain           RainPort interface + Mock and Live adapters
  /chain          viem clients, contract ABIs, addresses
/contracts        Foundry — MandateRegistry.sol
```

Stack choices that will not fight you: **Next.js 15 (App Router) + TypeScript + Tailwind**, **viem + wagmi** (not ethers — viem's typing is better and the x402 examples assume it), **Foundry** for contracts, **Vercel AI SDK** or the Anthropic SDK for the agent loop, **SQLite/Postgres via Drizzle** for the audit log, and **server-sent events** for streaming to the console (simpler than websockets and enough for a demo).

Checklist for Friday:

- [ ] Monorepo boots, both apps render, `.env.local` gitignored
- [ ] Both Monad networks in your wallet; testnet MON + USDC in **4 addresses**
- [ ] `viem` client reading a block from Monad testnet — proves RPC works
- [ ] EIP-712 sign + recover round-trip passing in a unit test
- [ ] `MockRainAdapter` returning plausible cards and emitting a fake auth stream
- [ ] Console renders a hardcoded mandate and three fake authorizations
- [ ] The x402 quickstart from `docs.monad.xyz/guides/x402` running locally, one real $0.001 testnet payment settled end to end
- [ ] Tunnel installed and tested
- [ ] Foundry project compiles and deploys a hello-world to Monad testnet
- [ ] One RPC provider key in reserve

That last item on the x402 list is the highest-value thing you can do Friday. **Getting one real testnet payment to settle before the event removes the single largest source of Saturday-afternoon panic** — the version traps in §2.4 are exactly the kind of thing that eats three hours, and you'd much rather eat them on Friday.

---

## Part 4 — Sketch: the mandate object

If you build Mandate (idea #1), this is the center of the project. Worth drafting Friday.

```ts
// packages/mandate/types.ts
export const MANDATE_TYPES = {
  SpendMandate: [
    { name: "principal",     type: "address" },  // the human delegating
    { name: "agent",         type: "address" },  // the delegate
    { name: "fundingSource", type: "bytes32" },  // hash of Rain wallet/account ref
    { name: "maxAmount",     type: "uint256" },  // minor units
    { name: "maxPerTx",      type: "uint256" },
    { name: "currency",      type: "string"  },  // "USD"
    { name: "merchantScope", type: "bytes32" },  // merkle root of allowed merchants/MCCs
    { name: "purpose",       type: "string"  },  // human-readable; shown at signing
    { name: "validAfter",    type: "uint256" },
    { name: "validUntil",    type: "uint256" },
    { name: "nonce",         type: "bytes32" },
  ],
} as const;
```

Four design notes, each of which is also an answer to a likely judge question:

**Why a merkle root for merchant scope?** Because the signing UI must show the human something they can actually read, while the enforcement path needs to check membership cheaply and the allowlist may be long. The root commits to the set; the enforcement path gets a proof. If the list is short, an array is fine — but be able to explain the tradeoff.

**Why is `purpose` in the signed payload?** Because EIP-712 renders it in the wallet at signing time. This is the difference between "sign this hash" and informed consent, and it's precisely the auditability property Pooja Shah names. It costs you nothing and it's the most quotable part of your design.

**What actually goes onchain?** The mandate *hash* plus the constraint fields you need enforceable and publicly verifiable, plus a revocation flag. Not `purpose` (expensive, and it's in the signature anyway). Emit an event on creation and revocation so the console can index from chain rather than trusting your database — that inversion is worth saying out loud, because it's what makes the audit trail credible rather than decorative.

**Where does Monad become load-bearing?** Weakest version: you anchor a hash. Better: a merchant or counterparty can verify the mandate *directly from the contract* without calling your API — your server is no longer trusted. Best: the funding leg settles onchain against the mandate, so the money movement and the authority are the same transaction. Get to at least the middle tier before you claim the Monad bounty.

---

## Sources

- [Monad: x402 guide](https://docs.monad.xyz/guides/x402) · [ERC-8004 guide](https://docs.monad.xyz/guides/erc-8004) · [Mainnet network info](https://docs.monad.xyz/developer-essentials/network-information) · [Testnet network info](https://docs.monad.xyz/developer-essentials/testnets)
- [Rain: Introducing the Agent Control Layer](https://www.rain.xyz/resources/introducing-the-agent-control-layer)
- [Rain: Machine-initiated payments will unlock new opportunities for payment credentials](https://www.rain.xyz/resources/machine-initiated-payments-will-unlock-new-opportunities-for-payment-credentials)
- [Rain: Know Your Agent — the next layer of compliance](https://www.rain.xyz/resources/know-your-agent-the-next-layer-of-compliance)
- [Rain: Virtual card infrastructure for agentic commerce](https://www.rain.xyz/solutions/agentic-commerce)
- [Rain API docs (access-gated)](https://docs.rain.xyz/)
- [Monad Foundation joins the x402 Foundation](https://blog.monad.xyz/blog/monad-foundation-joins-x402-foundation)
- [Crossmint: agentic payments protocols compared](https://www.crossmint.com/learn/agentic-payments-protocols-compared) · [Cipher Projects: MCP vs A2A vs ACP vs AP2](https://www.cipherprojects.com/blog/posts/agentic-commerce-protocols-mcp-a2a-acp-ap2-compared/)
- [Monad Developer Discord](https://discord.gg/monaddev)
