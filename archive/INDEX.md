# Archive — retired documents

**Nothing in this folder is live.** Do not build against anything here. Each file is kept because it records a decision or a verification that would be expensive to reconstruct, not because it still governs.

Retired Friday 2026-08-07 during the pre-event consolidation.

| File | Why it was retired | What replaced it |
|---|---|---|
| `01-project-ideas.md` | The shortlist did its job — SourcePilot was chosen over five alternatives on Monday. Keeping it at root invited an agent to re-open a settled question. | `SourcePilot-PRD-v2.md` |
| `02-technical-prep-brief.md` | Pre-research. The only parts still load-bearing were the verified environment facts — chain ID, RPCs, USDC address and EIP-712 domain, faucet cooldown — and those are pinned in `CLAUDE.md` where every session auto-loads them. The x402 and ERC-8004 sections describe work that was deliberately cut. | `CLAUDE.md` § Environment |
| `EXECUTION-PLAN.md` | §3–§5 were already declared dead (superseded by `SCHEDULE-V2` and `INTERFACE-CONTRACTS`). §1's assumption check and §2's breakdown are history now that the work is mostly done. §6's kill list was the one live section and has been carried forward, re-costed against the hours that actually remain. | `SCOPE-NOW.md` §4 |
| `SCHEDULE-V2.md` | The five-day build week it planned is over. Its gates were Monday–Friday; it has nothing to say about the weekend. | `SCOPE-NOW.md` §3 |
| `BUILD-HANDOFF.md` | The handoff it describes already happened — implementation moved to a terminal on Monday and has stayed there. | — |
| `MANAGER-PROMPT.md` | One of three overlapping manager prompts. The longest, and the most stale — it states the clock as "hacking opens Sat 1:00 PM" and predates every ruling from R1 onward. | `docs/prompts/resume-manager.md` |
| `sourcepilot-manager-prompt.md` | Second of the three. Duplicated the operating brief with different wording, which is exactly the drift the authority order exists to prevent. | `docs/prompts/resume-manager.md` |
| `REVIEW-REQUEST.md` | Round-2 review request. Answered in full by `BOSS-DECISIONS-R2.md`. | `docs/decisions/BOSS-DECISIONS-R2.md` |

## What was *not* archived, and why

- **`INTERFACE-CONTRACTS.md`** — frozen and still binding. The Solidity is deployed-shaped and the TS declarations are what the unbuilt packages must fill in.
- **`DEMO-DAY-CARD.md`** — the only document that matters at 3:15 PM Sunday.
- **`docs/decisions/`** — the rulings are applied, but they are also the record of *why* the design is shaped this way. Every hard judge question in the demo card traces to one of them.
- **`docs/demo-script.md`** — Part 3's three-minute script and Part 5's judge questions are needed Sunday morning. Parts 1–2's hour-by-hour is stale; read it for the script, not the clock.
