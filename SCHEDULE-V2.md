# Schedule v2 — five-day build

**Ruling:** all nine work packages green and frozen by **Friday night**. Saturday is credentials, the D2 work, and rehearsal. Sunday is recording, slides, and submission. Ratified as R1.

> ⚠ **This schedule rests on an unverified premise, waived knowingly.** "Pre-building is permitted" has **no written source** — waived by Fiona 2026-08-03, recorded in `STATUS.md` as a decision rather than a verification. If it ever fails, this document is void and `EXECUTION-PLAN.md` §4's original schedule stands, intact and needing no rework.

**Supersedes** `EXECUTION-PLAN.md` §3 (critical path) and §4 (checkpoints). §2's breakdown, §5's contracts (now `INTERFACE-CONTRACTS.md`), and §6's kill list are unchanged.

---

## 1. What this actually changes

The build effort is still 11.0 hours. What changed is wall clock: **4.5 hours of zero-slack Saturday window becomes five days.** Every schedule risk in `EXECUTION-PLAN.md` §3 is now either dead or cheap.

| Was | Now |
|---|---|
| Saturday critical-path slack = **zero** | WP2 → WP3 → WP5 → WP8 = 5.75 h spread across four days |
| WP3 overrunning the 1:00–3:00 block was the single largest risk | WP3 owns a full day. D0's 45 authorized minutes are unremarkable. |
| Faucet 2-hour cooldown gated the principal's revoke key on Friday | Runs Monday. Off the critical path entirely. |
| WP6 funded at 1.75 h with no slack, protected by D8 | WP6 gets a day and a half. **D8's protection is now moot** — nothing is competing for its hours. |
| Kill-list items 3–5 were the likely 4:30 PM decision | Very unlikely to fire. **Kept anyway** — see §4. |
| D5's on-chain approval verification was a Saturday-evening maybe | Affordable this week. **Boss decision needed — §5.** |

**The risk profile inverts.** It stops being "we run out of time" and becomes "we build things nobody asked for." §4 is the response.

---

## 2. Day plan

Lanes run in isolated worktrees. Tier-1 packages (WP2, WP3, WP5) get implementer → spec review → code-quality review; tier 2 gets implementer → spec review. Per `ASSIGNMENTS.md` §0.

### Monday — foundation
- **WP0** — scaffold, Foundry, **faucets first** (4 addresses, 2 h cooldown, includes the principal's revoke key)
- Contracts frozen; `ASSIGNMENTS.md` briefs finalized

**Gate (binary):** `pnpm build` exits 0 · `forge test` green on a hello-world **deployed to testnet**, address in `STATUS.md` · `git check-ignore .env.local` exits 0 · 4 addresses funded · viem reads a block from the primary RPC and the backup.

### Tuesday — pure logic, three lanes
- **WP2** (tier 1, critical path) · **WP1** (tier 2) · **WP4** (tier 2)

**Gate:** `pnpm test lib/mandate lib/cost lib/score lib/rain` green, including the sign→recover round-trip with `chainId` + registry in the domain, the D1 property test across all duty rates, the 3000 bps boundary, and the D6 two-identical-payloads-different-keys case. **`digest-vector.json` exists and contains `tamperedMandate`.**

### Wednesday — the contract
- **WP3** (tier 1, critical path) · **WP7** (tier 2, parallel)

**Gate:** `forge test` green on all nine named tests in `ASSIGNMENTS.md` WP3, including `create` reproducing WP2's `expectedDigest`, `tamperedMandate` reverting `BadSignature`, the 3000 bps success, and the **D3 four-record ceiling sequence**. Deployed to Monad testnet, address and explorer link in `STATUS.md`. One real `record` transaction landed with `spent` incremented.

*This is the day that used to be a two-hour knife fight. If it slips, it slips into Thursday morning and costs nothing.*

### Thursday — integration
- **WP5** (tier 1, critical path, no worktree) · **WP6** starts against the typed stubs

**Gate:** `pnpm demo:all` produces all four outcomes in order against `MockRainAdapter` — `$180` autonomous with a tx hash and decremented remaining · `$1,479` `pending_approval` with `chainCalled: false` and `rainCalled: false` · `$1,479` to the changed payee `blocked{layer:"onchain"}` with **zero Rain calls** · revoke → retry → `blocked{reason:"Revoked"}`. Ugly CLI output is a pass.

### Friday — screens, harness, verification, freeze
- **WP6** finishes · **WP8** · **WP9 (a, b, c)** · **D4's wallet screen-recording**

**Gate — this is the real one:**
- both screens legible at 150% zoom, verified by **WP9c's captured screenshots**, not by assertion
- network panel captured empty during the blocked beat, cross-checked against `MockRainAdapter.calls` — two independent sources
- `fireSample(2)` → autonomous with $1 remaining; `fireSample(3)` → `ExceedsMaxTotal` (**D3**)
- `printRevokeCommand()` emits the `cast send` line (**D4**)
- the banned-string grep passes (**D5, D6**)
- WP9's recompute report shows zero disagreements with the verified supplier table
- **one clean end-to-end run, screen-recorded and stored**
- **the wallet EIP-712 rendering screen-recorded by hand** (**D4** — this is a demo asset, not a nice-to-have)
- `git tag build-freeze`

**Feature freeze is Friday night, not Saturday 9 PM.** It holds for the same reason it always did.

### Saturday — the event
- **9:00 AM, mandatory, before the keynote:** Rain credentials and docs access
- **D2 mock-fidelity pass, 20 minutes:** align `MockRainAdapter` field names, minor-unit conventions, and idempotency semantics with the real API. Logged as a diff in `ASSIGNMENTS.md`. *Now a diff against a stable, tested mock rather than a scramble — strictly better than the original plan.*
- **D2 authenticated round-trip, 30 minutes, timeboxed:** cheapest real GET that proves auth works. Not the payment path. If it doesn't work in 30 minutes, stop and say nothing about it on stage.
- Rehearsal, and the 6–8 PM dinner. All of us.

*Any change Saturday requires a re-record. The bar for touching frozen code is a defect that breaks a demo beat, not an improvement.*

### Sunday — as originally planned
9:00–10:00 two clean recorded takes · 10:00–11:15 five slides · 11:15–11:45 three timed rehearsals, standing up · **placeholder submitted at 11:00** · final by 11:45.

---

## 3. Critical path, restated

**WP0 → WP2 → WP3 → WP5 → WP8 → timed run-through**, one package per day with a full day of float behind each. The serialization points are unchanged: WP2 `DONE` before WP3 dispatches (digest vector), WP3 and WP1 `DONE` before WP5.

**What still has no slack:** nothing, in schedule terms. **What is still load-bearing:** D0's on-chain digest recomputation, `record` reverting on all five conditions, live revocation, and the published `payeeScope` preimage. Time was never the reason those matter.

---

## 4. The kill list stays, and here is why

Five days of wall clock is an invitation to build past the spec. `EXECUTION-PLAN.md` §6 and the locked decisions in `MANAGER-PROMPT.md` are unchanged and remain binding:

- **Still cut, still not up for revival:** x402 · ERC-8004 · FX normalization · a duty engine · PDF extraction on the critical path · multi-agent orchestration · nine API endpoints · LLM-generated confidence scores · **wagmi** (D4)
- **Still not built:** `LiveRainAdapter` (D2 — the ruling was about the *live payment path*, and extra days don't change the 4–6 hour trap or the "doing it tired on the money path" reasoning)
- **Still two screens only.** Dashboard, request form, and transaction-status screens remain deck screenshots.

Extra time is spent on **verification depth and rehearsal count**, not on surface area. If a package finishes early, the agent's next job is more tests, not more features. That instruction is now in every brief.

---

## 5. Open — one decision, and it is worth your attention

**D5's option (b) is now cheap: verify the `PaymentApproval` signature on-chain inside `record` for `stage == deposit`.**

Your D5 ruling put this "first call on the Saturday-evening reserve, if the 3:00 checkpoint lands early." There is no longer a reserve to spend — there's a Wednesday. The seam is already pre-wired: `APPROVAL_ONCHAIN_VERIFY` and `error BadApproval()` ship unused in v1 specifically so this is a two-file change.

**What it buys.** Escalation is mandatory above `autonomousMax`, so every deposit in our demo is an approved payment. Verifying the approval on-chain closes the PO-value hole for exactly that path — the deposit ratio stops being caller-asserted and becomes bound to a signature the contract itself checks.

**What it costs.** ~45 minutes of Solidity, now with float behind it. And **it changes the sentence you say on stage** — which is why this is yours, not mine. Your D5 language was:

> "The contract enforces the ceiling, the payee scope, the time window, and revocation. The deposit ratio is asserted by the caller and bound into the signed approval — so it's auditable, but I won't claim it's unforgeable."

If (b) ships, that sentence becomes false in our favour and needs rewriting.

**My recommendation: take it, but decide the wording before WP3 dispatches Wednesday**, not after. I'd rather WP3 build to a known claim than retrofit one.

**My caution, and I want it on the record:** your D5 reasoning — *"four of five conditions unforgeable, stated precisely, beats five claimed loosely"* — was the strongest instinct in the whole ruling. Naming our own seam in front of Farhan and Juan is worth more than the seam costs. If (b) ships we should still name what remains open (the `poValue` for a *non-escalated* payment is still caller-asserted), rather than quietly upgrading to "the contract enforces everything." The precision is the asset, not the count.
