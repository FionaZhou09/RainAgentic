# SourcePilot AI — Execution Plan

**Status:** drafted, awaiting boss approval. No implementation agents spawned.
**Author:** engineering manager. **Budget:** 11.0 h of build effort, ~6 prime.
**Verification note:** I independently recomputed the entire §5 supplier table before planning against it. All 24 derived figures reproduce exactly (A landed $5,623.00 / $9.3717/unit; B $5,657.45 / $9.4291/unit; delta $34.45 = 0.6127% of A; cash-at-risk gap $991.00; C 13.139% below B on unit price, $8.0686/unit at B's freight, breakeven freight $1,448.22 = 2.263× B's; B deposit exactly 3000 bps; A exactly 5000 bps). The brief's arithmetic is sound. New numbers I derived appear in §1.7 and §7.1.

---

## 1. Assumption check

Ordered by how badly each one hurts if it's found on stage instead of now. Items 1.1–1.4 are, in my judgment, demo-breaking as currently specified.

### 1.1 `MandateRegistry.create` as specified in PRD §7 cannot verify the signature — the claim is theater

Two defects in one signature:

- The `Mandate` struct passed to `create` omits `agent`, `nonce`, `purchaseRequestId`, `fundingSource`, and `purpose` — **all five are inside the EIP-712 hash.** You cannot recompute the digest from a struct that's missing 5 of 12 signed fields.
- `create` takes `mandateHash` as a **caller-supplied argument**. If the contract trusts a hash the server hands it, then the server can register any constraints it likes and pair them with a genuine signature over different terms. On-chain verification that trusts the caller's hash verifies nothing.

Fix (inside WP3, ~20 min): `create(MandateInput calldata m, bytes calldata sig)` where `MandateInput` carries **all twelve signed fields including the `purpose` string**, recomputes the EIP-712 digest on-chain, `ecrecover`s, requires `signer == m.principal`, reverts `MandateExists()` if that digest is already registered, and stores only the enforceable subset **plus `agent` and `nonce`**. Non-negotiable. Farhan will ask exactly this question, and "the server passes the hash" is a 15-second loss.

### 1.2 Idempotency will silently break the revocation closer

The closer retries "the same $180 that succeeded 90 seconds ago." That retry has the same mandate, payee, amount, and stage as a payment that already succeeded. **If the idempotency key is derived from payment content — the natural implementation — `/api/pay` returns the cached success and the closer shows "paid," not "reverted."** We would demo the exact opposite of our thesis, and we'd probably discover it at 8:40 PM.

Contract: idempotency keys are **per-attempt** (uuid v4 minted by the caller for each attempt, persisted on `Payment.idempotencyKey`), never derived from payment fields. The dedupe lookup runs first but is keyed on attempt, not content. Two attempts with identical content and different keys are two attempts — which is correct, because that's what a retry after revocation *is*.

Script consequence (flagging, not rewriting): say "the agent tries that order again," not "we replay the same request." The second wording invites "so your idempotency is broken?"

### 1.3 The on-chain deposit cap depends on a number the server asserts

`record` must check `deposit ≤ maxDepositBps × PO value`. **PO value is off-chain data** ($4,930 for B). The contract has no way to learn it, so `record` has to accept `poValueMinor` as a parameter. Four of the five revert conditions (revoked, time window, payee scope, cumulative ceiling) are fully on-chain and unforgeable by us. **The deposit ratio is not** — it binds a PO value we declare.

Mitigations, all cheap: (a) emit `poValueMinor` in `PaymentAuthorized` so the ratio is third-party recomputable from chain data alone; (b) add `poValue` to the `PaymentApproval` EIP-712 payload so the founder's approval signature covers the denominator; (c) **never say "the contract enforces the 30% cap" unqualified** — say "the contract enforces the ceiling, the scope, the window, and the revocation; the deposit ratio is checked against a PO value that's committed in the approval signature and emitted on-chain." Open question 5 offers the full on-chain fix and its cost.

### 1.4 PRD §9's evaluation order steals the blocked beat from the contract — and debits the ceiling for escalations that may be rejected

Two separate ordering bugs:

- **The pre-checks must not include payee scope, amount, expiry, or deposit.** If any server-side check rejects the changed bank account first, the line *"the contract reverted"* is false and the network panel proves the wrong thing. Pre-checks are exactly three, per §9: required fields, sourcing constraints, `caller === mandate.agent`. Everything else is the contract's job. This is a discipline that a parallel agent will break by accident unless it's in the interface contract — it is (§5.7).
- **§9 says routing (autonomous vs. escalate) happens *after* `record()` succeeds.** That debits `spent` on-chain for a payment the founder may then reject, with no release path (see 1.5). Correct order: the escalation gate precedes `record`; `pending_approval` makes **no chain call and no Rain call**; the approved retry (carrying `approvalSig`) runs the full chain. The demo is unaffected because she approves — but a judge who asks "what if she says no?" gets a bad answer under §9's order.

### 1.5 `spent` increments before Rain confirms, with no release path

If `record` succeeds and Rain then fails, the ceiling is permanently debited for money that never moved. That's the reserve-vs-capture problem; the correct design is two-phase reserve/settle and we are **not** building it in 11 hours. Two things: note that this fails in the *safe* direction (we over-reserve, never overspend), and put it in the §13 Q&A prep as a named limitation. It's a good answer — "authorization and capture are distinct, we authorize, a production version reserves and settles" — but only if we say it first.

### 1.6 `maxTotal` has no value anywhere in the PRD, and §12's strongest answer isn't demonstrable without one

The PRD specifies `maxTotal` as a type but never a number. Separately, §12's strong answer to "why an agent at all?" is *"the ceiling binds across transactions — fire several payments and watch one hit the limit."* The locked demo arc spends $180 + $1,479 = **$1,659**, so unless `maxTotal` is set below roughly $1,840, nothing in the demo ever approaches the ceiling and our best answer to the hardest question is a claim rather than a demonstration. This is a fixture value, but it changes what we can offer in Q&A. Open question 3.

### 1.7 At a $10.00/unit budget, the demo outcome is duty-dependent — and the margin is thinner than it looks

I computed the exact breakpoints:

| Budget | A breaches above | B breaches above |
|---|---|---|
| $10.00/unit (current) | 26.32% duty | **24.83% duty** |
| $11.00/unit | 41.94% | 39.43% |
| $12.00/unit | 57.57% | 54.03% |

The brief expects the stacked Chinese-origin effective rate in the **high-20s to mid-30s**. At $10.00 that inverts the demo — B, our winner, breaches first, at under 25%. At **$12.00/unit the demo becomes duty-independent for any plausible rate**, and neither A's nor C's elimination depends on duty at all (A: 50% deposit; C: unquotable landed cost + 70 days + 87% spec). So raising the budget removes tariff policy from the critical path entirely. Open question 1.

### 1.8 Trap 10 (nothing authenticates `/api/pay`) has a free fix nobody has written down

Require `msg.sender == mandate.agent` in `record()`, and make the mandate's `agent` address **the server-held signer that submits `record` transactions.** Caller authentication then happens on-chain, at the authority layer, for the price of one `require` and adding `agent` to the stored struct (PRD §7's struct omits it). An HTTP-layer EIP-712 `AgentRequest` signature is nice-to-have on top; it's on the kill list, the contract check is not.

### 1.9 Smaller items, each with its resolution

- **`payeeProof` vs. "sorted keccak"** — PRD §3 specifies a flat sorted-keccak commitment; §7's `record` takes a Merkle `bytes32[] payeeProof`. These are different schemes. Resolved as the simpler one, which §3 itself endorses for n=3: `record` takes `bytes32[] payeeSet` (the full sorted leaf array), the contract recomputes `keccak256(abi.encodePacked(payeeSet))` and requires it to equal `payeeScope`, requires strictly ascending order for canonicity, and checks membership by scan. Saves ~30 min of Merkle code, identical verifiability, and "we'd use a root if the list were long" is a better answer than an unnecessary root.
- **`remaining()` polling** — testnet caps `eth_call` at **25 rps**. No polling loops anywhere. Read the `record` return value and the `PaymentAuthorized` event; refresh on user action only. A 429 on stage is preventable and unforgivable.
- **Revocation needs the principal's wallet funded with MON, and a signing surface on stage.** The faucet has a 2-hour cooldown, so this is on Friday's critical path, not Saturday's. Signing surface: open question 4.
- **"60 days" means two things** (PRD §6 hygiene, unresolved in the fixtures). Fixing in fixtures: delivery deadline = 60 days; mandate window = **90 days** (`validUntil` = signing + 90d, `validAfter` = signing − 60s for clock skew). Never say "sixty days" about the mandate.
- **FR-2 contradiction** — §4 says "one pre-parsed PDF for illustration," §11 cuts FR-2 to fixtures. Resolved: fixtures only; the PDF and the quote-entry form are deck screenshots.
- **Wallet signing for the *mandate* is not needed at all.** The mandate is pre-signed from a prior session, so it's signed Friday by a script with a private key, and the wallet's EIP-712 rendering is a **screenshot** taken Friday. That deletes ~45 min of wagmi wiring from Saturday. wagmi survives only if we choose the browser-wallet revoke (open question 4).
- **Completeness metric, pinned:** required quote fields are `unitPrice, quantity, shipping, leadTimeDays, depositBps, specMatchPct` (6). A and B = 100%; **C = 83.3%** (missing `shipping`). `samplingFee` is deliberately *not* required, because C states it as $0.00 and a stated zero must not read as missing. Unit-test that distinction — `null` and `0` are different facts.

### 1.10 The locked decision I'd push back on (your call, per the brief)

**WP6 at 1.75 h is underfunded and WP7 at 0.5 h is not the place to find the hours.** Two screens legible at 150% on a projector, with a live event log, with policy badges, is the single thing all six judges look at for the full three minutes. The plan below gives WP6 1.75 h and zero slack. I am not asking to change scope — I'm noting that if any Saturday block slips, my recommendation will be to protect WP6 by executing kill-list items 3 and 4 rather than by shortening WP6. Flagging now so it isn't a surprise at 4:30 PM.

---

## 2. Work breakdown

Estimates are **build effort in hours**, and they sum to exactly 11.0 — the entire budget, with zero unallocated. Wall-clock is less than the sum because Friday and the 1:00–3:00 block run 3 lanes in parallel (worktree isolation); see §3 for the wall-clock reconciliation. Every package returns with a runnable check.

| ID | Package | Owner | Deps | Est. | Window |
|---|---|---|---|---|---|
| WP0 | Scaffold + environment: Next 15 App Router / TS / Tailwind, Drizzle+SQLite, `.env.local` gitignored **before first commit**, Foundry hello-world **deployed to testnet**, both networks in wallet, MON+USDC into **4 addresses** (start first — 2 h cooldown), viem reads a block, backup RPC configured, `cloudflared` installed | `general-purpose` ×1 + human for faucets/wallet | — | 0.75 | Fri |
| WP1 | `/lib/cost`, `/lib/score`, `/lib/fixtures` — pure, deterministic. Unit-tested against the §5 table to the cent, including the `null`-vs-`0` sampling case and C's 83.3% completeness | `general-purpose` ×1 (worktree) | WP0 | 1.00 | Fri |
| WP2 | `/lib/mandate` — EIP-712 domain+types, `hashMandate`, sign/recover round-trip, payee normalization + scope + published preimage, `PaymentApproval` types, off-chain constraint preview. **Critical path.** | `general-purpose` ×1 (worktree) | WP0 | 1.25 | Fri |
| WP4 | `/lib/rain` — `RainPort` + `MockRainAdapter` with simulated status stream and idempotency-honouring behaviour. `LiveRainAdapter` **throws `NotApproved`** until the boss says otherwise | `general-purpose` ×1 (worktree) | WP0 | 0.50 | Fri |
| WP3 | `MandateRegistry.sol` + Foundry tests + testnet deploy script. `create` (recomputes digest on-chain, reverts on duplicate), `record` (5 revert conditions, `msg.sender == agent`, increments `spent`, emits), `revoke`, `remaining`. **3000 bps boundary test pinned.** **Critical path.** | `general-purpose` ×1 (worktree, Foundry) | WP2 | 2.00 | Sat 1:00–3:00 |
| WP7 | Agent loop: schema-validated extraction over the fixture quotes + `renderRationale` (pure template, slot-filled from WP1 output, facts/assumptions/missing separated) | `general-purpose` ×1 (worktree) | WP1 | 0.50 | Sat 1:00–3:00 |
| WP5 | `/api/analyze`, `/api/mandate`, `/api/pay` + `/lib/chain` client + append-only event log + SSE stream. Enforcement order exactly per §5.7. **Critical path.** | `general-purpose` ×1 (no worktree — this is the integration point) | WP2, WP3, WP4, WP1 | 1.50 | Sat 3:00–4:30 |
| WP6 | `/compare` and `/approve`. Policy badges, inline SSE log, **legible at 150% projector zoom**, explicit error states | `general-purpose` ×1 | WP5 contracts (can start against the typed stubs at 3:00) | 1.75 | Sat 4:30–6:00 |
| WP9 | Verification: independently recompute every displayed number from the rendered UI; adversarial pass judge-by-judge; rehearse §13 Q&A. **Assigned to agents that produced none of the artifacts.** | `Explore` ×1 (recompute, read-only) + `general-purpose` ×1 (adversarial) | WP1, WP3, WP5 | 0.75 | Sat 4:30–6:00 (parallel) |
| WP8 | Fixtures finalization + demo harness: mandate pre-signed with a prior-session timestamp, scripted runner for all four outcomes from cold start, network panel clean, `materializeRevert` path for the failed-tx explorer link | `general-purpose` ×1 | WP5, WP6 | 1.00 | Sat 8:00–9:00 |
| | | | **Total** | **11.00** | |

**Changes I made to the brief's decomposition, and why.** (1) Split a WP0 out of WP8 — the environment work is Friday and gated on faucet cooldowns, and burying it inside "fixtures + harness" hides a hard external dependency. (2) Moved fixtures' *math* into WP1 (it's the same unit-test surface) and left the *harness* in WP8. (3) Pulled WP9 earlier, to 4:30–6:00 in parallel with WP6, per the brief's instruction to run it before Sunday — at that point the numbers are final and the UI is being built, which is exactly when a recompute is cheap to act on. (4) Moved WP7 into the 1:00–3:00 block, where it's the parallel filler behind WP3 rather than competing with WP5.

**Per-assignment discipline** (applied to every one when I brief it): one-sentence goal · exact file paths · the §5 interface contract it must satisfy verbatim · done-criteria as a command that exits 0 · explicit do-not-touch list · the locked decisions it must respect. Logged in `ASSIGNMENTS.md` at spawn time.

---

## 3. Critical path and slack

**Critical path: WP2 → WP3 → WP5 → WP8 → timed run-through.** 1.25 + 2.00 + 1.50 + 1.00 = **5.75 h.**

Saturday's share of that path is WP3 + WP5 + WP8 = **4.50 h**, against Saturday's available build windows of 1:00–3:00 (2.0) + 3:00–4:30 (1.5) + 8:00–9:00 (1.0) = **4.50 h.**

**Saturday slack on the critical path is zero.** That is the honest read, and it's why §6 exists. The 9 PM–midnight offsite block is the only reserve, and I am recommending it be held for critical-path overflow — **not** for `LiveRainAdapter` (open question 2).

Wall-clock reconciliation: Friday's 3.5 h of effort runs as 3 parallel worktree lanes (WP1 / WP2 / WP4) behind a 0.75 h WP0 — roughly **2 h wall clock**, matching the brief's Friday budget. Saturday's 7.5 h of effort fits 4.5 h of critical-path window plus WP7 (parallel, 1:00–3:00) and WP6+WP9 (parallel, 4:30–6:00).

**What has slack:**
- **WP7 (0.5 h) — full slack.** Entirely cuttable; the rationale can be a hand-written template string.
- **WP1 (1.0 h) — Friday slack.** Pure functions with no dependencies; if it slips it slips into Friday night, not Saturday.
- **WP9 (0.75 h) — schedulable slack**, but do not let it become Sunday. Its whole value is finding the arithmetic error while there's still time to fix it.
- **WP4 (0.5 h) — slack, and it must stay small.** Any hour spent on the mock beyond a simulated status stream is an hour stolen from the path.

**What has none:** WP2 (everything else's types depend on it — it must be done Friday, no exceptions), WP3 (the entire Monad bounty argument), WP5 (nothing is demoable without it), WP6 (fixed 90-minute window, and it's the judges' only view).

**Single largest schedule risk:** WP3 overrunning the 1:00–3:00 block. On-chain EIP-712 digest reconstruction against a viem-produced signature is where hackathon Solidity days die — one wrong `abi.encode` and `ecrecover` returns a plausible-looking wrong address. Mitigation, and it's the reason WP2 must land Friday: WP2 emits a **fixture vector** (mandate struct, expected digest, signature, expected recovered signer) that WP3's Foundry test asserts against. Cross-language digest bugs then fail in a red test at 1:20 PM instead of in `/api/pay` at 3:45.

---

## 4. Checkpoint schedule

Each checkpoint is a **binary state** — a command that passes or a thing that visibly happens — plus a named fallback. Boss go/no-go at each.

### Sat 1:00 PM — gate-in
**Binary:** `pnpm test` green on `/lib/cost`, `/lib/score`, `/lib/mandate` (including the §5 table to the cent and the sign→recover round-trip with `chainId` + registry address in the domain); `forge test` green; a hello-world contract address on testnet in `STATUS.md`; MON in 4 addresses; `MockRainAdapter` returns a status stream; both screens render *something* from fixtures.
**Fallback if missed:** WP2 is the only thing that matters. Spend 1:00–3:00 finishing WP2 and WP3 in one lane, kill WP7 and WP1's ranking (hardcode B as the winner), and accept that the 3:00 checkpoint slides to 4:00. Do **not** start WP6 before WP2 is green.

### Sat 3:00 PM — the contract refuses a payment
**Binary:** `MandateRegistry` deployed to Monad testnet, address recorded; `forge test` proves `record` reverts on each of the five conditions **individually**, with the 3000 bps case passing at exactly 3000 (`<=`, pinned test); one real `record` transaction landed on testnet with `spent` incremented, explorer link saved to `STATUS.md`; `create` rejects a tampered struct with a valid signature.
**Fallback if missed:** (a) If the contract works but deployment fails — run against local `anvil`, keep the earlier testnet explorer link as evidence, and say plainly on stage that the live contract is on a local node. (b) If `create`'s on-chain verification is what's broken — ship `create` with **server-verified** signature plus the signature stored on-chain as calldata, keep `record`/`revoke` fully on-chain, and say so; we lose a sentence, not the bounty argument. (c) If `record` isn't reverting correctly, this is a **stop-the-line** event: escalate to boss immediately, because the whole Monad claim is downstream of it.

### Sat 4:30 PM — all four outcomes fire end to end
**Binary:** one command (`pnpm demo:all`) produces, against `MockRainAdapter`, in order: $180 → `autonomous` with a testnet tx hash and decremented `remaining`; $1,479 → `pending_approval` with no chain call and no Rain call; $1,479 to the changed payee → `blocked{layer:"onchain"}` with **zero Rain calls** in the log; revoke → retry $180 → `blocked` with reason `Revoked`. Ugly CLI output is a pass.
**Fallback if missed:** ship in priority order **autonomous → blocked-payee → revoked**, and cut the escalation beat from the script (PRD §12 pre-authorizes exactly this cut). Escalation is the least differentiated beat; revocation is never cut.

### Sat 6:00 PM — watchable
**Binary:** on a projector-simulating window at 150% zoom, `/compare` shows three suppliers with policy badges and C's missing-field state, and `/approve` shows the four outcomes with the inline event log scrolling; the duty line reads *"HTS 6109.10.00 MFN base rate — excludes Section 301 and trade-remedy tiers"*; a stranger can read every number from 10 feet away.
**Fallback if missed:** `/approve` live, `/compare` as a static high-res screenshot in the deck. The approval screen carries all three differentiating beats; the comparison table is narration support. **Then go to dinner regardless.** Missing this checkpoint is not a reason to skip the BBQ — the BBQ is a listed feature of the event.

### Sat 8:00 PM — full timed run-through
**Binary:** the complete demo executed once from a **cold start** (fresh DB, fresh mandate registration, browser restarted) in under 3:30, with the network panel visible and empty during the blocked beat; every defect written down.
**Fallback if missed:** run the harness from the CLI and narrate over it; **record whatever currently works, immediately**, before touching anything else. A recording of a partial demo at 8:15 is worth more than a hypothetical full demo at 8:55.

### Sat 9:00 PM — feature freeze
**Binary:** one clean end-to-end run **screen-recorded tonight** (not deferred to Sunday) and stored; `git tag demo-freeze`; every unfinished item deleted from the plan rather than deferred; `STATUS.md` final for the night.
**Fallback:** none. Freeze is unconditional. The 9 PM–midnight block, if used at all, is critical-path overflow against the frozen tag, hard stop at midnight, and any change after 9 PM requires a re-record.

*Sunday for reference, not a checkpoint: 9–10 record two clean takes · 10–11:15 five slides · 11:15–11:45 three timed rehearsals standing up · 11:45 submit. Submit a placeholder at 11:00.*

---

## 5. Interface contracts

**These are normative.** Every parallel agent receives the sections relevant to it verbatim and may not alter a signature without coming back to me. Types live in `sourcepilot/lib/contracts/` and are imported everywhere else — nothing is redeclared locally.

### 5.1 Money, identifiers, and rounding

```ts
// lib/contracts/money.ts
/** Integer US cents. Never a float. Never dollars. */
export type Cents = number & { readonly __brand: "Cents" };
/** Basis points. 3000 = 30.00%. */
export type Bps = number & { readonly __brand: "Bps" };

export type Hex = `0x${string}`;
export type Address = Hex;
export type Bytes32 = Hex;

export function cents(n: number): Cents {
  if (!Number.isInteger(n)) throw new RangeError(`cents must be an integer, got ${n}`);
  return n as Cents;
}
export function bps(n: number): Bps {
  if (!Number.isInteger(n) || n < 0 || n > 10_000) throw new RangeError(`bad bps: ${n}`);
  return n as Bps;
}

/**
 * THE ONLY rounding rule in this codebase: half-up, at cent granularity,
 * applied once per derived line item and never to an already-rounded value.
 * All arithmetic is integer; the divisor is always 10_000 (bps).
 */
export function applyBps(base: Cents, rate: Bps): Cents {
  const n = base * rate;
  return cents(Math.floor(n / 10_000) + (n % 10_000 >= 5_000 ? 1 : 0));
}

/** Display only. Never feed this back into arithmetic. */
export function fmtUSD(c: Cents): string { /* "$5,657.45" */ }
/** Per-unit display: 4 decimal places of internal precision, 2 shown. */
export function perUnit(total: Cents, qty: number): { exactMilliCents: number; display: string };
```

### 5.2 Purchase request, quotes, and the completeness metric — WP1

```ts
// lib/contracts/sourcing.ts
export interface PurchaseRequest {
  id: string;                    // "PR-1042"
  idHash: Bytes32;               // keccak256(utf8(id)) — this is the signed purchaseRequestId
  product: string;
  quantity: number;              // 600
  /** SOURCING constraint, evaluated in /lib/cost. NOT the payment ceiling. */
  maxLandedPerUnit: Cents;
  maxLeadTimeDays: number;       // 60
  minSpecMatchPct: number;       // 90
  /** Mirrors the mandate's maxDepositBps for UI badging. The CONTRACT is the authority. */
  maxDepositBps: Bps;            // 3000
  destination: "US";
}

/** Exactly six. `samplingFee` is intentionally absent: a stated $0.00 is data, not a gap. */
export const REQUIRED_QUOTE_FIELDS = [
  "unitPrice", "quantity", "shipping", "leadTimeDays", "depositBps", "specMatchPct",
] as const;
export type RequiredQuoteField = (typeof REQUIRED_QUOTE_FIELDS)[number];

/** null = not stated by the supplier. 0 = stated as zero. These are different facts. */
export interface QuoteInput {
  id: string;
  supplierId: string;
  purchaseRequestId: string;
  currency: "USD";               // FX is hardcoded and out of scope
  unitPrice: Cents | null;
  quantity: number | null;
  samplingFee: Cents | null;
  shipping: Cents | null;        // seller-arranged freight; part of PO value
  leadTimeDays: number | null;
  depositBps: Bps | null;
  specMatchPct: number | null;
}

export interface Supplier {
  id: string;                    // "SUP-B"
  name: string;                  // "Hanzhou Apparel Co."
  country: string;
  payeeRef: string;              // raw; normalize before hashing (§5.4)
  verificationStatus: "unverified";  // we do not verify suppliers. Out of scope, say so.
}
```

### 5.3 Deterministic cost and score — WP1

```ts
// lib/cost/index.ts
export interface CostAssumptions {
  dutyRateBps: Bps;              // 1650
  paymentFeeBps: Bps;            // 100
  dutyLabel: string;             // "HTS 6109.10.00 MFN base rate — excludes Section 301 and trade-remedy tiers"
  fxNote: string;                // "USD only; FX hardcoded and out of scope"
}

export interface CostBreakdown {
  productSubtotal: Cents;        // unitPrice * quantity
  samplingFee: Cents;
  shipping: Cents;
  /** product + sampling + seller-arranged freight. THE maxDepositBps DENOMINATOR. */
  poValue: Cents;
  dutyEstimate: Cents;           // applyBps(productSubtotal, dutyRateBps) — goes to customs, never a payee
  paymentFee: Cents;             // applyBps(poValue, paymentFeeBps)
  landedTotal: Cents;            // poValue + dutyEstimate + paymentFee
  landedPerUnitMilliCents: number;
  depositDue: Cents;             // applyBps(poValue, quote.depositBps)
}

export type CostResult =
  | { kind: "complete"; breakdown: CostBreakdown }
  | { kind: "incomplete"; missing: RequiredQuoteField[] };   // Supplier C. No partial totals — unquotable means unquotable.

export function computeLandedCost(q: QuoteInput, a: CostAssumptions): CostResult;
export function missingRequiredFields(q: QuoteInput): RequiredQuoteField[];

// lib/score/index.ts
export type PolicyFailureCode =
  | "MISSING_REQUIRED_FIELD" | "LANDED_OVER_BUDGET" | "LEAD_TIME_OVER"
  | "SPEC_MATCH_UNDER" | "DEPOSIT_OVER_CAP";

export interface PolicyFailure {
  code: PolicyFailureCode;
  field?: RequiredQuoteField;
  message: string;               // human-readable, rendered verbatim as a badge
  observed: string;              // "70 days"
  limit: string;                 // "60 days"
}

export interface ScoreWeights { landedCost: number; leadTime: number; specMatch: number; completeness: number }

export interface QuoteAssessment {
  quoteId: string;
  supplierId: string;
  /** 100 * present/6. A=100, B=100, C=83.3 */
  completenessPct: number;
  cost: CostResult;
  /** Sourcing failures only. Payment-authority failures come from the chain, never from here. */
  hardFailures: PolicyFailure[];
  /** null when cost is incomplete. Never score an unquotable quote — that would imply we priced C. */
  score: number | null;
  rank: number | null;           // null if hardFailures.length > 0 or score === null
}

export function assessQuotes(
  pr: PurchaseRequest, quotes: QuoteInput[], suppliers: Supplier[], a: CostAssumptions,
): QuoteAssessment[];
```

### 5.4 Mandate, payee scope, and approval — WP2 (critical path; WP3 and WP5 both bind to this)

```ts
// lib/mandate/types.ts
export const MANDATE_DOMAIN = (verifyingContract: Address) => ({
  name: "SourcePilot",
  version: "1",
  chainId: 10143,                // Monad testnet. Without chainId + verifyingContract this replays on mainnet.
  verifyingContract,
} as const);

export const MANDATE_TYPES = {
  ProcurementMandate: [
    { name: "principal",         type: "address" },
    { name: "agent",             type: "address" },
    { name: "purchaseRequestId", type: "bytes32" },
    { name: "fundingSource",     type: "bytes32" },
    { name: "maxTotal",          type: "uint256" },  // cents. TOTAL PAYABLE TO SUPPLIERS.
    { name: "autonomousMax",     type: "uint256" },  // cents, per transaction
    { name: "maxDepositBps",     type: "uint256" },  // OF SUPPLIER PO VALUE
    { name: "payeeScope",        type: "bytes32" },
    { name: "purpose",           type: "string"  },
    { name: "validAfter",        type: "uint256" },
    { name: "validUntil",        type: "uint256" },
    { name: "nonce",             type: "bytes32" },
  ],
} as const;

export interface ProcurementMandate {
  principal: Address; agent: Address;
  purchaseRequestId: Bytes32; fundingSource: Bytes32;
  maxTotal: bigint; autonomousMax: bigint; maxDepositBps: bigint;
  payeeScope: Bytes32; purpose: string;
  validAfter: bigint; validUntil: bigint; nonce: Bytes32;
}

/** MUST equal the digest MandateRegistry recomputes. Fixture vector below is the cross-language pin. */
export function hashMandate(m: ProcurementMandate, registry: Address): Bytes32;
export function signMandate(m: ProcurementMandate, registry: Address, pk: Hex): Promise<Hex>;
export function recoverMandateSigner(m: ProcurementMandate, registry: Address, sig: Hex): Address;

// ---- payee scope: the published-preimage scheme -------------------------------
/** trim → NFKC → lowercase → collapse internal whitespace. One implementation, used by UI and chain alike. */
export function normalizePayeeRef(raw: string): string;
export function hashPayeeRef(raw: string): Bytes32;   // keccak256(utf8(normalizePayeeRef(raw)))

export interface PayeeScope {
  scope: Bytes32;      // keccak256(concat(leaves)) — leaves STRICTLY ASCENDING
  leaves: Bytes32[];   // pass this to record() as payeeSet
  preimage: string;    // newline-joined normalized refs. PUBLISHED alongside the mandate.
}
export function computePayeeScope(rawRefs: string[]): PayeeScope;
export function verifyPayeeScope(preimage: string, scope: Bytes32): boolean;  // what a third party runs

// ---- approval: escalation is itself signed -----------------------------------
export const APPROVAL_TYPES = {
  PaymentApproval: [
    { name: "mandateHash", type: "bytes32" },
    { name: "payeeHash",   type: "bytes32" },
    { name: "amount",      type: "uint256" },  // cents
    { name: "poValue",     type: "uint256" },  // binds the deposit denominator (see §1.3)
    { name: "stage",       type: "uint8"   },
    { name: "nonce",       type: "bytes32" },
  ],
} as const;

export interface PaymentApproval {
  mandateHash: Bytes32; payeeHash: Bytes32;
  amount: bigint; poValue: bigint; stage: number; nonce: Bytes32;
}
export function hashApproval(a: PaymentApproval, registry: Address): Bytes32;
export function recoverApprover(a: PaymentApproval, registry: Address, sig: Hex): Address;

/**
 * Off-chain PREVIEW only — for UI copy and fast feedback.
 * NOT the authority. /api/pay must never substitute this for the contract call.
 */
export interface ConstraintPreview {
  wouldPass: boolean;
  failures: Array<{ code: RevertReason; message: string }>;
}
export function previewConstraints(
  m: ProcurementMandate, args: { amount: bigint; poValue: bigint; payeeHash: Bytes32; stage: number; spent: bigint; now: bigint },
): ConstraintPreview;
```

**Cross-language pin — WP2 writes it, WP3's Foundry test asserts against it.** This file is how we avoid discovering a digest mismatch inside `/api/pay` at 3:45 PM.

```ts
// lib/mandate/__fixtures__/digest-vector.json  (shape)
export interface DigestVector {
  registry: Address; mandate: ProcurementMandate;
  expectedDigest: Bytes32; signature: Hex; expectedSigner: Address;
  payeeRefs: string[]; expectedPayeeScope: Bytes32; expectedLeaves: Bytes32[];
}
```

### 5.5 Chain client — WP3 (Solidity) ↔ WP5 (TypeScript)

```solidity
// contracts/src/MandateRegistry.sol — the normative Solidity surface
interface IMandateRegistry {
    struct MandateInput {          // ALL TWELVE SIGNED FIELDS. The digest is recomputed, never accepted.
        address principal; address agent;
        bytes32 purchaseRequestId; bytes32 fundingSource;
        uint256 maxTotal; uint256 autonomousMax; uint256 maxDepositBps;
        bytes32 payeeScope; string purpose;
        uint256 validAfter; uint256 validUntil; bytes32 nonce;
    }

    error MandateExists(); error UnknownMandate(); error BadSignature();
    error NotAgent();      error NotPrincipal();
    error Revoked();       error NotYetValid();   error Expired();
    error PayeeOutOfScope(); error ExceedsMaxTotal(); error DepositCapExceeded();
    error BadPayeeSet();   // payeeSet doesn't hash to payeeScope, or isn't strictly ascending

    /// Recomputes the EIP-712 digest from `m`, ecrecovers, requires signer == m.principal.
    /// Reverts MandateExists() if that digest is already registered (nonce replay).
    function create(MandateInput calldata m, bytes calldata sig) external returns (bytes32 mandateHash);

    /// Called BEFORE Rain. msg.sender MUST be the mandate's `agent` (closes trap 10 on-chain).
    /// Reverts: Revoked, NotYetValid, Expired, PayeeOutOfScope, ExceedsMaxTotal,
    ///          DepositCapExceeded (stage == 1 only; `poValueMinor` is caller-asserted — see plan §1.3).
    /// Deposit check uses <= : amount * 10000 <= poValueMinor * maxDepositBps  (B sits at exactly 3000).
    /// Increments `spent` and emits PaymentAuthorized on success.
    function record(
        bytes32 mandateHash, uint256 amountMinor, bytes32 payeeHash,
        bytes32[] calldata payeeSet, uint256 poValueMinor, uint8 stage
    ) external returns (uint256 remainingMinor);

    function revoke(bytes32 mandateHash) external;                                  // principal only
    function remaining(bytes32 mandateHash) external view returns (uint256);        // on demand only — 25 rps cap

    event MandateCreated(bytes32 indexed mandateHash, address indexed principal, address indexed agent);
    event PaymentAuthorized(bytes32 indexed mandateHash, uint256 amountMinor, bytes32 payeeHash,
                            uint256 poValueMinor, uint8 stage, uint256 remainingMinor);
    event MandateRevoked(bytes32 indexed mandateHash, uint256 at);
}
```

```ts
// lib/chain/registry.ts
export const STAGE = { sample: 0, deposit: 1, balance: 2 } as const;
export type Stage = keyof typeof STAGE;

/** 1:1 with the Solidity custom errors. WP5 decodes to this; WP6 renders a message per case. */
export type RevertReason =
  | "MandateExists" | "UnknownMandate" | "BadSignature" | "NotAgent" | "NotPrincipal"
  | "Revoked" | "NotYetValid" | "Expired" | "PayeeOutOfScope" | "ExceedsMaxTotal"
  | "DepositCapExceeded" | "BadPayeeSet" | "Unknown";

export const REVERT_COPY: Record<RevertReason, string> = {
  Revoked: "Mandate revoked on-chain. No further payment can be authorized against it.",
  PayeeOutOfScope: "Destination is not in the signed payee scope. No payment request was constructed.",
  ExceedsMaxTotal: "Payment would exceed the signed cumulative payment ceiling.",
  DepositCapExceeded: "Deposit exceeds the signed cap as a share of supplier PO value.",
  // ...one legible sentence per case. No raw revert strings on screen.
} as Record<RevertReason, string>;

export interface RecordArgs {
  mandateHash: Bytes32; amountMinor: bigint; payeeHash: Bytes32;
  payeeSet: Bytes32[]; poValueMinor: bigint; stage: Stage;
}

export type SimulateResult =
  | { ok: true; remainingMinor: bigint }
  | { ok: false; reason: RevertReason; raw: string };

export type RecordResult =
  | { ok: true; txHash: Hex; remainingMinor: bigint; blockNumber: bigint }
  | { ok: false; reason: RevertReason; txHash: Hex | null };   // txHash non-null only when materializeRevert

export interface RegistryClient {
  create(m: ProcurementMandate, sig: Hex): Promise<{ txHash: Hex; mandateHash: Bytes32 }>;
  /** eth_call. Free, instant, yields the revert reason for the UI. ALWAYS called before record. */
  simulateRecord(a: RecordArgs): Promise<SimulateResult>;
  /** Real transaction, sent from the AGENT key. Never called if simulate failed, unless materializeRevert. */
  record(a: RecordArgs, opts?: { materializeRevert?: boolean }): Promise<RecordResult>;
  /** Sent from the PRINCIPAL key. */
  revoke(mandateHash: Bytes32): Promise<{ txHash: Hex }>;
  /** On user action only. NEVER in a poll loop — testnet caps eth_call at 25 rps. */
  remaining(mandateHash: Bytes32): Promise<bigint>;
  explorerTx(txHash: Hex): string;   // https://testnet.monadvision.com/tx/...
}
```

`materializeRevert` exists for exactly one beat: the revocation closer, where a **failed transaction with an explorer link** is more convincing than a simulated refusal. It defaults to `false`, so the blocked-payee beat produces zero transactions and zero Rain calls.

### 5.6 Rain port — WP4

```ts
// lib/rain/port.ts
export interface CreatePaymentInstruction {
  mandateHash: Bytes32;
  payeeRef: string;              // already validated against payeeScope BY THE CONTRACT, not here
  amountMinorUnits: number;      // cents. never a float.
  currency: "USD";
  purchaseRequestId: string;
  stage: Stage;
  idempotencyKey: string;        // per-ATTEMPT uuid v4. See plan §1.2.
}

export interface RainPort {
  createPaymentInstruction(req: CreatePaymentInstruction): Promise<{ paymentId: string; status: string }>;
  getPaymentStatus(paymentId: string): Promise<{ status: string; ref?: string }>;
  /** Convenience/formatting only. NOT a security boundary — never gates a payment. */
  validateDestination(payeeRef: string): Promise<{ ok: boolean; reason?: string }>;
}

/** Mock invariants, testable: (1) same idempotencyKey => same paymentId and no second effect;
 *  (2) status advances created→submitted→settled on the configured delays;
 *  (3) every call is recorded so the harness can ASSERT ZERO CALLS on blocked beats. */
export interface MockRainAdapter extends RainPort {
  readonly calls: ReadonlyArray<{ at: number; method: string; req: unknown }>;
  reset(): void;
}
export interface MockRainConfig { statusDelaysMs: [number, number, number]; failPayeeRefs?: string[] }

/** Exists as a file so the swap is real, throws until the boss approves the attempt. */
export class NotApprovedError extends Error {}
```

### 5.7 API surface and the enforcement pipeline — WP5

```ts
// lib/contracts/api.ts

// ---- POST /api/analyze -------------------------------------------------------
export interface AnalyzeRequest { purchaseRequestId: string }
export interface Rationale {
  facts: string[];          // computed by /lib/cost and /lib/score. Slot-filled, never generated.
  assumptions: string[];    // duty label, hardcoded FX, freight assumption for C
  missingData: string[];    // named explicitly. "Supplier C did not state shipping."
  decision: string;
}
export interface AnalyzeResponse {
  pr: PurchaseRequest; assumptions: CostAssumptions;
  assessments: QuoteAssessment[];
  recommendation: { quoteId: string; rationale: Rationale };
}

// ---- POST /api/mandate ------------------------------------------------------
export interface MandateRequest {
  mandate: SerializedMandate;   // bigints as decimal strings
  signature: Hex;
  payeeRefs: string[];          // the PREIMAGE. Required — a commitment we alone can open is not auditable.
}
export interface MandateResponse {
  mandateHash: Bytes32; monadTxHash: Hex; explorerUrl: string;
  payeeScope: Bytes32; payeePreimage: string; recoveredSigner: Address;
  constraints: { maxTotalMinor: string; autonomousMaxMinor: string; maxDepositBps: number;
                 validAfter: number; validUntil: number };
}

// ---- POST /api/pay ----------------------------------------------------------
export interface PayRequest {
  purchaseRequestId: string; supplierId: string;
  payeeRef: string;             // raw. The changed-bank-account case arrives here and must reach the CONTRACT.
  amountMinor: number; stage: Stage;
  idempotencyKey: string;       // uuid v4, PER ATTEMPT (§1.2)
  approvalSig?: Hex;            // required to complete a previously escalated payment
  materializeRevert?: boolean;  // harness only, default false
}

export type PayResponse =
  | { outcome: "autonomous"; paymentId: string; rainPaymentId: string;
      monadTxHash: Hex; explorerUrl: string; remainingMinor: string; events: EventRecord[] }
  | { outcome: "pending_approval"; paymentId: string; reason: string;
      approvalPayload: SerializedApproval; chainCalled: false; rainCalled: false; events: EventRecord[] }
  | { outcome: "approved"; paymentId: string; rainPaymentId: string;
      monadTxHash: Hex; explorerUrl: string; remainingMinor: string; approver: Address; events: EventRecord[] }
  | { outcome: "blocked"; paymentId: string; layer: "offchain" | "onchain";
      reason: RevertReason | PolicyFailureCode; message: string;
      monadTxHash: Hex | null; rainCalled: false; events: EventRecord[] };

/**
 * THE ORDER IS THE CONTRACT. Do not reorder. Do not add checks to step 2.
 *
 *  1. Idempotency lookup by ATTEMPT key. Hit => return the stored PayResponse verbatim.
 *  2. Off-chain pre-checks, EXACTLY THREE (PRD §9):
 *       a. required quote fields present        -> blocked{layer:"offchain", MISSING_REQUIRED_FIELD}
 *       b. sourcing constraints (landed/unit, lead time, spec match)
 *       c. caller identity === mandate.agent    -> blocked{layer:"offchain"}
 *     ⚠ NO payee scope. NO amount. NO deposit. NO expiry. NO revocation.
 *       Those five belong to the contract, and if we pre-empt them the stage claim
 *       "the contract reverted" becomes false. This is the single easiest way to
 *       accidentally destroy the demo. (Plan §1.4)
 *  3. Escalation gate: amount > autonomousMax && !approvalSig
 *       -> pending_approval. NO chain call, NO Rain call. (Plan §1.4 — never debit
 *          the on-chain ceiling for a payment the founder may reject.)
 *  4. If approvalSig present: recoverApprover === mandate.principal AND every field of
 *     the approval matches this request exactly (amount, payee, poValue, stage). No field
 *     may change after approval.
 *  5. registry.simulateRecord  -> failure => blocked{layer:"onchain", reason}
 *  6. registry.record          -> failure => blocked{layer:"onchain", reason}
 *  7. rain.createPaymentInstruction  <-- THE FIRST RAIN CALL IN THE ENTIRE FLOW
 *  8. Persist Payment + append events; cache the response under the attempt key.
 */
export async function evaluatePayment(req: PayRequest, ctx: PayContext): Promise<PayResponse>;

// ---- event log + SSE --------------------------------------------------------
export type EventType =
  | "quotes_analyzed" | "mandate_registered" | "payment_attempted" | "precheck_failed"
  | "escalated" | "approval_signed" | "chain_authorized" | "chain_rejected"
  | "rain_instruction_created" | "rain_status" | "mandate_revoked";

export interface EventRecord {
  id: string; purchaseRequestId: string;
  type: EventType; actor: "user" | "agent" | "system";
  payload: Record<string, unknown>;   // redacted at the logger. Never a PAN, CVV, or key.
  createdAt: string;                  // ISO 8601
}
/** GET /api/events/stream?prId=PR-1042 — text/event-stream, `data: ${JSON.stringify(EventRecord)}\n\n` */
```

`Payment.outcome` is the union tag above — `autonomous | pending_approval | approved | rejected | blocked` — closing trap 9. The `rainCalled: false` literal on every blocked variant means the compiler enforces our stage claim.

### 5.8 Fixtures — WP1 writes, WP8 owns the harness. These exact values, nowhere else.

```ts
// lib/fixtures/pr-1042.ts
export const PR_1042: PurchaseRequest = {
  id: "PR-1042", quantity: 600,
  maxLandedPerUnit: cents(1200),   // ← PENDING BOSS DECISION, open question 1
  maxLeadTimeDays: 60, minSpecMatchPct: 90, maxDepositBps: bps(3000), destination: "US",
  // ...
};
export const ASSUMPTIONS: CostAssumptions = { dutyRateBps: bps(1650), paymentFeeBps: bps(100), /* ... */ };

// A: 640/600/12000/98000 · B: 685/600/18000/64000 · C: 595/600/0/null   (all Cents)
// Expected, unit-tested to the cent:
//   A poValue 494000  duty 63360  fee 4940  landed 562300  perUnit 9.3717  deposit@5000 247000
//   B poValue 493000  duty 67815  fee 4930  landed 565745  perUnit 9.4291  deposit@3000 147900
//   C incomplete: missing ["shipping"], completeness 83.3%

export const MANDATE_FIXTURE = {
  autonomousMaxMinor: 20_000n,     // $200.00 — the $180 sample sits under it
  maxTotalMinor:      184_000n,    // ← PENDING BOSS DECISION, open question 3
  maxDepositBps:       3_000n,     // B is EXACTLY at the cap. Boundary test pinned.
  validAfterOffsetSec: -60,        // clock skew
  validUntilOffsetDays: 90,        // the mandate window is 90 DAYS. The DELIVERY deadline is 60. Never conflate.
  signedAt: "prior session (Thursday) — visible timestamp in the UI",
} as const;

export const PAYEE_REFS = ["rain:payee:hanzhou-apparel", "rain:payee:yuanfeng-textiles", "rain:payee:rongcheng-garment"];
export const FRAUD_PAYEE_REF = "rain:payee:hanzhou-apparel-new-account";  // must NOT be in PAYEE_REFS
```

---

## 6. Kill list

Pre-decided, in order. I execute 1–4 without asking; 5 and up need a one-word go from you.

| # | Cut | Saves | Cost to the demo |
|---|---|---|---|
| 1 | **`LiveRainAdapter` — never started** unless every checkpoint is green *and* you approve | 4–6 h avoided | None. It was always an additive 20-second beat. |
| 2 | **x402, ERC-8004, anything not in P0** | — | None. Already out; listed so no agent drifts into it. |
| 3 | **WP7's LLM extraction** → hand-written rationale template over WP1's output | 0.5 h | None visible. The model was already forbidden from computing anything; §2's boundary claim is unchanged and still true. |
| 4 | **SSE live log** → 500 ms polled fetch, or a pre-rendered log that reveals line by line | 0.5 h | Cosmetic. Nobody in the room can tell. |
| 5 | **The escalation beat, cut from the script** (PRD §12 pre-authorizes this) | 0.5–0.75 h | Lose the least differentiated of four beats. **Cut the beat, never the `PaymentApproval` signature** — cutting the signature makes approval a database row, which is the exact flaw this design exists to escape (trap 7). |
| 6 | **`/compare` goes static** — high-res screenshot in the deck, `/approve` stays live | 0.75 h | Real but survivable. `/approve` carries all three differentiating beats. |
| 7 | **`create`'s on-chain signature verification** → server-verified, signature stored as calldata; `record`/`revoke` stay fully on-chain | 0.5 h | Lose one sentence of the authority story. Must be stated plainly on stage. **Last resort.** |

**Never cut, at any hour, for any reason:** `record()` reverting on-chain · cumulative `spent` as on-chain state · **live revocation** · the published `payeeScope` preimage · the pre-signed prior-session mandate · integer minor units · the `<=` at 3000 bps.

If we are behind at 4:30 PM, the answer is items 3, 4, and 5 — **not** shortening WP6 (see §1.10).

---

## 7. Open questions for you

### 7.1 PR-1042's landed-cost budget, given the duty rate — *decide Friday, before WP1 runs*
The brief already chose "give it headroom"; I need the number, because WP1's tests are pinned to it.

- **(a) Keep $10.00/unit.** Zero change. But B breaches above **24.83%** duty and A above 26.32% — inside the reported stacked range. If Friday's HTS check comes back high, the demo inverts and we're rewriting fixtures Saturday morning.
- **(b) Raise to $12.00/unit.** B survives to **54.03%** duty, A to 57.57%. The demo becomes duty-independent for any plausible rate, and *no elimination changes*: A still dies on its 50% deposit, C still dies on the missing freight figure plus 70 days plus 87% spec. Cost: one fixture constant, and the script says "landed budget of twelve dollars a unit."
- **(c) Drop the per-unit gate entirely** and let terms do all the eliminating. Cheapest, but it removes the only *price* constraint from the table and weakens the "we know C is genuinely cheaper" beat.

**Recommendation: (b).** It buys ~30 points of duty-rate headroom for one constant, keeps the price constraint in the story, and lets us answer "why a pre-2026 rate?" with "the outcome doesn't depend on the rate — here's the sensitivity" — which lands harder with Juan Blanco than any single number would.

### 7.2 `LiveRainAdapter` — attempt at all?
- **(a) Don't attempt.** Zero risk. We say "sandbox mock, and here's the port — the live adapter is one class" and show the interface. Six engineering judges will respect a named boundary.
- **(b) Timeboxed 45-minute spike, Sat 9:00–9:45 PM only, gated on all checkpoints green and the freeze recording already made.** Abandon at the first unexpected auth flow, pre-created-counterparty requirement, or webhook need. Cost: 45 min of the only reserve we have.
- **(c) Full attempt Saturday evening.** 4–6 h in our worst window, against an API we've never touched, with a payment path we've already frozen.

**Recommendation: (a), with (b) available only if you want it and the 9 PM recording is already in hand.** Our reserve block is the only slack on the critical path (§3), and spending it on a dependency the PRD explicitly calls non-load-bearing is the trade I'd least like to make. The BBQ conversation with the Rain engineers gets us most of the credibility (b) would buy, for free.

### 7.3 `maxTotal` value — and do we want the "ceiling binds across transactions" beat available?
The demo spends $1,659 total ($180 + $1,479).

- **(a) `maxTotal` = $5,200** (covers B's full PO with headroom). Realistic; nothing in the demo approaches the ceiling; §12's strongest answer stays a verbal claim.
- **(b) `maxTotal` = $1,840.** Mandate covers the sampling and deposit stages only, balance-on-delivery requires a fresh signature — a defensible and arguably *better* procurement story. After $180 + $1,479, remaining is **$181**; a second $180 sample then succeeds and a third **reverts on `ExceedsMaxTotal`**, live, on demand. Costs nothing to build; it's a fixture value.
- **(c) $1,840 and put the ceiling-exhaustion beat in the 3:00 script.** Strongest technically, but it adds a beat to a locked arc that already runs long, so it's yours to approve, not mine.

**Recommendation: (b).** It makes our answer to the hardest question ("why does this need an agent?") a thing we can *run* in the judging window rather than assert on stage, with no build cost and no change to the locked script.

### 7.4 How revocation is signed on stage
`revoke` is principal-only, so the founder's key must sign it live.

- **(a) Browser wallet (wagmi + MetaMask popup).** Most legible as "her wallet, not our server." Costs ~30 min of wagmi wiring that we'd otherwise delete entirely (§1.9), plus a popup rendered at 150% zoom and a small chance of an extension hiccup on stage.
- **(b) `cast send` from her key in a visible terminal.** Zero new dependencies, very fast, and "this is her key — our server can't do this" is easy to say. Reads slightly more like a hacker demo.
- **(c) Server-relayed signed revoke** (EIP-712 `RevokeAuthorization`, contract accepts principal signature or `msg.sender == principal`). Smoothest UI, ~20 min of Solidity, but the server pushing the button undercuts the closer's whole point.

**Recommendation: (b) as the plan of record, (a) only if WP6 finishes early.** The closer's power is that the *principal* refuses, not that the UI is pretty, and (b) removes wagmi from the critical path entirely. Reject (c) — the closer is precisely the moment not to have our server in the loop.

### 7.5 The deposit-cap PO-value hole (§1.3) — how far do we close it?
- **(a) Caller-asserted `poValueMinor`, emitted in the event, bound into the `PaymentApproval` signature, and named plainly on stage.** Zero extra hours; already in the §5 contracts.
- **(b) Additionally verify the `PaymentApproval` signature on-chain in `record` for `stage == deposit`.** Fully closes it for the escalated path (which is every deposit in our demo, since escalation is mandatory above `autonomousMax`). Cost: ~45 min of Solidity, reusing `create`'s ecrecover, spent inside the 1:00–3:00 critical-path block.
- **(c) Put a per-payee PO value in the mandate itself.** Genuinely closes it, but the supplier isn't chosen at signing time, so the mandate would have to commit to all three PO values. Real design change; not a weekend job.

**Recommendation: (a) now, (b) as the first item in the 9 PM–midnight reserve if — and only if — the 3:00 checkpoint lands early.** (b) is the single highest-value 45 minutes of extra Solidity available to us with Farhan and Jarrod in the room, but not at the price of the 3:00 checkpoint.

### 7.6 Script-affecting wordings I need ratified (you own the script; flagging, not rewriting)
Three phrases whose current form is technically false or self-defeating: **"we replay the same request"** → "the agent tries that order again" (§1.2 — the current phrasing invites "so idempotency is broken?"); **"the contract enforces the thirty percent cap"** → needs the PO-value qualifier (§1.3); **"expires in sixty days"** → the mandate window is 90 days, the *delivery deadline* is 60 (§1.9). **Recommendation: ratify all three now** so WP6's UI copy and WP8's harness output are written against the same words you'll say.

---

**Awaiting approval. No implementation agents will be spawned until you say go.** On approval I will publish per-package assignment briefs with the §5 contracts attached verbatim, log them in `ASSIGNMENTS.md`, and update `STATUS.md` at each checkpoint.
