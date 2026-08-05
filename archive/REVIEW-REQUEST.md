# Review Request — round 2

**From:** engineering manager · **Date:** Mon 2026-08-03 · **Re:** four gates before Monday's lane opens
**Status:** contracts amended and frozen pending your eyeball · `ASSIGNMENTS.md` drafted · **zero agents dispatched, no code written**

You approved the plan and ruled D0–D8. I've applied all nine, replanned the schedule at Fiona's direction, and staffed the briefs. **Four things need you before anything spawns.** Three are quick; R4 is the one worth your time.

---

## Read, in this order (~10 minutes)

| # | File | Why | Time |
|---|---|---|---|
| 1 | `STATUS.md` | Current state, top to bottom | 2 min |
| 2 | `INTERFACE-CONTRACTS.md` **§5 and §7 only** | The Solidity surface and the pipeline order. Everything binds to these two. | 5 min |
| 3 | `SCHEDULE-V2.md` §1 and §5 | What the five-day build changes, and the one decision it unlocks | 3 min |
| — | `ASSIGNMENTS.md` | Reference. Read §0.3 if you want the TDD exemption detail. | — |

---

## R1 — Ratify schedule v2, and note what it kills

**The change:** build finishes **Friday night**, not Saturday 9 PM. Saturday becomes Rain credentials, the D2 fidelity pass, the authenticated round-trip, and rehearsal. Sunday is unchanged. Pre-building is confirmed permissible.

**What this does to your rulings:**

- **D8 is moot.** You protected WP6 from absorbing slip and guaranteed it a third hour out of WP7. Nothing competes for its hours now — it gets a day and a half. Your *two hard requirements* on it stand and are now verified by captured screenshots rather than by eye (WP9c).
- **D2 improves.** Saturday's mock-fidelity pass becomes a diff against a stable, tested mock instead of a scramble. Your reasoning for not building the live payment path is untouched — extra days don't change the 4–6 hour trap.
- **D3, D4, D5, D6, D7 unaffected.** D0 unaffected, and its authorized 45 minutes are now unremarkable.
- **Kill-list items 3–5 are unlikely to fire.** I'm keeping them anyway — see the risk note below.

**The risk inverts, and I want this on the record.** It stops being "we run out of time" and becomes "we build things nobody asked for." Every brief now says an agent finishing early writes more tests, not more features. I'd like you to hold that line with me on Thursday when the week feels roomy.

**Asking for:** ratify, or tell me the schedule stays as originally planned.

---

## R2 — Freeze `INTERFACE-CONTRACTS.md` §5 and §7

Amended for D0/D1/D3/D5/D6/D7. Supersedes `EXECUTION-PLAN.md` §5 and PRD §7 and §9.

**Where I went further than transcription, because a ruling deserved enforcement rather than a note:**

- **D0** — `create(MandateInput, sig) returns (bytes32)`. No hash parameter exists anywhere in the surface. `hashMandate()` is demoted in its own docstring to a *local prediction*; the client reads the hash back from the contract and throws `MandateHashMismatch` on disagreement. `tamperedMandate` added to the digest-vector fixture, so "valid signature, one field changed → `BadSignature`" is a permanent Foundry test. **That's the Farhan question, as a test that runs.**
- **D1** — needed a type change, not a constant change. `LANDED_OVER_BUDGET` is deleted from `PolicyFailureCode` and reborn as an `AdvisoryCode` in a separate field. **The compiler now enforces that price eliminates nobody.** Pinned by a property test across every duty rate 0–100%.
- **D6** — `AttemptKey` is constructible only via `newAttemptKey()`, which takes no arguments. Deriving an idempotency key from payment content is now a **compile error**, not a code-review catch. Given that this failure would show "paid" instead of "reverted" in the closer, I wanted it structural.
- **D4** — wagmi is gone from every surface. `revoke` is removed from `RegistryClient` and replaced by `revokeCommand(): string`. Our server structurally cannot revoke, which is the closer's whole point.
- **D5** — the language discipline lives in one `DEMO_COPY` module imported by both the UI and the harness, with a banned-string grep as a failing check. The screen and your mouth cannot diverge.

**Two things taken on my own authority, flagged not asked:** renamed `maxLandedPerUnit` → `landedPerUnitReference` so no agent mistakes it for a gate, and added `tamperedMandate` to the fixture.

**Asking for:** freeze, or redline §5's Solidity block / §7's pipeline comment.

---

## R3 — Two TDD exemptions

`test-driven-development` is a rigid skill and its own text requires your permission for exceptions. Two packages can't honor "no production code without a failing test":

- **WP0 (scaffold + environment).** There is no failing test for "Next.js is installed." **Proposed:** replace TDD with a binary environment checklist, every item a command that exits 0.
- **WP6 (two screens).** Visual legibility at 150% projector zoom isn't unit-testable. **Proposed:** TDD applies to the rendering logic — the revert-reason→copy mapping being total, the badge state machine, and the D1 rule that advisories render neutral. The visual criteria go to WP9c's captured screenshots instead.

The other seven packages are full TDD, and "watched it fail first" is a line item in every report format.

**Asking for:** grant both, grant one, or tell me to find a way.

---

## R4 — D5 option (b) is now affordable, and it changes your script

**This is the one that needs real thought.**

Your D5 ruling put on-chain `PaymentApproval` verification "first call on the Saturday-evening reserve, ahead of anything else, if the 3:00 checkpoint lands early." There is no longer a reserve — there's a Wednesday. The seam is pre-wired (`APPROVAL_ONCHAIN_VERIFY`, `error BadApproval()` ship unused in v1), so it's a two-file change, ~45 minutes, with float behind it.

**What it buys.** Escalation is mandatory above `autonomousMax`, so every deposit in the demo is an approved payment. Verifying the approval on-chain closes the PO-value hole for exactly that path — the deposit ratio stops being caller-asserted and becomes bound to a signature the contract itself checks.

**What it costs.** It makes your ratified sentence false in our favour:

> "The contract enforces the ceiling, the payee scope, the time window, and revocation. The deposit ratio is asserted by the caller and bound into the signed approval — so it's auditable, but I won't claim it's unforgeable."

**My recommendation: take it — and decide the replacement wording before WP3 dispatches Wednesday, not after.** I'd rather WP3 build to a known claim than retrofit one.

**My caution, which I'd like you to weigh against my own recommendation.** Your D5 reasoning was the strongest instinct in the ruling: *"four of five conditions unforgeable, stated precisely, beats five claimed loosely. Naming our own seam in front of Farhan and Juan is worth more than the seam costs us."* That logic doesn't weaken just because the fix got cheap. Even with (b) shipped, a **non-escalated** payment's `poValue` is still caller-asserted. If we take (b) and quietly upgrade to "the contract enforces everything," we trade a precise claim for a loose one and lose the thing that was working. **The precision is the asset, not the count.**

So: take (b) for the engineering, and keep naming what remains open.

**Asking for:** (a) hold as-is, (b) ship it Wednesday with new wording you supply, or (c) ship it and keep the current sentence unchanged — technically understated, which costs us nothing and stays safe.

---

## What happens on your nod

Monday opens with **WP0 and faucets first** (four addresses, 2-hour cooldown, includes the principal's revoke key). Then Tuesday's three lanes — WP2 / WP1 / WP4 — in isolated worktrees.

Every dispatch is logged in `ASSIGNMENTS.md` §3 with the verification command **I ran myself** and its output. Not the agent's claim. `STATUS.md` updates at every daily gate.

**Escalating immediately, not batching:** anything touching the mandate design or the on-chain enforcement claim · anything requiring a locked decision to change · anything that changes what you say on stage.
