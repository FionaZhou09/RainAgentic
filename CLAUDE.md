# CLAUDE.md — SourcePilot AI build

You are the **implementation engineer**. A manager runs in a separate window and owns the plan; you own the code.

## Authority order — higher wins when two documents disagree

1. `docs/decisions/BOSS-DECISIONS.md` · `docs/decisions/BOSS-DECISIONS-R2.md` — rulings D0–D8, R1–R4. **Override everything, including the PRD.**
2. `INTERFACE-CONTRACTS.md` — **FROZEN.** TS types and Solidity signatures.
3. `SCOPE-NOW.md` — **what actually ships.** Three demo beats, one live screen, the cut list. Supersedes the PRD's scope and every hour estimate written before Friday.
4. `docs/ASSIGNMENTS.md` — your briefs. §0 discipline, §2 per-package detail. **WP5, WP6 and WP8 are the live ones.**
5. `SourcePilot-PRD-v2.md` — the spec, **but §7 and §9 are dead** (see D0 and D7) and its scope is superseded by `SCOPE-NOW.md`.

`README.md` explains all of it. `STATUS.md` is current state. `DEMO-DAY-CARD.md` is the stage.

**`archive/` is retired. Nothing there is live — do not build against it.** `archive/INDEX.md` says why each file was retired.

## Do not

- **Change any signature in `INTERFACE-CONTRACTS.md`.** If you believe one is wrong, **stop and report it** — do not work around it. Two agents implementing the same interface differently is the failure this file exists to prevent.
- **Rebuild PRD §7's `create`.** It accepts `mandateHash` as a caller-supplied argument, which means the server could pair a genuine signature with constraints the founder never agreed to. That is the D0 bug. The digest is **recomputed on-chain from all twelve signed fields**; `mandateHash` is a return value, never an input.
- **Derive an idempotency key from payment content.** It must be a per-attempt UUID from `newAttemptKey()`. A content-derived key makes the revocation demo show "paid" instead of "reverted" — the single most damaging possible failure.
- **Add payee scope, amount, deposit, expiry, or revocation to the off-chain pre-checks.** Those five belong to the contract. Pre-empting any of them makes "the contract reverted" false on stage.
- **Install wagmi.** Deleted by ruling D4. viem only.
- **Edit any `.md` file at the repository root.** Report instead. (The owner may reorganize them; you may not.)
- Add x402, ERC-8004, FX handling, PDF parsing, a duty engine, or a third screen. All cut, deliberately.
- **Build `/compare` as a live screen, the escalation beat, or WP7's LLM rationale.** All cut Friday — `SCOPE-NOW.md` §4. `/approve` is the only live screen.
- **Build `previewConstraints()`.** Recommended for removal; `simulateRecord` already returns the contract's real revert reason, and two implementations of one ruleset drift.

## Always

- **TDD.** No production code without a failing test first. Your report states, per test, that you watched it fail and why. Exempt: WP0 entirely, and WP6's visual criteria only — both by explicit ruling, neither generalizable.
- **Done-criteria are commands that exit 0, and you paste the real output.** "It compiles" is not done. A checkmark is not output.
- **Report `DONE` / `DONE_WITH_CONCERNS` / `BLOCKED` / `NEEDS_CONTEXT`.** Escalating is not failure; bad work is worse than no work.
- **Stop when the brief is done.** If there's nothing left in it, report `DONE` and stop. Idle is a success condition. Scope growth needs boss sign-off.
- Stay inside each brief's file boundaries — that is what makes the parallel lanes safe.
- Integer minor units everywhere. `BigInt` for token math. Never a float. Never log a PAN, CVV, or private key.

## Environment — verified, do not re-research

- Monad testnet chain **10143** · RPC `https://testnet-rpc.monad.xyz` · backups `rpc-testnet.monadinfra.com`, `rpc.ankr.com/monad_testnet`
- **25 rps cap on `eth_call`** — no polling loops against view functions, ever
- Testnet **reset from genesis 2025-12-16** — any contract address from an older source is suspect
- Testnet USDC `0x534b2f3A21130d7a60830c2Df862319e593943A3`, 6 decimals, EIP-712 domain name `"USDC"` version `"2"` — **not** `"USD Coin"`
- `docs.rain.xyz` is access-code gated; credentials arrive Saturday 9 AM. Everything downstream of Rain stays mock-first.
- Toolchain: node v22.21.1 · pnpm 11.20.0 · forge 1.7.1 · cloudflared 2026.7.3

## The one thing that must stay true

**What breaks if you delete the server's call to the contract?** The answer must be *"the payment loses its authorization and the ceiling stops decrementing."* If it ever becomes *"nothing,"* the chain has regressed to an audit log and the project's central claim is gone.
