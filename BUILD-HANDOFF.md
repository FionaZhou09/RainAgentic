# Build Handoff — implementation moves to a terminal

**Why:** the Cowork sandbox has no `pnpm`, no Foundry, and no network to npm, GitHub, or any Monad RPC. Verified Monday 2026-08-03. Every package whose done-criteria is a real command is unrunnable there.

**Division of labour, unchanged in substance:**

- **This window (Cowork) is the manager.** Owns `INTERFACE-CONTRACTS.md` (frozen), `ASSIGNMENTS.md`, `SCHEDULE-V2.md`, `STATUS.md`, the gates, and every boss escalation. Does not write production code — it never was supposed to.
- **Claude Code in your terminal is the build.** Executes the briefs against a real toolchain.

Bring each day's gate result back here. I log it in `ASSIGNMENTS.md` §3 and update `STATUS.md`.

---

## Step 1 — prerequisites, on your machine

```bash
node --version          # 20+ 
npm  --version
npm install -g pnpm
curl -L https://foundry.paradigm.xyz | bash && foundryup
forge --version
brew install cloudflared          # or the equivalent for your OS
```

## Step 2 — open Claude Code in the project folder

```bash
cd ~/Documents/RaingenticCommerceHackathonNYC
claude
```

## Step 3 — paste this as the first message

> You are the implementation engineer for the SourcePilot AI build. The engineering manager is running in a separate window and owns the plan; you own the code.
>
> Read these four files in this order before doing anything:
>
> 1. `INTERFACE-CONTRACTS.md` — **frozen and normative.** You may not change a signature. If you believe one is wrong, stop and report it; do not work around it.
> 2. `ASSIGNMENTS.md` — your briefs. §0 is the working discipline, §1 is the day plan, §2 is the per-package detail.
> 3. `BOSS-DECISIONS.md` and `BOSS-DECISIONS-R2.md` — rulings D0–D8 and R1–R4. These override the PRD.
> 4. `SCHEDULE-V2.md` — the day-by-day gates.
>
> `SourcePilot-PRD-v2.md` is the spec but is **superseded in two places**: §7's contract signature (see D0) and §9's pipeline ordering (see D7). `INTERFACE-CONTRACTS.md` governs both.
>
> Start with **WP0** in `ASSIGNMENTS.md` §2. Build in `sourcepilot/`. Leave the root `.md` files alone.
>
> Non-negotiable working rules, from the manager's briefs:
>
> - **TDD on every package except WP0 and WP6's visual criteria** (exempted by ruling). No production code without a failing test first, and your report states per test that you watched it fail and why.
> - **Done-criteria are commands that exit 0. Paste the real output.** "It compiles" is not done. Neither is a checkmark.
> - **Report `DONE` / `DONE_WITH_CONCERNS` / `BLOCKED` / `NEEDS_CONTEXT`.** Escalating is not a failure; bad work is worse than no work.
> - **If you finish a brief and there is nothing left in it, stop.** Idle is a success condition. Scope growth needs boss sign-off.
> - Stay inside each brief's file boundaries — that is what makes the parallel lanes safe.
>
> Report the WP0 gate result when you have it, with pasted output.

---

## Step 4 — the human-gated items, start today

These block Tuesday and nothing can automate them:

- [ ] **Faucet, `faucet.monad.xyz`, 2-hour cooldown per token.** Four addresses need MON. **Start now** — the cooldown is the constraint, not the clicking. One of the four is the **principal's revocation key**; without it funded, D4's closer has no signer on stage.
- [ ] Both networks added to your browser wallet
- [ ] Confirm the Monad testnet explorer resolves: `testnet.monadvision.com`

Friday, but easy to forget until it's late:

- [ ] **D4 wallet screen-recording** — sign the mandate once by hand with a real browser wallet and record the wallet showing the rendered EIP-712 terms. That recording *is* the on-stage wallet moment; it replaced doing it live.

---

## What comes back to me, and when

| Day | Package | Bring back |
|---|---|---|
| Mon | WP0 | The four commands with real output, incl. `git check-ignore .env.local` |
| Tue | WP2 / WP1 / WP4 | `pnpm test` output; confirmation `digest-vector.json` contains `tamperedMandate` |
| Wed | WP3 | `forge test` on all **ten** named tests; testnet address + explorer link. **I decide `APPROVAL_ONCHAIN_VERIFY` at this gate.** |
| Thu | WP5 (+WP6 start) | `pnpm demo:all` — four outcomes in order, zero Rain calls on blocked beats |
| Fri | WP6 / WP8 / WP9 | Full Friday gate, captured screenshots, `git tag build-freeze` |

Anything touching the mandate design or the on-chain enforcement claim, any locked-decision change, or anything that changes what the boss says on stage comes to me **immediately, not batched**.

---

## Known environment traps — do not re-research, they are verified

- Monad testnet chain **10143**, RPC `https://testnet-rpc.monad.xyz`. Backups: `rpc-testnet.monadinfra.com`, `rpc.ankr.com/monad_testnet`
- **25 rps cap on `eth_call`** — no polling loops against view functions, ever. A 429 on stage is preventable and unforgivable.
- **Testnet reset from genesis 2025-12-16** — any contract address from an older source is suspect
- Testnet USDC `0x534b2f3A21130d7a60830c2Df862319e593943A3`, 6 decimals, EIP-712 domain name `"USDC"` version `"2"` — **not** `"USD Coin"`
- **Do not install wagmi.** Deleted by ruling D4. viem only.
- `docs.rain.xyz` is access-code gated — credentials come in person **Saturday 9:00 AM**, before the keynote. Everything downstream of Rain stays mock-first.
