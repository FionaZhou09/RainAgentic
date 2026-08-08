# Boss Decisions — round 2

**Date:** 2026-08-03 · **Re:** `REVIEW-REQUEST.md` (R1–R4) · **Status:** R1 ratified · R2 frozen **with two redlines** · R3 both granted · R4 **option (b)**, wording supplied below

Read the four files in the order you gave me. The contracts are better than the rulings that produced them — D1 as a type change and D6 as a non-constructible key are both improvements on what I asked for, and I want that noted. Two redlines on §5/§8 before the freeze is real, one of which is a live falsehood on screen.

---

## R1 — Schedule v2 ratified

Ratified. Five-day build, Friday-night freeze, Saturday for credentials + D2 + rehearsal, Sunday unchanged.

**Consequences I'm confirming, so nobody has to infer them:**

- **D8's scheduling protection is moot; D8's two hard requirements are not.** Legible at 150% zoom from twenty feet, and the network panel visible during the fraud block. Those were never about hours. They now get verified by captured artifact (WP9c) instead of by my eye, which is strictly better — keep it that way even though we have time to eyeball it.
- **D2 is unchanged in every particular**, including that we do not build the live payment path. You anticipated the argument correctly: extra days don't shrink a 4–6 hour trap. The mock-fidelity pass becoming a diff against a stable mock is a real gain and I'll take it.
- **D0's 45 authorized minutes stay authorized.** They were never a budget concession; they were a statement about what's load-bearing.
- **Kill list stays. Agreed, and not as a formality.**

**One thing I want before Monday opens, and it is not a formality.** "Pre-building is permitted" is now load-bearing for the entire schedule — if it's wrong, we are disqualified rather than late. Put the source in `STATUS.md`: who said it, where it's written, and the date. A rule read off a page beats a rule remembered from a conversation. If it turns out to be ambiguous, tell me immediately; that is an escalate-don't-batch item.

**On the inverted risk — I'll hold the line, and here's the line.** The instruction "an agent finishing early writes more tests, not more features" is right but it's an exhortation, and exhortations lose to a roomy Thursday. Make it structural: an agent that finishes early and has no more tests to write reports `DONE` and **stops**. Idle is an acceptable outcome. Scope growth after Monday requires my sign-off, same as a locked-decision change. Anything I have to un-build on Friday costs more than the hours it filled.

---

## R2 — §5 and §7 frozen, subject to two redlines

Freeze granted on §7 as written. The pipeline ordering is correct, and the `rainCalled: false` literal on every blocked variant is exactly the right instinct — the compiler enforcing the stage claim is the same move as D1 and D6, and it's the pattern I want everywhere it's cheap.

Both items you took on your own authority are approved. `landedPerUnitReference` is a better name than mine and closes the same hole D1 closed. `tamperedMandate` in the fixture is the Farhan question as a test that runs, which is worth more than the answer I'd have given him.

### Redline 1 — §8 says something false about a signed field. Fix before freeze.

`DEMO_COPY.mandateExpiryLabel` is `"Expires at the end of the month"`. §9 sets `validUntilOffsetDays: 90`. Signed today, that mandate expires around **1 November**, not 31 August.

This is not a copy nit. `validUntil` is one of the twelve signed fields, it renders in the wallet EIP-712 screen-recording we're showing on stage (D4), and it's readable on the explorer. We would be putting a false statement on screen next to the artifact that disproves it, in a demo whose entire thesis is that the claim and the chain agree.

My D6 wording was chosen to avoid colliding with delivery's "sixty days." Two distinct numbers with distinct labels don't collide; a false one does.

**Ruling:**

- `mandateExpiryLabel: "Expires in ninety days"`
- `deliveryDeadlineLabel: "Delivery within sixty days"` — unchanged
- Add **`expires at the end of the month`** to the banned-string grep. It was my wording and it is now wrong; ban it so it can't drift back in.
- Fix the §8 docstring, which already says "90 days" while the label says otherwise — the contract file contradicts itself in adjacent lines.

If you'd rather set `validUntilOffsetDays` so "end of the month" becomes true, that's also acceptable — but then it must be true on the day we sign, and the mandate is signed in a prior session, so I prefer the label change. Your call on mechanism; the constraint is that the screen matches the signed field.

### Redline 2 — §7 step 4 must not acquire a demo beat

Step 4 (approval fields match the request exactly) is correct and stays. But it produces `blocked{layer:"offchain"}`, and once R4 ships, the same condition is also checkable on-chain. Keep both — defense in depth is right here — and pin this: **step 4 is not a demo beat and no script line depends on it.** We have exactly one blocked-by-contract beat and it is the changed payee. Adding a second "blocked" flavor to the run of show dilutes the one that's carrying the argument.

Everything else in §5 stands as written. The Solidity block is frozen.

---

## R3 — Both exemptions granted

**WP0: granted, in full.** The Iron Law protects against untested logic; there is no logic here. The binary checklist is the stronger control anyway — `git check-ignore .env.local` exiting 0 is a better test than any unit test would have been. Every item stays a command that exits 0, and the output goes in `ASSIGNMENTS.md`, not a checkmark.

**WP6: granted, partial, as you scoped it.** TDD holds on the revert-reason→copy mapping (and I want *total* to mean total — every `RevertReason` including `Unknown` and `BadApproval` has a case, asserted by a test that fails if a variant is added without copy), the badge state machine, and the D1 advisories-are-neutral rule.

**One correction:** `ASSIGNMENTS.md` §0.3 still routes WP6's visual criteria to "WP9's human-eye pass at 6:00 PM." Under v2 that's WP9c's captured screenshots. Update it. The exemption I'm granting is *TDD → captured artifact*, not *TDD → someone looked at it*.

The other seven packages are full TDD and "watched it fail first" stays a line item. An agent that reports green without a red phase gets the package sent back, not a note.

---

## R4 — Take option (b). Ship it Wednesday. Wording below.

**(b), and your caution is right, which is why the new sentence has to be built to survive it.**

**Why not (c).** (c) is the safe-looking option and it's the worst of the three. Standing in front of Farhan and Juan saying "the deposit ratio is asserted by the caller" while the contract in the repo ecrecovers an approval signature to check it means either nobody reads the code — in which case we wasted 45 minutes — or somebody does, and the most precise-sounding team in the room turns out not to know what its own contract does. Understatement is not a free option when the artifact is public. Precision cuts both ways or it isn't precision.

**Why not (a).** The seam is real and the fix is 45 minutes with a full day of float behind it. "We knew how to close it and didn't" is a worse answer than either version of the claim.

**What (b) actually buys, stated exactly** — because this is where the new wording has to be careful. Verifying the approval on-chain binds `poValueMinor` to a signature from the principal that the contract itself checks. It does **not** make the PO value *true*. No contract can know what the supplier's real invoice says. So the honest upgrade is: the number the ratio is computed against went from *our server asserted it* to *the founder signed it and the chain checked her signature*. That is a genuine, nameable improvement, and it is not "the contract enforces everything."

### The ratified sentence, effective when (b) ships

> "The contract enforces the ceiling, the payee scope, the time window, and revocation. On this payment it also enforces the deposit cap — it checks the founder's approval signature on-chain, so the PO value the ratio is measured against is one she signed, not one our server asserted. What no contract can check is whether that PO value matches the real invoice. That's the remaining seam, and I'd rather name it than let you find it."

Five of five enforced, one dependency named. The last clause is the asset — it is the same move that made the D5 sentence work, and it survives the upgrade intact.

**And keep the residual on the record**: for a payment *below* `autonomousMax` there's no approval to check, so `poValue` there is still caller-asserted. It doesn't belong in the stage sentence — every deposit in our demo is escalated — but if anyone asks "what about the autonomous path," the answer is that one sentence, said without flinching.

### Execution conditions

1. **Wording is decided now, not after.** You asked for that and you were right. The sentence above goes into `DEMO_COPY` before WP3 dispatches Wednesday.
2. **Two-state copy, and the code decides which.** `DEMO_COPY.enforcementClaim` becomes a function of `APPROVAL_ONCHAIN_VERIFY`: flag false → the D5 sentence verbatim, flag true → the sentence above. WP9 asserts the shipped string matches the shipped flag. The screen and my mouth couldn't diverge; now the contract can't diverge from either.
3. **The banned-string grep is unchanged.** `enforces the 30%` and `enforces the thirty percent` stay banned even after (b) ships. The new sentence never uses that phrasing, and I want the bare unqualified form structurally unsayable.
4. **The abort condition.** If Wednesday's WP3 gate isn't green on all nine named tests, `APPROVAL_ONCHAIN_VERIFY` stays false and we say the D5 sentence. (b) is an addition to a working contract, never a repair of a broken one. That decision is yours to make at the Wednesday gate without asking me — the wording for both states already exists, which is the whole point of doing this now.
5. **New test, red first:** a deposit with a valid approval signature over a *different* `poValueMinor` than the one passed to `record` reverts `BadApproval`. Without it, (b) buys nothing it claims to buy.

---

## One thing to fix before Monday opens

`ASSIGNMENTS.md` §1's dispatch table is still on the old schedule — "Fri, first," "Sat 1:00–3:00," "Sat 4:30." The briefs beneath it reference checkpoints that v2 deleted. An agent reading its brief on Wednesday will be told to hit a Saturday 3:00 gate that no longer exists.

Re-base §1 and every in-brief time reference onto v2's day plan before the first dispatch. Nothing spawns against a brief that cites a dead clock.

---

## Standing instructions — unchanged, with one addition

Round 1's standing instructions all hold. `STATUS.md` at every gate. WP9 assigned to agents that wrote none of the artifacts. Escalate immediately, don't batch. Attend the dinner.

**Added:** scope growth after Monday needs my sign-off, on the same footing as changing a locked decision. Finishing early and stopping is a success condition.

---

**R1 ratified. R2 frozen pending the two redlines. R3 both granted. R4 is (b), with the sentence above. Open the lane.**
