# Boss Decisions — round 1

**Date:** 2026-08-03 · **Re:** `EXECUTION-PLAN.md` · **Status:** plan **APPROVED** with the rulings below

The plan is approved. Hour allocation is honest, the critical path is correctly identified, and the assumption check found two things I had wrong. Independently verified your supplier recompute and every duty breakpoint — all reproduce. Proceed to `ASSIGNMENTS.md` and staff it.

---

## D0 — The §7 contract bug: fix it, and it's a P0, not a nice-to-have

You're right and I was wrong. `MandateRegistry.create` as written in PRD §7 accepts `mandateHash` as a caller-supplied argument while the struct carries only seven of the twelve signed fields. That means our server could pair a genuine signature with constraints the founder never agreed to — which destroys the one claim the whole project rests on, and it is precisely the question Farhan Khwaja asks.

**Recompute the EIP-712 digest on-chain from all twelve fields.** `mandateHash` becomes a return value, never an input. Your 20-minute estimate inside WP3 is accepted; if it runs to 45 minutes, take it anyway — this is load-bearing in a way WP6 polish is not.

Update PRD §7's Solidity block to match once WP3 lands, and note in `STATUS.md` that the PRD was corrected rather than silently diverged from.

---

## D1 — Landed budget: **$12.00/unit**. Approved.

Your breakpoints reproduce exactly: at a $10.00 ceiling B breaches above 24.83% duty and A above 26.32%, both inside the reported stacked-tariff range — so the demo inverts on a number we cannot verify from the venue. At $12.00, B survives to 54.03% and no elimination changes.

**Additional ruling:** the per-unit landed figure becomes **informational, not a hard elimination gate.** Pin this in WP1's tests. The demo's tension is entirely term-based — A dies on the deposit cap, C on missing freight plus lead time plus spec match — so price should not be able to eliminate anyone. That removes the tariff assumption from the critical path completely instead of merely giving it headroom.

---

## D2 — `LiveRainAdapter`: don't build it. **But get one real call, and get it early.**

I'm accepting your recommendation not to build the live path, and rejecting the Saturday-9-PM timing.

Reasoning: this is a *"use Rain"* challenge judged by four Rain employees. A project that never touches Rain's API invites "so did you actually integrate, or did you imagine an integration?" — and I don't want to answer that with a mock. But building the full payment path live is exactly the 4–6 hour trap, and doing it tired, on the money path, at 9 PM is how the PRD says teams lose.

**Ruling — three separate things, don't conflate them:**

1. **Credentials and docs access: mandatory, Saturday 9:00 AM, before the keynote.** Not optional and not timeboxed. Free optionality, and the workshop questions in PRD §7 depend on it.
2. **Shape `MockRainAdapter` against the real API** once we can read the docs. The mock should mirror Rain's actual field names, minor-unit conventions, and idempotency semantics. Costs nothing extra and means the mock is evidence of comprehension rather than invention.
3. **One authenticated round-trip, 30 minutes, timeboxed, Saturday afternoon** — immediately after the 4:30 checkpoint, and only if it's green. Target the cheapest real call that proves auth works (a GET, a balance read, anything). Not the payment path. If it doesn't work in 30 minutes, stop and say nothing about it on stage.

If (3) lands we get one honest sentence: *"the mock mirrors their API, and here's a live authenticated call against the sandbox."* If it doesn't, we say the mock is a mock and move on. Either is fine. What's not fine is a half-finished live path bleeding into the demo.

The Saturday-evening reserve goes to D5, not to Rain.

---

## D3 — `maxTotal` = **$1,840**. Approved, and this is the best idea in your plan.

Verified: demo spends $1,659, leaving $181 — so a second $180 sample succeeds with $1 remaining and a third reverts on `ExceedsMaxTotal`.

This matters more than you flagged. My answer to *"why does this need an agent at all?"* was weak — "the $180 order executed autonomously" is circular, since it needed an agent because we built one. **A ceiling that binds across transactions and halts the agent on its own is the non-circular answer**, and you've made it runnable in the judging window at zero build cost and no change to the locked script. Make sure WP8's harness can fire the second and third sample on demand.

---

## D4 — Revocation via `cast send` in a visible terminal. Approved. **And delete wagmi entirely.**

Taking this further than you proposed. If revocation is a terminal transaction and the mandate is pre-signed by script, wagmi has no remaining job — so remove it from the dependency list and the critical path.

**But I'm not giving up the wallet-rendering moment**, which is a real part of the pitch. Replace it as follows:

- **Friday:** sign the mandate once with a real browser wallet, by hand, and **screen-record the wallet showing the rendered EIP-712 terms.** That recording is a demo asset.
- **On stage:** show that recording as *"this is what she saw when she signed on Thursday."*

This is strictly better than doing it live. It removes a dependency, eliminates a live wallet-modal failure mode, and *reinforces* the prior-session staging rather than fighting it — the whole point of D-staging is that she isn't in the room.

Revocation stays live and stays in the terminal. Agreed that the closer is the one moment our server must not be in the loop; server-relayed revoke is rejected.

---

## D5 — PO-value hole: your staging, approved. Language discipline is mandatory.

Caller-asserted `poValueMinor`, emitted in the event, bound into the `PaymentApproval` signature — now. On-chain `PaymentApproval` verification (~45 min) is **first call on the Saturday-evening reserve**, ahead of anything else, if the 3:00 checkpoint lands early.

**Non-negotiable:** we never say *"the contract enforces the 30% deposit cap."* The honest and still-strong sentence, which I'm adding to the script:

> "The contract enforces the ceiling, the payee scope, the time window, and revocation. The deposit ratio is asserted by the caller and bound into the signed approval — so it's auditable, but I won't claim it's unforgeable."

Four of five conditions unforgeable, stated precisely, beats five claimed loosely. Naming our own seam in front of Farhan and Juan is worth more than the seam costs us.

---

## D6 — Script wordings ratified

Mine to decide, so: all three of your flags are correct.

| Kill | Use | Why |
|---|---|---|
| "replay the same request" | **"tries that order again"** | Your idempotency catch. Identical content + a content-derived key returns the cached success and the closer shows "paid" instead of "reverted" — the single most embarrassing possible failure. **Idempotency keys are per-attempt UUIDs.** Pin this in WP4 and WP5. |
| "the contract enforces the 30% cap" | the D5 sentence above | Overclaims a caller-asserted value |
| "expires in sixty days" | **"expires at the end of the month"** | "Sixty days" is the delivery deadline. Mandate expiry needs different words. Delivery keeps "sixty days." |

Pin all three into WP6's UI copy and WP8's harness output so the screen and my mouth agree.

---

## D7 — Your §9 pipeline reordering: approved

Both defects are real. Off-chain pre-checks must not steal the blocked beat from the contract, and we must not debit the on-chain ceiling for an escalation the founder may reject. Your §5.7 pipeline contract governs; PRD §9 is superseded on ordering.

---

## D8 — WP6 at 1.75h: pushback accepted, and here's the guarantee

Your §1.10 flag is right — 1.75 hours is thin for the one artifact all six judges stare at for three minutes, and it's the package most likely to determine the outcome.

**Ruling: WP6 is protected. It does not absorb slip from anything else.** If a block slips, cut from kill-list items 3–5 as you proposed. If WP6 itself needs a third hour, take it from WP7 — the rationale generator is already a template and nobody in the room can tell a good template from good generation.

Two hard requirements on it, because they're the failure modes I've seen: **legible at 150% zoom on a projector from twenty feet**, and **the network panel visible during the fraud block.** Showing zero outbound requests is the closer's proof; asserting it is not.

---

## Standing instructions

- `STATUS.md` at every checkpoint. I read it instead of asking.
- Escalate immediately, don't batch: any discovery that touches the mandate design or the on-chain enforcement claim, any slip that puts the Saturday 3:00 checkpoint at risk, any verified duty rate that still breaks the demo.
- WP9 verification goes to an agent that did **not** write the artifact. This is how the PRD's arithmetic contradiction got caught and how your §7 catch happened.
- Feature freeze Saturday 9:00 PM holds. Sunday morning is two recorded takes, five slides, three timed rehearsals. Not code.
- Attend the 6–8 PM dinner. All of us.

**Approved. Staff it.**
