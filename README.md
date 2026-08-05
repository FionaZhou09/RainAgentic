# SourcePilot AI — project record

**Rain × Monad hackathon, NYC.** Last updated Monday 2026-08-03, end of day.

> **New here, or coming back after a gap? Read this file, then `STATUS.md`. That's enough to act.**

---

## 1. What we're building

**SourcePilot AI** — a procurement agent that analyzes supplier quotes and spends company money inside a limit its owner signed cryptographically, enforced on-chain, revocable in one transaction.

The core primitive is a **Procurement Mandate**: an EIP-712 object the founder signs once (payment ceiling, per-transaction autonomous ceiling, max deposit bps, approved-payee scope, validity window, nonce). It's registered in a Monad contract that tracks cumulative spend in on-chain state and **reverts** on any payment that is over-limit, out-of-scope, expired, or revoked. `/api/pay` calls the contract *before* it calls Rain.

**The test the design must keep passing:** *what breaks if you delete the server's call to the contract?* The answer must be "the payment loses its authorization and the ceiling stops decrementing." If it ever becomes "nothing," the Monad integration has regressed to an audit log and the bounty argument is gone.

**Demo arc (locked):** pre-signed mandate from a prior session → analysis declines the cheapest supplier on a *term*, not a price → $180 sample executes autonomously with the on-chain ceiling decrementing → $1,479 deposit escalates → the same amount to a changed bank account is refused before any API call → **revoke, retry the $180 that succeeded 90 seconds ago, it reverts.**

---

## 2. Documents, and which one wins

When two documents disagree, **higher in this table wins.** This ordering exists because the PRD is superseded in two specific places and a subagent reading the wrong file would rebuild a known bug.

| Authority | File | What it is |
|---|---|---|
| 1 | `BOSS-DECISIONS.md` · `BOSS-DECISIONS-R2.md` | **The rulings. D0–D8 and R1–R4. These override everything, including the PRD.** |
| 2 | `INTERFACE-CONTRACTS.md` | **Frozen v1.0.** TS types and Solidity signatures. Supersedes `EXECUTION-PLAN.md` §5 and PRD §7 (D0) and §9 (D7). No agent may change a signature. |
| 3 | `SCHEDULE-V2.md` | The five-day day plan and its binary gates. Supersedes `EXECUTION-PLAN.md` §3–§4. |
| 4 | `ASSIGNMENTS.md` | Staffing model, per-package briefs, dispatch log. |
| 5 | `EXECUTION-PLAN.md` | The approved plan. §1 assumption check, §2 breakdown, §6 kill list still govern. §3–§5 superseded. |
| 6 | `SourcePilot-PRD-v2.md` | The spec. **§7's contract signature and §9's pipeline ordering are dead** — see D0 and D7. |
| — | `STATUS.md` | Current state. Updated at every gate. Read instead of asking. |
| — | `BUILD-HANDOFF.md` | How the terminal build window gets bootstrapped. |
| — | `CLAUDE.md` | **Auto-loaded by Claude Code every session.** Pins the authority order and the four things that must never be rebuilt. This is what stops session-to-session drift across a five-day build. |
| — | `MANAGER-PROMPT.md` | The manager's operating brief: authority boundary, locked decisions, verified data, ten traps. |
| — | `NEW-WINDOW-PROMPT.md` | Bootstrap for a fresh manager window. **Rewritten Monday** — the round-1 version asked for the interface contracts as a first deliverable, which would now produce a duplicate that drifts from the frozen file. |
| — | `01-project-ideas.md` · `02-technical-prep-brief.md` · `03-demo-pitch-template.md` | Reference: why this project over five alternatives · network facts and version traps · weekend timeline and judge Q&A. **`03` is needed Sunday** — don't lose it. |
| — | `archive/` | Superseded documents, kept for the record. Nothing here is live. |

**Every file at the top level is live.** If it's superseded, it's in `archive/`. That rule is what stops an agent building against a dead spec.

---

## 3. Decision history

### Round 1 — plan approved with rulings (`BOSS-DECISIONS.md`)

| ID | Ruling |
|---|---|
| **D0** | The PRD §7 contract bug is a **P0**. Recompute the EIP-712 digest on-chain from all twelve signed fields; `mandateHash` becomes a return value, never an input. 45 minutes authorized. |
| **D1** | Landed budget **$12.00/unit**, and the per-unit figure is **informational, not an elimination gate**. Removes tariff policy from the critical path entirely. |
| **D2** | Don't build `LiveRainAdapter`. Credentials Saturday 9 AM mandatory; shape the mock against the real API; one 30-minute authenticated round-trip after the Saturday checkpoint if green. |
| **D3** | `maxTotal` = **$1,840**. The ceiling binds across transactions and the agent halts itself — the non-circular answer to "why an agent at all?" |
| **D4** | `cast send` for revocation, and **delete wagmi entirely.** Capture the wallet's rendered EIP-712 terms as a Friday screen-recording instead of signing live. |
| **D5** | PO-value staging approved. Mandatory language discipline: never claim the contract enforces the deposit cap unqualified. |
| **D6** | Three script wordings ratified. **Idempotency keys are per-attempt UUIDs** — a content-derived key inverts the revocation closer. |
| **D7** | The §5.7 pipeline contract supersedes PRD §9. |
| **D8** | WP6 is protected and does not absorb slip. |

### Round 2 — contracts frozen with redlines (`BOSS-DECISIONS-R2.md`)

| ID | Ruling |
|---|---|
| **R1** | Schedule v2 ratified — five-day build, Friday-night freeze. **D8's scheduling protection is moot; its two hard requirements are not.** Scope control made structural: an agent that finishes early **stops**. |
| **R2** | §5 and §7 frozen, **two redlines**. *Redline 1:* `mandateExpiryLabel` was false against a signed field — now "Expires in ninety days", old wording banned. *Redline 2:* §7 step 4 is not a demo beat; one blocked-by-contract beat only, and it stays the changed payee. |
| **R3** | Both TDD exemptions granted — WP0 in full, WP6 partial. Correction applied: WP6's visual criteria go to **captured screenshots**, not a human-eye pass. |
| **R4** | Take option (b) — on-chain `PaymentApproval` verification, built Wednesday. New stage sentence ratified. `DEMO_COPY.enforcementClaim` is now **two-state**, driven by the `APPROVAL_ONCHAIN_VERIFY` flag, with WP9 asserting the string matches the flag. |

### Monday's two field decisions

- **Pre-building eligibility: WAIVED, not verified.** No written source exists; the claim originated as an option in a manager-authored question and was ratified. Recorded in `STATUS.md` as a decision, deliberately not as a verification. Residual risk is git-history timestamps, all-or-nothing, unmitigated. Fallback if it ever fires: `EXECUTION-PLAN.md` §4's original weekend schedule, intact.
- **Build environment moved to a terminal.** WP0 came back `BLOCKED` — the Cowork sandbox has no `pnpm`, no Foundry, and no network to npm, GitHub, or any Monad RPC. Independently verified. Implementation now runs in Claude Code on the local machine; the Cowork window remains the manager. This restores the intended split — the manager was never meant to write production code.

---

## 4. Where things stand

**Nothing is built.** `sourcepilot/` is empty. The dispatch log has one row: WP0, `BLOCKED`, environment.

**What is done** — and it is the part that's hard to redo: the assumption check that found three demo-breaking defects, the frozen interface contracts, thirteen rulings applied, nine package briefs with runnable done-criteria, and the schedule. All of it is toolchain-independent and carries over unchanged.

**Three defects caught before any code existed:**

1. `create` as specified couldn't verify the signature — the server could pair a genuine signature with constraints the founder never agreed to (D0)
2. A content-derived idempotency key would make the revocation closer show **"paid"** instead of "reverted" (D6)
3. Off-chain pre-checks would steal the blocked beat from the contract, making "the contract reverted" false on stage (D7)

**Where possible, rulings became structure rather than notes.** Price can't eliminate a supplier because `LANDED_OVER_BUDGET` isn't in the failure union. An idempotency key can't be content-derived because `newAttemptKey()` takes no arguments. The server can't revoke because `revoke` isn't on the client. Each is a compile error rather than a code-review catch.

---

## 5. The week

| Day | Packages | Gate |
|---|---|---|
| **Mon** | WP0 scaffold + **faucets** | `pnpm build`, `forge test`, `git check-ignore .env.local`, `check-env` — all exit 0 |
| **Tue** | WP2 (critical path) · WP1 · WP4 | `pnpm test` green; `digest-vector.json` contains `tamperedMandate` |
| **Wed** | WP3 (critical path) · WP7 | `forge test` on **ten** named tests; deployed to testnet. **Manager decides `APPROVAL_ONCHAIN_VERIFY` here.** |
| **Thu** | WP5 (critical path) · WP6 starts | `pnpm demo:all` — four outcomes in order, zero Rain calls on blocked beats |
| **Fri** | WP6 · WP8 · WP9 (a/b/c) · D4 recording | Full gate, captured evidence, `git tag build-freeze` |
| **Sat** | *Event* — 9 AM credentials · D2 fidelity pass · D2 round-trip · rehearsal · dinner | |
| **Sun** | Two takes · five slides · three rehearsals · placeholder submitted 11:00, final 11:45 | |

Critical path **WP0 → WP2 → WP3 → WP5 → WP8**, one package per day with a full day of float behind each.

---

## 6. Open risks

| Risk | State |
|---|---|
| **Faucet cooldown** — 2 h per token, four addresses, one is the principal's revoke key | **The only thing this week that can't be compressed.** Gates Tuesday. Start it first. |
| **Eligibility** — no written source | Waived knowingly. All-or-nothing. Replace with a real source if one surfaces. |
| **Scope creep** — five days is roomy | Structural now: finishing early and stopping is a success condition; growth needs sign-off |
| **WP3 cross-language digest** | Mitigated — WP2 emits a fixture vector Tuesday that WP3's Foundry test asserts against, so a mismatch fails red on Wednesday rather than inside `/api/pay` on Thursday |

**Never cut, at any hour, for any reason:** `record()` reverting on-chain · cumulative `spent` as on-chain state · **live revocation** · the published `payeeScope` preimage · the pre-signed prior-session mandate · integer minor units · the `<=` at 3000 bps.

---

## 7. Who does what

- **Cowork window — manager.** Owns the frozen contracts, briefs, gates, dispatch log, `STATUS.md`, and boss escalations. Writes no production code.
- **Claude Code in a terminal — build.** Executes the briefs against a real toolchain. Bootstrapped by `BUILD-HANDOFF.md` §3.
- **Human.** Faucets, wallet, Rain credentials Saturday 9 AM, the D4 screen-recording, and the stage.

Each day's gate output comes back to the manager window, gets verified there, and is logged in `ASSIGNMENTS.md` §3 — **the manager runs the check itself rather than trusting a report.** That discipline is what caught the WP0 blocker in two minutes instead of a day.
