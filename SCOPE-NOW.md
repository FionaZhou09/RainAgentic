# SCOPE NOW — what actually ships

**Written Friday 2026-08-07.** This file supersedes the PRD's scope, the kill list in `archive/EXECUTION-PLAN.md` §6, and every hour estimate in `archive/SCHEDULE-V2.md`. Where it disagrees with the PRD, this file wins.

It exists because the plan was built for five days of runway and there is roughly one working day left.

---

## 1. The reassessment: keep the concept, cut the surface

**The concept is right and should not change.** "A procurement agent with a spending limit you can prove" is a strong fit for a challenge judged by four Rain employees and one Monad engineer. It hits the distinction the judges will actually apply — the agent *transacts* rather than advises — and the Monad integration *enforces* rather than logs, which is the difference between winning the bounty and being one of six teams that wrote a hash to a chain.

**The execution is behind, and the gap is precisely the part judges see.** Restating without softening:

| Layer | State |
|---|---|
| `MandateRegistry.sol` + 24 Foundry tests | **Done.** Green, committed. |
| `lib/` — cost, score, mandate, payee, mock Rain, fixtures | **Done.** ~1,950 lines, tested. |
| Deployed to Monad testnet | **Not done.** No `contracts/broadcast/`. No address, no explorer link. |
| `/api/pay` and the enforcement pipeline (WP5) | **Not done.** No `app/api/` directory exists. |
| `/compare` and `/approve` screens (WP6) | **Not done.** `app/page.tsx` is still `create-next-app` boilerplate. |
| Demo harness (WP8), verification (WP9) | **Not done.** |
| D4 wallet screen-recording | **Not done.** |

Sixteen planning documents, four thousand nine hundred lines of markdown, and no demo surface. The governance was good thinking — three demo-breaking defects were caught before a line of code existed, which is genuinely rare — but it consumed the hours the demo needed. Naming that plainly is the only way the next thirty hours get spent differently.

**The failure mode to avoid on Sunday is demoing an architecture diagram instead of an agent spending money.**

---

## 2. The minimum that still wins

Three beats, not four. Cut the escalation beat — `archive/EXECUTION-PLAN.md` §6 item 5 pre-authorized this, and it was always the least differentiated of the four.

1. **$180 sample executes autonomously.** On-chain `spent` decrements. This is the "it transacts" claim.
2. **$1,479 to a changed bank account is refused by the contract**, before any Rain call, with the network panel visible and empty.
3. **Revoke in a terminal → retry the $180 that worked ninety seconds ago → it reverts.**

Beat 3 is the closer and the single most important thing in the build. It is also the cheapest — it is a `cast send` and a re-run, not a feature.

**Keep the `PaymentApproval` signature even though the escalation beat is cut.** Cutting the beat costs a demo moment; cutting the signature turns approval into a database row, which is the exact flaw the design exists to escape.

**Never cut, at any hour, for any reason:** `record()` reverting on-chain · cumulative `spent` as on-chain state · live revocation · the published `payeeScope` preimage · the pre-signed prior-session mandate · integer minor units · the `<=` at 3000 bps.

---

## 3. Order of work

The ordering is not by importance. It is by *what blocks what*, and by which risks cannot be compressed by working harder.

### Before anything else — two things that are pure waiting

**A. Ask the organizers about pre-built code.** Email Encode, or ask in the event Discord. One question: *can we bring an existing repository, or must all code be written during the event?*

This is the only open item that can zero the entire weekend, and it is still unresolved. `STATUS.md` has recorded since Monday that the permission has no written source — it originated as one option in a multiple-choice question and was ratified, not verified. Commit timestamps run Monday to Friday against a Saturday 1:00 PM start. It fails all-or-nothing and nothing downstream mitigates it.

Ten minutes. Do it first. If the answer is no, the frozen contracts, briefs, and fixtures still carry over — you would lose the build, not the thinking.

**B. Start the faucets.** Four addresses, two-hour cooldown per token, one of them the principal's revocation key. Clicking takes a minute; waiting takes hours. Nothing on-chain happens until this lands.

### Then, in strict order

| # | Work | Why here |
|---|---|---|
| 1 | **Deploy `MandateRegistry` to Monad testnet.** Record address and explorer link into `DEMO-DAY-CARD.md` §2. | Blocked on the faucet. Everything on-chain is blocked on it. Without this there is no Monad bounty argument at all — the answer to Jarrod's *"what breaks if you delete the server's call to the contract?"* has to point at a contract someone can open in an explorer. |
| 2 | **WP5 — `/api/pay` and the chain client.** Fill in the viem implementation behind the existing declarations in `lib/chain/registry.ts`. | The product. Without it there is no agent, only libraries. |
| 3 | **WP8 — the demo harness**, ugly CLI output acceptable. | Proves the three beats run end to end. This is the moment the project becomes demoable, and it should happen *before* any UI work. |
| 4 | **Record a clean end-to-end run.** | Insurance. Live network failure on stage is the most common way a good project loses. Do this the moment step 3 is green, not later when it is prettier. |
| 5 | **WP6 — `/approve` only.** One screen, legible at 150% zoom, network panel visible during the blocked beat. | `archive/EXECUTION-PLAN.md` §6 item 6: `/compare` goes static — a high-res screenshot in the deck. `/approve` carries all the differentiating beats; `/compare` carries none. |
| 6 | **D4 wallet screen-recording** — the wallet showing rendered EIP-712 terms. | Ten minutes, and it replaced the live wallet moment entirely. There is no fallback if it does not exist. |
| 7 | **Saturday 9:00 AM — Rain credentials, before the keynote.** Then shape `MockRainAdapter` against the real field names and minor-unit conventions. One authenticated GET if it is cheap. | Immovable in time. Four Rain employees are judging; the mock being shaped against their actual API is the difference between evidence of comprehension and evidence of invention. |
| 8 | **Sunday 9:00–11:45** — two recorded takes, five slides, three timed rehearsals standing up. **Placeholder submission at 11:00 regardless of state.** | A submitted imperfect entry beats a perfect unsubmitted one. |

---

## 4. Cut list — already decided, do not re-litigate

| Cut | Cost |
|---|---|
| **WP7's LLM rationale generation** → hand-written template over `lib/score` output | None visible. The model was already forbidden from computing anything; the boundary claim is unchanged and still true. |
| **The escalation beat** | Loses the least differentiated of four beats. The signature stays. |
| **`/compare` as a live screen** → static screenshot in the deck | Real but survivable. |
| **SSE live log** → polled fetch or a pre-rendered log revealed line by line | Cosmetic. Nobody in the room can tell. |
| **`LiveRainAdapter`** | Already cut by D2. It was always an additive twenty-second beat. |
| **x402, ERC-8004, FX, PDF parsing, duty engine, third screen** | Already out. Listed so no agent drifts back into them. |

**Last resort, and only with sign-off:** `create`'s on-chain signature verification → server-verified. This costs a sentence of the authority story and must be stated plainly on stage if taken. It is the D0 fix, and D0 was ruled a P0. Do not take it to save an hour.

---

## 5. What "done" means tonight

Not "it compiles." A command that exits 0 with output you pasted:

```
forge test                    # 24 passed (already true)
pnpm test                     # lib + api green
pnpm demo:all                 # three beats, in order, zero Rain calls on the blocked beat
cast call <REGISTRY> ...      # against a real testnet address
```

If `pnpm demo:all` prints the three beats in order and the blocked beat shows zero Rain calls, the project is demoable and everything after that is polish. If it does not, no amount of UI helps.
