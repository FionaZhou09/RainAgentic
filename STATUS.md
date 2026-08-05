# STATUS — SourcePilot AI

**Updated:** Monday, schedule v2 · **Current checkpoint:** Monday gate (not yet started)
**State:** Plan **approved with rulings D0–D8**. Interface contracts amended and frozen. Assignment briefs drafted. **Schedule replanned to a five-day build** — see `SCHEDULE-V2.md`. **Zero agents dispatched, no code written.**

## Schedule change

Build finishes **Friday night**, not Saturday 9 PM. Saturday is Rain credentials, the D2 work, and rehearsal; Sunday is unchanged. Pre-building confirmed permissible.

Consequences: the zero-slack Saturday critical path is gone · WP3 gets a day instead of two hours, so D0's authorized 45 minutes are unremarkable · faucet cooldown is off the critical path · **D8's protection of WP6 is moot** — nothing competes for its hours · kill-list items 3–5 are unlikely to fire but stay on the list.

**The risk inverts:** it is no longer "we run out of time," it is "we build past the spec." Every brief now says that an agent finishing early writes more tests, not more features.

---

## Green

- **`BOSS-DECISIONS.md` read and applied.** All nine rulings are reflected in the frozen contracts, not just noted.
- **`INTERFACE-CONTRACTS.md` v1.0 written** — supersedes `EXECUTION-PLAN.md` §5 and PRD §7 (D0) and §9 (D7). Amendment log in the header.
- **`ASSIGNMENTS.md` written** — nine package briefs, each with goal, exact files, contract, runnable done-criteria, do-not-touch list, and applicable rulings.
- **Superpowers skills adopted** (`~/.codex/skills/`), tiered per boss ruling — see `ASSIGNMENTS.md` §0.

**Design changes worth noting, beyond transcribing the rulings:**

- **D0** is now enforced by shape, not vigilance: `create(MandateInput, sig) returns (bytes32)`. No hash parameter exists anywhere. The TS client reads the hash back from the contract and throws `MandateHashMismatch` if ours disagrees. `tamperedMandate` added to the digest-vector fixture, so "valid signature, one field changed → `BadSignature`" is a permanent Foundry test.
- **D1** required a type change, not a constant change. `LANDED_OVER_BUDGET` is deleted from `PolicyFailureCode` and reborn as an `AdvisoryCode` in a separate field. **The compiler now enforces that price eliminates nobody.** Pinned as a property test over all duty rates 0–100%.
- **D6** is a type: `AttemptKey` is constructible only via `newAttemptKey()`, which takes no arguments. Deriving an idempotency key from payment content is now a compile error rather than a code-review catch.
- **D4** removed wagmi from every surface. `revoke` is gone from `RegistryClient`, replaced by `revokeCommand(): string`. Our server structurally cannot revoke — which is the point of the closer.
- **D5's** language discipline lives in one `DEMO_COPY` module imported by both WP6 and WP8, with a banned-string grep as a WP9 failing check. The screen and the boss's mouth cannot diverge.

Verified, not built: the §5 supplier table — all 24 derived figures reproduce exactly.

## At risk

- **Saturday critical-path slack is still zero.** WP3 + WP5 + WP8 = 4.50 h against 4.50 h of window. The 9 PM–midnight block is the only reserve, and D5's on-chain approval verification has first call on it.
- **WP3 overrunning 1:00–3:00** — on-chain EIP-712 digest reconstruction, now carrying D0's 45 authorized minutes. Mitigation is in place: WP2 emits the cross-language digest vector Friday and WP3's Foundry test asserts against it, so a mismatch fails red at 1:20 PM instead of inside `/api/pay` at 3:45.
- **Faucet cooldown (2 h) gates the principal's revoke key.** WP0 runs first Friday or D4's closer has no funded signer on stage.
- **Tiered review adds ~5 reviewer dispatches on the critical path.** Judged worth it on WP2/WP3/WP5; if the 1:00 checkpoint is late, the tier-1 code-quality pass on WP5 is the first thing I drop.

## R1–R4 applied

Round-2 rulings are in the files. Round-1 blockers are cleared.

| Ruling | Applied |
|---|---|
| **R1** schedule v2 ratified | `ASSIGNMENTS.md` §1 re-based to the Mon–Fri day plan; every stale clock reference removed (grep clean). Scope control made structural in new §0.6: **an agent that finishes early and has no more tests to write reports `DONE` and stops. Idle is a success condition.** Scope growth after Monday needs boss sign-off. |
| **R2 Redline 1** | `mandateExpiryLabel` → **"Expires in ninety days"**. Contradictory docstring rewritten to state why. **`expires at the end of the month` added to the banned-string grep.** Label mechanism chosen over changing `validUntilOffsetDays`, per your preference — the mandate is signed in a prior session, so a date-relative label can't stay true. |
| **R2 Redline 2** | §7 step 4 pinned in the pipeline comment: **not a demo beat, no script line depends on it.** Kept as defense in depth alongside the on-chain check. One blocked-by-contract beat, and it stays the changed payee. |
| **R3** | Both exemptions recorded as **GRANTED** in `ASSIGNMENTS.md` §0.3, with your correction: WP6's visual criteria go to **WP9c captured screenshots**, not a human-eye pass. "Total" now means a test that **fails if a `RevertReason` variant is added without copy** — `Unknown` and `BadApproval` included. |
| **R4** | `DEMO_COPY.enforcementClaim` is now a function of `APPROVAL_ONCHAIN_VERIFY`: false → the D5 sentence verbatim, true → the round-2 sentence copied exactly. **Flag left `false`.** WP9 asserts the shipped string matches the shipped flag. WP3 gains a tenth named test — valid approval signature over a *different* `poValueMinor` reverts `BadApproval`. Both `enforces the 30%` forms stay banned. The autonomous-path residual is recorded in `INTERFACE-CONTRACTS.md` §5. |

## Eligibility — **WAIVED by Fiona, 2026-08-03. Not verified.**

**This is a decision, explicitly not a verification.** The distinction is recorded deliberately: if anyone later asks whether we checked, the honest answer is that we did not — we chose to proceed knowing we hadn't. The finding below stands unchanged.

**Standing offer, unprompted:** if a rules page, organizer email, or Discord reply surfaces at any point this week, tell me and I'll replace this waiver with a verified source. It costs nothing and it retires the only unquantified risk on the board.

### The finding, unchanged

**Pre-building eligibility has no written source. I could not verify it, so I am not recording it as verified.**

You asked for who said it, where it's written, and the date. Honestly:

- **Who:** Fiona, in the manager window, **Monday 2026-08-03**.
- **Where it's written:** nowhere. I grepped all ten planning documents — the only hits are the three places *I* wrote "pre-building is permitted" after that exchange, each of which cites nothing. `MANAGER-PROMPT.md` line 49 states the clock as "Hacking opens Sat 1:00 PM" and is silent on when code may be written.
- **How it arose:** it was **one of three options I wrote in a multiple-choice question, and it was selected.** That is not an independent statement of a rule. It is my own phrasing, ratified. If my option was worded optimistically, that error is now load-bearing for the entire schedule.

**This is exactly the case you described — a rule remembered from a conversation, not read off a page — and it is worse than that, because the conversation was one I framed.** Per your instruction and my own, escalating rather than proceeding.

**What would still clear it:** a link or screenshot of the event's official rules covering when code may be written, or a named organizer's written answer.

**Residual risk, carried knowingly.** If the rule turns out to be "built during the event," the exposure is git history — commit timestamps Mon–Fri against a Saturday start. It is not mitigated by anything we do downstream, and it fails all-or-nothing rather than gradually. **The fallback if it ever fires:** `EXECUTION-PLAN.md` §4's original weekend schedule is intact and needs no rework, and the frozen contracts, briefs, and fixtures are schedule-independent — they'd carry over whole. We would lose the build, not the thinking.

## Blocked on boss — **STOP THE LINE. Environment, not plan.**

**WP0 dispatched Monday and came back BLOCKED. The build toolchain does not exist in this sandbox and cannot be installed.** Verified independently, not taken on the agent's word:

- **Missing and uninstallable:** `pnpm`, `forge`, `cast`, `anvil`, `cloudflared`
- **Present:** `node`, `npm`, `git`, `python3`
- **Network:** `registry.npmjs.org`, `get.foundry.sh`, `github.com`, and **all three Monad RPCs** return `000` / connection blocked

**This is not a WP0 problem. It blocks WP0, WP3, WP5, WP8, and WP9c** — every package whose done-criteria is a command that has to actually run. No npm registry means no Next.js, no viem, no Drizzle. No Foundry means no contract. No Monad RPC means no deploy, no `record` transaction, no explorer link — which is the Monad bounty argument.

**The agent behaved correctly and I want that on the record.** It checked whether it could execute the done-criteria *before* writing scaffolding, found it couldn't, and refused to hand back files it couldn't verify. Under the old "it compiles" standard we'd have a plausible-looking repo that fails on first run Tuesday. This cost two minutes instead of a day.

**Resolved same day.** Implementation moves to **Claude Code in a terminal**, where the toolchain and network already work. This window stays the manager and keeps the contracts, briefs, gates, and escalations. See `BUILD-HANDOFF.md`.

That was always the intended shape — the manager brief says *"do not write production code yourself."* The sandbox limit forced the split earlier than expected; it did not change the plan. **The Friday deadline is unaffected**, provided the faucets start today.

Taken on my own authority, flagged rather than asked: renamed `maxLandedPerUnit` → `landedPerUnitReference` so no agent can mistake it for a gate, and added `tamperedMandate` to the digest-vector fixture.

## Toolchain — GREEN, verified Mon 2026-08-03

`node v22.21.1` · `pnpm 11.20.0` · `forge 1.7.1` · `cloudflared 2026.7.3`

Node upgraded 18.20.8 → 22.21.1 before WP0 rather than after. Node 18 is EOL; the likely casualty would have been `better-sqlite3` / `drizzle-kit` native prebuilds, surfacing as a build failure on **Wednesday's critical path**. Five minutes now instead of hours on the worst day.

**Watch item:** two `curl (56) Recv failure` connection resets on large downloads during setup. If `pnpm install` dies partway through this week, that is the cause — the fix is a different network, not a different lockfile.

## WP0 — Tuesday. Scaffold green, gate blocked on faucet.

**Passing, with real output:** `pnpm build` exit 0 (Next.js **15.5.22**) · `forge test` 1 passed 0 failed · `git check-ignore .env.local` exit 0 at **both** repo root and `sourcepilot/` · chainId **10143** confirmed on primary and both backup RPCs, block #50864545 · cloudflared present.

**Blocked:** four addresses at 0 MON. Faucet funding is the only outstanding item, and it gates Tuesday's lanes.

**Two good catches by the build agent**, both worth recording: `create-next-app` installed **Next 16**, pinned back to 15 per the locked stack — an unnoticed major-version drift would have surfaced as strange failures later in the week. And the generated `eslint.config.mjs` was broken in a way that made lint *silently never run*, which is worse than lint failing.

### ⚠ Open item — private keys were displayed, regenerate before funding

The `.env.local` file write rendered **both private keys in the terminal**, and the transcript was pasted into the manager window. That breaks the standing rule *"never log a PAN, CVV, or private key."*

These are testnet burners holding nothing, so nothing is lost. **But regenerate now, before funding.** The asymmetry decides it: two minutes today versus a **2-hour faucet cooldown per token** if we regenerate after funding — on the critical path. The principal key is the D4 revocation signer; anyone holding it could revoke mid-demo. Low probability, high blast radius, free to eliminate at this exact moment and expensive at any later one.

## Open with boss — recommend cutting `previewConstraints` from §4

Raised Tuesday, from WP2's lane. **`previewConstraints()` is redundant and I recommend removing it from the frozen contract.**

`simulateRecord` is an `eth_call` — free, instant, and it returns the contract's *actual* revert reason. `previewConstraints` is a second, off-chain reimplementation of the same five rules. Two implementations of one ruleset drift, and the failure mode is the UI showing "would pass" while the chain reverts — the screen contradicting the chain, in front of judges whose job is spotting exactly that.

I put it in §4 on Monday and I think I was wrong. It is not in WP2's done-criteria, so nothing is built yet and the cut costs nothing today. **Deferred and not being built pending your ruling.** Removing a signature from a frozen contract is your call, not mine.

## Environment defects found by WP2's lane — authorized, all real

Found in plan mode before any code was written:

1. **`tsconfig.target` was ES2017.** BigInt literals (`184_000n`) are a hard TS error below ES2020 — meaning **the contracts frozen on Monday were literally uncompilable against the scaffold.** Bumped to ES2020.
2. **No test runner installed at all.** TDD is mandatory on every package today; no runner means no red phase, so no package could have passed its done-criteria. Vitest added.
3. **`viem` resolved only via workspace-root hoisting**, not declared in `sourcepilot`. Same class of bug as the shadow `pnpm-workspace.yaml`. Now declared explicitly.

**Manager ruling, same round:** `lib/chain/registry.ts` is created Tuesday as **declarations only** — WP4 could not compile without `Stage`, which WP5 owns until Thursday. My sequencing error, not a contract change. Details in `ASSIGNMENTS.md` WP5.

**Fixture principal ≠ demo principal.** `digest-vector.json` is signed by anvil key #0, so its `principal` is `0xf39F…2266`. The live mandate is signed by `0x214B…29c6`. Two different keys deliberately — one reproducible for tests, one holding revocation authority on stage. Conflating them makes `create` reject a valid signature and look like broken digest logic.

## Next action — two things, today, in this order

1. **Start the faucets. Now, before anything else.** `faucet.monad.xyz`, **2-hour cooldown per token**, four addresses, one of them the principal's revocation key. The cooldown is the constraint — clicking takes a minute, waiting takes hours, and it gates Tuesday. This is the single highest-value thing that can happen in the next five minutes.
2. **Open Claude Code in the project folder** and paste the bootstrap prompt from `BUILD-HANDOFF.md` §3. It starts on WP0.

Bring each day's gate output back here. I log it in `ASSIGNMENTS.md` §3 with the command and its result, and update this file.

**Deadline: build frozen Friday night.** Five days for 11 hours of effort, one package per day with a full day of float behind each. It holds — as long as the faucets start today.
