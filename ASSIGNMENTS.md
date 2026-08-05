# ASSIGNMENTS — SourcePilot AI

**Delegation log.** Every dispatch is recorded here: package, agent, exact brief, what came back, pass/fail against done-criteria. This is how we stop two agents implementing the same interface differently.

**Binds to:** `INTERFACE-CONTRACTS.md` (frozen v1.0) · `BOSS-DECISIONS.md` (D0–D8) · `EXECUTION-PLAN.md` §2 breakdown, §6 kill list.

**Status:** briefs drafted, **zero agents dispatched**. Nothing spawns until the boss nods on `INTERFACE-CONTRACTS.md`.

---

## 0. Staffing model — superpowers, tiered (boss-approved)

Skills read from `~/.codex/skills/`. Where they conflict with the approved plan, the resolution below governs.

| Skill | How it applies here |
|---|---|
| `dispatching-parallel-agents` | **Governs the lanes.** WP1/WP2/WP4 are independent problem domains with no shared state — the skill's own criteria for parallel dispatch. Tuesday's three-lane structure stands. |
| `subagent-driven-development` | **Tiered.** Its blanket "never dispatch implementation subagents in parallel" is overridden by the boss ruling above; its review protocol is adopted per the tier table in §0.2. |
| `test-driven-development` | **Rigid, mandatory, every implementation package.** Red → verify red → green → verify green → refactor. See §0.3 for the two exception requests. |
| `verification-before-completion` | **Mandatory, and it binds me, not just the agents.** I do not report a package green to the boss on an agent's say-so. I run the check myself and paste the output into this file. |
| `using-git-worktrees` | Isolation for every parallel implementation lane, as the plan already specified. |
| `requesting-code-review` | Template for the code-quality reviewer dispatches on tier-1 packages. |
| `playwright` + `screenshot` | **WP9c evidence capture.** CLI-driven browser automation and OS-level capture. These are what turn D8's two hard requirements from assertions into artifacts. See WP9c. |

**Not adopted, deliberately:** any UX-copy or microcopy skill. D5 and D6 pinned exact wordings into `DEMO_COPY`; a copy skill's instinct is to improve them, which would silently undo a boss ruling. Listed in WP6's do-not-touch.

### 0.1 Why the parallel-dispatch override is defensible, not a shortcut

`subagent-driven-development` bans parallel implementers because they conflict — they edit the same files. Our packages are separated by the frozen interface file precisely so they don't: WP1 owns `/lib/cost`, `/lib/score`, `/lib/fixtures`; WP2 owns `/lib/mandate`; WP4 owns `/lib/rain`. Disjoint paths, one shared read-only dependency (`lib/contracts/`), worktree isolation on top. That is `dispatching-parallel-agents`' case, not the conflict case the ban exists for.

**The do-not-touch list in each brief below is what makes this true.** If an agent writes outside its path list, the override is void and I serialize the remaining lanes.

### 0.2 Review tiers

| Tier | Packages | Review |
|---|---|---|
| **1 — load-bearing** | WP2, WP3, WP5 | Implementer → **spec-compliance reviewer** (fresh agent, reads code not the report) → **code-quality reviewer**. Loop until both ✅. |
| **2 — standard** | WP1, WP4, WP6, WP7, WP8 | Implementer → spec-compliance reviewer only. Quality issues go on a list, not a loop. |
| **3 — independent** | WP9 | Not reviewed; it *is* the review. Assigned to agents that produced none of the artifacts (D-standing instruction, non-negotiable). |

Tier 1 is the critical path (WP2 → WP3 → WP5) and carries D0, the single claim the project rests on. Tier 2 is everything a bad implementation would make ugly rather than false.

**Reviewer discipline, verbatim from the skill:** the spec reviewer is told *"the implementer finished suspiciously quickly; do not trust the report; read the actual code."* No reviewer ever reviews its own package. Code-quality review never starts before spec compliance is ✅.

### 0.3 Two TDD exemptions — **both GRANTED** (R3)

`test-driven-development` is a rigid skill and its own text says exceptions require the human partner's permission. Both were granted in `BOSS-DECISIONS-R2.md` §R3.

1. **WP0 (scaffold + environment) — granted in full.** The Iron Law protects against untested logic; there is no logic here. Replaced by a binary environment checklist, **every item a command that exits 0**, with the **actual output pasted into §3 — not a checkmark**. Per the ruling: `git check-ignore .env.local` exiting 0 is a better test than any unit test would have been.
2. **WP6 (two screens) — granted, partial.** TDD holds on the rendering logic: the `RevertReason` → copy mapping, the badge state machine, and the D1 advisories-are-neutral rule. **"Total" means total** — every variant including `Unknown` and `BadApproval` has a case, asserted by a test that **fails if a variant is added without copy**.
   **Correction applied (R3):** the visual criteria are verified by **WP9c's captured screenshots**, not by a human-eye pass. The exemption granted is *TDD → captured artifact*, never *TDD → someone looked at it*.

Everything else — WP1, WP2, WP3, WP4, WP5, WP7, WP8 — is full TDD, no exceptions. **"Watched it fail first" is a line item in every report, and an agent reporting green without a red phase gets the package sent back, not a note.**

### 0.6 Scope control — structural, not exhortation (R1)

Five days of wall clock invites building past the spec. The round-1 instruction "an agent finishing early writes more tests, not more features" is an exhortation, and exhortations lose to a roomy Thursday. Per R1, it is now a rule in every brief:

> **An agent that finishes early and has no more tests to write reports `DONE` and stops. Idle is an acceptable outcome — it is a success condition, not a failure.**

**Scope growth after Monday requires boss sign-off, on the same footing as changing a locked decision.** Anything that has to be un-built on Friday costs more than the hours it filled.

### 0.4 Standing clauses attached to every implementation brief

Pasted verbatim into each dispatch, so no agent has to be trusted to remember:

- **Contracts are frozen.** `INTERFACE-CONTRACTS.md` is normative. You may not alter a signature. If you believe one is wrong, stop and report `BLOCKED` with the reason — do not work around it.
- **TDD, and I will check.** No production code without a failing test first. Your report must state, per test, that you watched it fail and why it failed. "Tests pass" without a red phase is a failed package.
- **Report format:** `DONE` | `DONE_WITH_CONCERNS` | `BLOCKED` | `NEEDS_CONTEXT`, plus what you implemented, what you tested with actual output, files changed, self-review findings, concerns. Never silently produce work you're unsure about. Escalating is not a failure — bad work is worse than no work.
- **Ask before you start.** If the brief is unclear, ask now, not after.
- **Locked decisions you may not drift from:** the LLM never computes a number that reaches a payment and never authorizes · integer minor units everywhere, never a float · cumulative spend lives on-chain, not in our DB · no PAN, CVV, or private key ever logged · no polling loops against `eth_call` (testnet caps it at 25 rps).
- **Out of scope, do not build:** x402, ERC-8004, `LiveRainAdapter`, wagmi (deleted per D4), FX normalization, a duty engine, PDF extraction, multi-agent orchestration.

### 0.4b Commit and push at every gate — standing rule

**A gate that isn't committed isn't recoverable.** When a day's gate goes green, before reporting:

1. `git status --short` — confirm nothing unexpected is staged
2. **Secret check, every time, no exceptions:** `git ls-files | grep -iE "env|secret|key"` must return only `scripts/check-env.ts` and `sourcepilot/.env.secrets.local.example`. If `.env.secrets.local` ever appears, **stop and escalate** — a key in history is not removed by deleting the file.
3. Commit with the package ID and the gate result in the subject — e.g. `WP3: MandateRegistry + 10 Foundry tests green, deployed to testnet`
4. Push to `origin main`
5. Paste the commit SHA into the report

**Friday additionally:** `git tag build-freeze` after the final gate, and push the tag. Everything after that requires a re-record.

Rationale: Thursday's integration is the day most likely to break something that was working. A tagged green commit per day means the answer to "it worked yesterday" is a checkout, not an archaeology session.

### 0.5 Model selection

Per `subagent-driven-development` §Model Selection — cheapest model that can do the job.

| Role | Model | Why |
|---|---|---|
| WP0, WP7, WP8 implementers | `sonnet` | Mechanical against a complete spec. |
| WP1, WP4, WP6 implementers | `sonnet` | Single-domain, spec is explicit to the cent. |
| **WP2, WP3, WP5 implementers** | `opus` | Cross-language EIP-712 digest, five revert conditions, and the pipeline whose ordering is the demo. Judgment, not transcription. |
| Spec reviewers | `sonnet` | Line-by-line comparison. |
| **Code-quality reviewers (tier 1)** | `opus` | Design judgment. |
| **WP9** | `opus` | Adversarial. It has to out-think six judges. |

---

## 1. Dispatch schedule

**Re-based onto `SCHEDULE-V2.md`.** The old Friday/Saturday clock is dead; nothing dispatches against a brief citing it.

| Day | Lane A | Lane B | Gate (binary — see `SCHEDULE-V2.md` §2) |
|---|---|---|---|
| **Monday** | **WP0** — scaffold + **faucets first** (2 h cooldown, 4 addresses incl. the principal's revoke key) | — | `pnpm build` 0 · `forge test` green on a testnet-deployed hello-world · `git check-ignore .env.local` 0 · 4 addresses funded · viem reads a block on primary **and** backup RPC |
| **Tuesday** | **WP2** (critical path, tier 1) | WP1 · WP4 (tier 2) | `pnpm test lib/mandate lib/cost lib/score lib/rain` green · `digest-vector.json` exists **and contains `tamperedMandate`** |
| **Wednesday** | **WP3** (critical path, tier 1) | WP7 (tier 2) | `forge test` green on all **ten** named tests · deployed to testnet, address + explorer link in `STATUS.md` · one real `record` landed with `spent` incremented · **manager decides `APPROVAL_ONCHAIN_VERIFY` here (R4 condition 4)** |
| **Thursday** | **WP5** (critical path, tier 1, **no worktree** — integration point) | WP6 starts against typed stubs | `pnpm demo:all` produces all four outcomes in order, blocked beats showing **zero Rain calls** |
| **Friday** | WP6 finishes · WP8 | WP9 (a, b, c) · **D4 wallet screen-recording** | The full Friday gate in `SCHEDULE-V2.md` §2 · `git tag build-freeze` |
| **Saturday** | *Event: 9:00 AM credentials · D2 fidelity pass (20 min) · D2 authenticated round-trip (30 min, timeboxed) · rehearsal · dinner* | | |

Serialization points: WP2 `DONE` before WP3 dispatches (digest vector). WP3 and WP1 `DONE` before WP5. WP5's contracts must exist before WP6, though WP6 may start against typed stubs on Thursday.

---

## 2. Package briefs

Each brief carries: goal in one sentence · exact files · the contract it must satisfy · done-criteria as a runnable check · what it must not touch · which rulings apply. Plus §0.4 verbatim.

---

### WP0 — Scaffold and environment · `sonnet` · no worktree · **TDD exemption requested**

**Goal.** Stand up the Next.js 15 app, Foundry, and four funded testnet addresses so no downstream package is blocked on environment.

**Files.** `sourcepilot/` (App Router, TS, Tailwind) · `sourcepilot/drizzle/` · `sourcepilot/contracts/` (Foundry) · `.gitignore` **containing `.env.local` before the first commit** · `scripts/check-env.ts`.

**Done-criteria — every line exits 0:**

```
pnpm build
forge --version && forge test           # hello-world contract, deployed to testnet
pnpm tsx scripts/check-env.ts           # asserts: 4 addresses funded with MON, viem reads a block,
                                        # backup RPC responds, chainId === 10143, cloudflared present
git check-ignore .env.local             # must exit 0. If this fails, stop everything.
```

**Must not touch.** `lib/contracts/` — those types are frozen and arrive with WP1/WP2.

**Rulings.** Faucet has a 2-hour cooldown and gates the **principal's revoke key** — this runs first, before anything else, or D4's closer has no funded signer on stage. Testnet was reset from genesis 2025-12-16; treat any contract address from an older source as suspect.

---

### WP1 — Cost, score, fixtures · `sonnet` · worktree · tier 2 · **full TDD**

**Goal.** Pure deterministic cost and scoring that reproduces the §5 supplier table to the cent, in which price cannot eliminate anyone.

**Files.** `lib/cost/index.ts` · `lib/score/index.ts` · `lib/fixtures/pr-1042.ts` · `lib/contracts/money.ts` · `lib/contracts/sourcing.ts` · tests alongside.

**Contract.** `INTERFACE-CONTRACTS.md` §1, §2, §3, §9 — attached verbatim.

**Done-criteria.** `pnpm test lib/cost lib/score` green, and these tests exist by name:

- `A landed = $5,623.00, perUnit 9.3717, deposit@5000 = $2,470.00`
- `B landed = $5,657.45, perUnit 9.4291, deposit@3000 = $1,479.00`
- `B at exactly 3000 bps passes the cap` ← `<=`, the trap that hard-blocks our own winner
- `C is incomplete, missing ["shipping"], completeness 83.3%`
- `C samplingFee 0 is stated data, not missing` ← `null` and `0` are different facts
- `landed cost never appears in hardFailures` ← **D1**
- `property: for dutyRateBps 0..10000, eliminated set is constant {A, C} and B ranks 1` ← **D1, the test that removes tariff policy from the critical path**

**Must not touch.** `lib/mandate/`, `lib/rain/`, `lib/chain/`, `contracts/`.

**Rulings.** D1 — `landedPerUnitReference` = `cents(1200)`, informational, never a gate. The LLM computes nothing here; this module is pure TypeScript with no model in the path.

---

### WP2 — Mandate, EIP-712, payee scope · `opus` · worktree · **tier 1** · **critical path** · full TDD

**Goal.** Produce the EIP-712 mandate types, hashing, signing, payee-scope scheme, and the cross-language digest vector that WP3's Foundry tests assert against.

**Files.** `lib/mandate/types.ts` · `lib/mandate/index.ts` · `lib/mandate/payee.ts` · `lib/mandate/__fixtures__/digest-vector.json` · `scripts/emit-digest-vector.ts` · tests alongside.

**Contract.** `INTERFACE-CONTRACTS.md` §4, verbatim, including the `DigestVector` shape.

**Done-criteria.** `pnpm test lib/mandate` green, with:

- sign → recover round-trip returns the signing address, with `chainId` **and** `verifyingContract` in the domain (omit either and a testnet mandate replays on mainnet)
- `computePayeeScope` produces strictly ascending leaves; `verifyPayeeScope(preimage, scope)` is true for the published preimage and false for a tampered one
- `normalizePayeeRef` — trim, NFKC, lowercase, collapse internal whitespace — is idempotent
- `hashApproval` covers all six `PaymentApproval` fields including `poValue` ← **D5**
- `scripts/emit-digest-vector.ts` writes `digest-vector.json` including **`tamperedMandate`** — one field changed, signature unchanged ← **D0's regression test, handed to WP3**

**Must not touch.** `lib/cost/`, `lib/rain/`, `contracts/`, any API route.

**Rulings.** D0 — `hashMandate` is a **local prediction only**. It is never transmitted as an input to anything. Write that in the docstring, because a downstream agent will otherwise pass it to `create`. D5 — `poValue` is in the approval payload.

**Escalate immediately if.** The digest you compute is not reproducible from the twelve fields alone. That touches the mandate design and goes to the boss, not into a workaround.

---

### WP3 — `MandateRegistry.sol` · `opus` · worktree (Foundry) · **tier 1** · **critical path** · full TDD

**Goal.** A Monad-testnet contract that recomputes the EIP-712 digest on-chain from all twelve signed fields and reverts payments that violate the signed constraints.

**Files.** `contracts/src/MandateRegistry.sol` · `contracts/test/MandateRegistry.t.sol` · `contracts/script/Deploy.s.sol`.

**Contract.** `INTERFACE-CONTRACTS.md` §5 Solidity block, verbatim. **This supersedes PRD §7.**

**Done-criteria.** `forge test` green, each of these a separately named test, each watched failing first:

- `create` on the WP2 digest vector returns exactly `expectedDigest` ← cross-language pin
- `create` on `tamperedMandate` with the unchanged signature reverts `BadSignature` ← **D0, the Farhan question as a test**
- `create` twice on the same input reverts `MandateExists` ← nonce replay
- `record` reverts on each of the five conditions **individually**
- `record` at **exactly 3000 bps succeeds** ← `<=`, pinned boundary
- `record` from a non-agent `msg.sender` reverts `NotAgent` ← closes trap 10 on-chain
- `record` with an out-of-order or non-matching `payeeSet` reverts `BadPayeeSet`
- `revoke` from a non-principal reverts `NotPrincipal`; after `revoke`, `record` reverts `Revoked`
- **D3 sequence:** with `maxTotal = 184_000`, three records of 18_000 / 147_900 / 18_000 succeed (remaining 100) and the fourth reverts `ExceedsMaxTotal`

Plus: deployed to Monad testnet, address and explorer link written to `STATUS.md`.

**Must not touch.** Anything under `lib/`. If a TS type looks wrong, report it; don't edit it.

**Rulings.** D0 — no `mandateHash` parameter on `create`, full stop. The digest is recomputed from `m`, with `keccak` of the `purpose` string per EIP-712 string encoding. **R4 — option (b) is ratified and builds Wednesday, in this package.** `record` gains `bytes calldata approvalSig`; for `stage == 1` it ecrecovers the `PaymentApproval` digest and requires `signer == principal` else `BadApproval()`. **Tenth named test, red first:** a valid approval signature over a *different* `poValueMinor` than the one passed to `record` reverts `BadApproval` — without it, (b) buys nothing it claims to buy. `APPROVAL_ONCHAIN_VERIFY` stays `false` until the Wednesday gate is green on all ten.

**Escalate immediately if.** `record` is not reverting correctly. This is a **stop-the-line** event — the entire Monad bounty argument is downstream of it.

**Time.** 2.00 h of effort, **Wednesday, with the whole day behind it.** D0 may take 45 minutes of that; those minutes stay authorized — they were never a budget concession, they were a statement about what's load-bearing. R4 adds ~45 min. Under v2 an overrun slips to Thursday morning and costs nothing.

**Wednesday gate decision, yours without escalating.** If all ten named tests are green, flip `APPROVAL_ONCHAIN_VERIFY` to `true`. If not, it stays `false` and we say the D5 sentence. **(b) is an addition to a working contract, never a repair of a broken one.** Both wordings already exist in `DEMO_COPY`, which is the entire point of deciding this now.

---

### WP4 — Rain port and mock · `sonnet` · worktree · tier 2 · full TDD

**Goal.** A `RainPort` interface and a mock adapter whose idempotency semantics make the revocation closer work rather than break it.

**Files.** `lib/rain/port.ts` · `lib/rain/mock.ts` · `lib/rain/live.ts` (throws `NotApprovedError`) · tests alongside.

**Contract.** `INTERFACE-CONTRACTS.md` §6, verbatim.

**Done-criteria.** `pnpm test lib/rain` green, with:

- same `AttemptKey` → same `paymentId`, no second effect
- **different `AttemptKey`s with byte-identical content → two distinct attempts** ← **D6, and this is the test that saves the closer**
- `newAttemptKey()` takes no arguments and cannot be derived from payment content ← type-level, assert the signature
- status advances created → submitted → settled on configured delays
- `calls` records every invocation so the harness can assert **zero calls** on blocked beats
- `LiveRainAdapter` throws `NotApprovedError` ← **D2**

**Must not touch.** Everything outside `lib/rain/`.

**Rulings.** D6 — a content-derived idempotency key returns the cached success and the closer shows "paid" instead of "reverted." That is the single most embarrassing possible failure and it is a *type error* in this design. Keep it that way. D2 — **unchanged in every particular, including that we do not build the live payment path** (extra days don't shrink a 4–6 hour trap). After **Saturday 9:00 AM** credentials, a **20-minute** fidelity pass aligns field names, minor-unit conventions, and idempotency semantics with the real API, logged here as a diff. Under v2 that is a diff against a stable, tested mock rather than a scramble. Not one minute more.

---

### WP5 — API routes and the enforcement pipeline · `opus` · **no worktree** · **tier 1** · **critical path** · full TDD

**Goal.** Three routes plus the chain client, implementing the eight-step pipeline in the exact order that makes "the contract reverted" a true sentence.

**Files.** `app/api/analyze/route.ts` · `app/api/mandate/route.ts` · `app/api/pay/route.ts` · `app/api/events/stream/route.ts` · `lib/chain/registry.ts` · `lib/events/`.

**Contract.** `INTERFACE-CONTRACTS.md` §5 (TS half) and §7, verbatim — **including the pipeline comment, which is normative and supersedes PRD §9 per D7.**

**Done-criteria.** `pnpm test app/api lib/chain` green plus `pnpm demo:all` producing, in order:

- `$180` → `autonomous`, testnet tx hash, `remaining` decremented
- `$1,479` → `pending_approval`, **`chainCalled: false`, `rainCalled: false`** ← D7, never debit the ceiling for a payment she may reject
- `$1,479` to `FRAUD_PAYEE_REF` → `blocked{layer:"onchain", reason:"PayeeOutOfScope"}` with **zero Rain calls in the log** ← the closer's proof
- revoke → retry `$180` → `blocked{reason:"Revoked"}`
- `create` returns a `mandateHash` **read back from the contract**, asserted equal to the local prediction; mismatch throws `MandateHashMismatch` ← **D0**

Ugly CLI output is a pass at this stage.

**The one way to destroy the demo, stated in the brief.** Step 2's pre-checks are exactly three: required fields, sourcing constraints (**lead time and spec match only** — D1 removed price), caller identity. **No payee scope, no amount, no deposit, no expiry, no revocation.** Those five belong to the contract. Pre-empt any of them off-chain and the line "the contract reverted" becomes false while the network panel proves the wrong thing.

**Must not touch.** `lib/cost/`, `lib/score/`, `lib/mandate/`, `lib/rain/`, `contracts/` — consume them, don't edit them. No worktree because this is the integration point; it lands on the shared branch.

⚠ **`lib/chain/registry.ts` already exists as declarations — MANAGER RULING, Tue.** WP4 could not compile Tuesday because `CreatePaymentInstruction.stage: Stage` imports from this file, which WP5 owns. Ruling: **WP2's lane creates it Tuesday containing the complete §5 declaration surface and nothing else** — `STAGE`, `Stage`, `RevertReason`, `REVERT_COPY`, `RecordArgs`, `SimulateResult`, `RecordResult`, `MandateHashMismatch`, the `RegistryClient` interface, `APPROVAL_ONCHAIN_VERIFY = false`. No implementation.

**WP5's job Thursday is to fill in the viem implementation WITHOUT altering a single declaration.** If you believe a declaration is wrong, stop and report — same rule as the frozen contracts. Declarations-only was chosen over a minimal `STAGE`-only stub because `REVERT_COPY` feeds WP6's copy mapping and `APPROVAL_ONCHAIN_VERIFY` drives `DEMO_COPY.enforcementClaim` (§8), so both need to exist before Thursday regardless — and a minimal stub would force a second crossing of the same boundary.

⚠ **Secrets path — pinned from WP0.** Keys live in `sourcepilot/.env.secrets.local`, **not** `.env.local`. Next.js auto-loads `.env.local` and will **not** auto-load this path. Load it explicitly, exactly as `scripts/check-env.ts` does. Skip this and every key reads `undefined` at runtime, which presents as "why is my signer undefined" rather than a missing-file error. Same applies to WP8's harness.

**Rulings.** D7, D6 (attempt-keyed idempotency lookup at step 1), D5 (approval field-freeze at step 4 — no field may change after approval), D0.

---

### WP6 — `/compare` and `/approve` · `sonnet` · tier 2 · **partial TDD exemption requested** · **D8-protected**

**Goal.** Two screens a judge can read from twenty feet, in which the network panel is visible while the contract blocks a payment.

**Files.** `app/compare/page.tsx` · `app/approve/page.tsx` · `components/` · `lib/contracts/copy.ts`.

**Contract.** `INTERFACE-CONTRACTS.md` §7 response types and §8 `DEMO_COPY`.

**Done-criteria.**

- `pnpm test components/` green on the testable logic: `RevertReason` → `REVERT_COPY` mapping is total (every union member has a sentence), badge state machine, and **`advisories` render in a neutral style and never as an elimination reason** (D1)
- every user-visible string that appears in `DEMO_COPY` is imported from it — **grep proves zero hardcoded duplicates**
- legible at 150% zoom in a projector-simulating window, from ten feet ← **D8 hard requirement, verified by WP9's eye, not by a test**
- **the browser network panel is visible during the blocked beat** ← **D8 hard requirement. Showing zero outbound requests is the closer's proof; asserting it is not.**

⚠ **Do not display the numeric `score` on screen — MANAGER RULING, Tue.** `DEFAULT_WEIGHTS` in `lib/score` is the implementer's choice; the frozen contract pins neither a formula nor weights. It cannot move the demo (B is the only eligible quote, so it ranks 1 under any sane weighting) — but a number on screen invites *"why is B 87.3?"*, and the honest answer is "we picked the weights," which trades a defensible screen for an arbitrary one in front of a data engineer. **Render rank and the reasons. Never the score.**

⚠ **Supplier C shows FOUR badges, not three — MANAGER RULING, Tue.** PRD §5 gives C a 100% deposit against a 30% cap, so `DEPOSIT_OVER_CAP` fires alongside `MISSING_REQUIRED_FIELD["shipping"]`, `LEAD_TIME_OVER`, and `SPEC_MATCH_UNDER`. The frozen criteria say C *"additionally carries"* the latter two — a floor, not an exhaustive list. **This is correct, not a bug. Do not "fix" it to three, and do not assert a length of 3 anywhere.**

**Must not touch.** Any `lib/` module other than importing from it. No new API routes. **Do not "improve" any string in `DEMO_COPY`** — those wordings are boss rulings D5 and D6, not drafts. No UX-copy tooling near this package.

**Rulings.** D8 — **WP6 does not absorb slip from anything.** If a block slips, I cut kill-list items 3–5. If WP6 needs a third hour, it comes from WP7. D6 — the three ratified wordings come from `DEMO_COPY`; a hardcoded "expires in sixty days" on a mandate surface is a failing check.

---

### WP7 — Agent loop and rationale · `sonnet` · worktree · tier 2 · full TDD

**Goal.** Schema-validated extraction over the fixture quotes, and a rationale template slot-filled from WP1's output that separates facts from assumptions and names what's missing.

**Files.** `lib/agent/extract.ts` · `lib/agent/rationale.ts` · tests alongside.

**Contract.** `INTERFACE-CONTRACTS.md` §7 `Rationale`.

**Done-criteria.** `pnpm test lib/agent` green, with:

- extraction output is schema-validated and rejects a malformed quote
- `renderRationale` is a **pure function of WP1's output** — a test asserts the same input yields byte-identical output
- `missingData` names Supplier C's absent `shipping` explicitly
- **no number in the rendered prose is computed inside this module** — every figure is a slot filled from `QuoteAssessment`

**Must not touch.** `lib/cost/`, `lib/score/`. It consumes their output; it never recomputes.

**Rulings.** Locked decision 1 — the LLM never computes a number that reaches a payment and never authorizes. D8 — this package is where WP6's third hour comes from if needed, and it is kill-list item 3. Build it so it can be deleted cleanly.

---

### WP8 — Fixtures and demo harness · `sonnet` · tier 2 · full TDD

**Goal.** A scripted runner that produces all four outcomes from a cold start, plus the D3 ceiling-exhaustion beat on demand.

**Files.** `scripts/harness.ts` · `scripts/sign-mandate.ts` · `package.json` scripts.

**Contract.** `INTERFACE-CONTRACTS.md` §9 `DemoHarness`.

**Done-criteria.** `pnpm demo:all` runs cold (fresh DB, fresh mandate registration) in under 3:30, and:

- `fireSample(2)` → `autonomous`, remaining $1
- `fireSample(3)` → `blocked{reason:"ExceedsMaxTotal"}` ← **D3. This is our non-circular answer to "why does this need an agent at all?" — the agent halts itself against a ceiling it did not choose. It must be runnable during Q&A, on demand.**
- `assertZeroRainCalls()` passes on both blocked beats
- `printRevokeCommand()` emits the `cast send` line for the visible terminal ← **D4**
- the mandate is pre-signed with a **prior-session (Thursday) timestamp**, visible in the UI
- harness output uses `DEMO_COPY` strings ← D6, so the screen and the boss's mouth agree

**Must not touch.** Production `lib/` modules. The harness drives them; it does not patch them.

**Rulings.** D3, D4, D6. Also **Friday**, separate and prerequisite (unchanged under v2): sign the mandate once with a real browser wallet by hand and **screen-record the wallet showing the rendered EIP-712 terms** — that recording is a demo asset and replaces the live wallet moment entirely (D4).

---

### WP9 — Verification · **`opus` ×2, neither having produced any artifact** · tier 3

Non-negotiable per standing instruction: *this is how the PRD's arithmetic contradiction and the §7 catch both happened.*

**9a — Recompute (`Explore`, read-only).** Independently recompute **every number rendered in the UI** from the rendered UI alone, without reading `lib/cost`. Report any figure that disagrees with `MANAGER-PROMPT.md`'s verified table. Juan Blanco will do exactly this and he does it for a living.

**9b — Adversarial (`general-purpose`).** Judge by judge:

- **Farhan Khwaja** — idempotency, replay, key custody. Try to make the closer show "paid." Try to register constraints the founder never signed.
- **Jarrod Watts** — delete the server's call to the contract. If anything still works, the Monad integration has regressed to a logging table and we lose the bounty argument.
- **Juan Blanco** — recompute the arithmetic; find any claim the emitted events can't substantiate.
- **Charles Yoo-Naut / Ross Basri / Siggy Bilstein** — is the abstraction right, is the behavior change real, is the SDK surface clean.

**9c — Evidence capture (`sonnet`, `playwright` + `screenshot` skills).** D8's two hard requirements are currently verified by someone squinting. This sub-package turns them into artifacts:

- drive `/compare` and `/approve` headed at 150% zoom via `playwright-cli`, capture screenshots to `output/playwright/`, and **read them** — a number that can't be read in the capture can't be read from twenty feet
- capture the network panel state during the blocked beat; cross-check against `MockRainAdapter.calls` being empty. **Two independent sources agreeing is the proof; one asserting is not.**
- capture the four outcome states as stills, which double as deck assets for Sunday

**Plus the language-discipline check (D5, D6):** grep `app/`, `lib/`, and harness output for the banned strings in `INTERFACE-CONTRACTS.md` §8. **A hit is a failing check**, not a note.

**Plus the R4 two-state check.** Assert the enforcement sentence rendered on screen and printed by the harness matches the shipped `APPROVAL_ONCHAIN_VERIFY` flag — `approvalVerified` when true, `callerAsserted` when false. A mismatch is a failing check. *The screen and the boss's mouth couldn't diverge; now the contract can't diverge from either.*

**Done-criteria.** A written report with a pass/fail per item and file:line for every defect. Runs **Friday**, in parallel with WP6 — the whole value is finding the arithmetic error while there's still time to fix it. It does not slide to the weekend.

---

## 3. Dispatch log

Nothing dispatched yet. Every row gets: timestamp · package · agent type + model · brief hash · returned status · verification command **I ran myself** with its output · pass/fail.

| # | When | WP | Agent | Status | My verification | Result |
|---|---|---|---|---|---|---|
| 9 | Tue 2026-08-04 | WP2·WP1·WP4 | Claude Code / `opus` | **TUESDAY GATE — DONE** | Agent: `vitest run lib/mandate lib/cost lib/score lib/rain` → **106 passed, 6 files, exit 0** · full suite 119 · `pnpm build` 0 · `forge test` 1 passed · install idempotent (lock `5bf05071…` unchanged). **My independent check:** `tamperedMandate` differs in **exactly one field** (`maxTotal` 184000→1840000), 12 fields, signature shared · `expectedSigner` = anvil `0xf39F…2266` as ruled · `PolicyFailureCode` union contains **no price member** (D1 enforced by compiler) · wagmi in **zero** package.json files · 7 test files present. | **PASS.** Red phase evidenced per module (`Cannot find module './payee'`, `'./index'`, `'./serialize'`, `'./port'` — each run before the module existed). **The standout is the D6 mutation test:** it re-keyed the mock by content on purpose to confirm the test has teeth, got `expected 'rain_pay_001' not to be 'rain_pay_001'` — the exact on-stage failure where the closer shows "paid" instead of "reverted" — then restored and re-verified. A test that cannot fail is worthless, and it proved this one can. D1's property test sweeps all 10,001 duty rates exhaustively and is non-vacuous (the advisory fires at 10000 bps while eliminations hold). |
| 8 | Tue 2026-08-04 | — | Manager | **Secret audit of the public repo — independently verified** | `git ls-files \| grep -iE "env\|secret\|key"` → only `scripts/check-env.ts` and `.env.secrets.local.example` · `git ls-files --error-unmatch sourcepilot/.env.secrets.local` → **not tracked** · file exists on disk at `-rw-------` · `git grep -E "PRIVATE_KEY=0x[0-9a-fA-F]{64}"` across **all** revisions → **no matches** | **PASS.** Ran against full history, not just HEAD — a key committed then deleted would still be in the objects. Nothing there. Pushed to `github.com/FionaZhou09/CommerceAgent`, HEAD `e4ccfb4`. |
| 7 | Tue 2026-08-04 | WP0 | Claude Code / `sonnet` | **`pnpm dev` fixed — genuine root cause, not a workaround** | From-scratch install with no ignored-builds error · lockfile SHA-256 **identical across two consecutive installs** · `pnpm dev` HTTP 200 from **both** repo root and `sourcepilot/` · `pnpm build` exit 0 · `forge test` 1 passed | **PASS, and the diagnosis is the valuable part.** A stray `pnpm-workspace.yaml` + `pnpm-lock.yaml` left inside `sourcepilot/` by `create-next-app` was **shadowing the real root config** — pnpm walks up from cwd and stops at the first one it finds. Two different pnpm projects were silently in play depending on which directory you ran from, which is exactly why the gate passed from root while `pnpm dev` failed from the app dir. Lockfile now pinned and idempotent. Left unfixed, this would have produced intermittent "works on my machine" failures all week. |
| 6 | Tue 2026-08-04 | WP0 | Manager | ⚠ **Downstream footgun opened — must pin before Thursday** | Secrets now live at `sourcepilot/.env.secrets.local`, **not** `.env.local`. | **Next.js auto-loads `.env.local` and will NOT auto-load this path.** `check-env.ts` loads it explicitly, so today is fine — but **WP5's API routes and WP8's harness must do the same or they get `undefined` for every key at runtime.** Failure mode is a confusing "why is my signer undefined" on Thursday's integration day, not an honest error. Pinned into the WP5 and WP8 briefs now. |
| 5 | Tue 2026-08-04 | WP0 | Claude Code / `sonnet` | **Keys regenerated — leak closed, second leak self-disclosed** | Third keypair set written without rendering key material. `git check-ignore sourcepilot/.env.secrets.local` → exit 0 · `.env.secrets.local.example` → exit 1 (tracked, as intended) · 28 lines, `-rw-------`, owned by user. Old `.env.local` deleted. | **PASS, and the disclosure is the notable part.** The second attempt leaked *again* by a different mechanism — a bash redirect to a path previously touched by the Write tool caused the editor's file-watcher to auto-inject the full diff, keys included, into the agent's context. It **flagged this unprompted** rather than patching around it, discarded that batch too, and solved it by writing to a filename the tooling had never seen. Two discarded keypair sets, both unfunded, zero cost. This is what the "report `DONE_WITH_CONCERNS`, never silently produce work you're unsure about" clause is for. |
| 4 | Tue 2026-08-04 | WP0 | Claude Code / `sonnet` | ⚠ **DONE_WITH_CONCERNS — key exposure** | The `.env.local` write was rendered in the terminal **with both private keys visible in the diff**, and the transcript was subsequently pasted into the manager window. Violates the standing rule *"never log a PAN, CVV, or private key"* (locked decision 8, restated in `CLAUDE.md`). | **Testnet burners, zero balance, nothing lost — but regenerate before funding.** The asymmetry is decisive: regenerating now costs two minutes, regenerating after funding costs a **2-hour faucet cooldown per token** on the critical path. Principal key is the D4 revocation signer; a third party holding it could revoke mid-demo. Low probability, unacceptable blast radius, free to eliminate right now. |
| 3 | Tue 2026-08-04 | WP0 | Claude Code / `sonnet` | **Scaffold green, gate incomplete** | `pnpm build` → exit 0, **Next.js 15.5.22** · `forge test` → 1 passed, 0 failed · `git check-ignore .env.local` → **exit 0 at repo root AND at `sourcepilot/.env.local`** · `check-env.ts` → chainId **10143** confirmed on primary + both backups, block #50864545, cloudflared present | **PASS on everything not gated on funding.** Four balance checks fail correctly at 0 MON — the script reports rather than crashes, as briefed. **Two good catches:** `create-next-app` installed **Next 16**, which the agent pinned back to 15 per the locked stack; and the generated `eslint.config.mjs` was broken such that lint silently never ran — fixed. Scratchpad wallet file deleted after use. |
| 2 | Mon 2026-08-03 | — | Human (local machine) | **Toolchain provisioned** | `node --version && pnpm --version && forge --version && cloudflared --version` → `v22.21.1` · `11.20.0` · `forge 1.7.1` (commit `4072e487`) · `cloudflared 2026.7.3` | **PASS.** Node upgraded 18.20.8 → 22.21.1 via nvm before WP0 rather than after — Node 18 is EOL and `better-sqlite3` / `drizzle-kit` prebuilds are the likely casualty, which would have surfaced on Wednesday's critical path. `pnpm` reinstalled under v22 (nvm scopes globals per version). **Watch item:** two `curl (56) Recv failure` resets on large downloads during setup — if `pnpm install` dies partway through, that's the cause, and the fix is a different network, not a different lockfile. |
| 1 | Mon 2026-08-03 | WP0 | `general-purpose` / `sonnet` | **BLOCKED** — environment, not the brief | **Re-ran independently, did not take the report on trust.** `command -v`: node ✅ npm ✅ git ✅ python3 ✅ · **pnpm, forge, cast, anvil, cloudflared MISSING**. `curl` to `registry.npmjs.org`, `get.foundry.sh`, `testnet-rpc.monad.xyz`, `github.com` → all **000** (exit 56, connection blocked). | **FAIL — correctly.** The agent verified it could execute the done-criteria *before* writing scaffolding, found it could not, and refused to hand back unverifiable files. That is the behaviour the brief asked for. No files created. |

---

## 4. Open with the boss

R1–R4 are applied. Contracts frozen, both redlines in, both TDD exemptions granted and recorded, R4 wording pinned two-state.

**One blocker, and it is new:** the pre-building eligibility source (`STATUS.md`). Escalated, not batched. **No dispatch until it clears** — including WP0.
