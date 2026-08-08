# STATUS — SourcePilot AI

**Updated:** Friday 2026-08-07 · **Checkpoint:** build-freeze day
**State:** Contract and libraries green. **Nothing user-visible exists.** Never deployed. Scope narrowed — see `SCOPE-NOW.md`.

---

## Verified, with real output

| Item | Evidence |
|---|---|
| `MandateRegistry.sol` + `IMandateRegistry.sol` | `forge test` → **24 passed, 0 failed**, including all ten named tests. Commits `5b0f0f9`, `b528df4`. |
| `lib/` — mandate, cost, score, payee, mock Rain, fixtures | ~1,950 lines with colocated tests. Cross-language digest vector pinned in `lib/mandate/__fixtures__/digest-vector.json`. |
| Toolchain | `node v22.21.1` · `pnpm 11.20.0` · `forge 1.7.1` · `cloudflared 2026.7.3` |
| Chain reachability | chainId **10143** confirmed on the primary RPC and both backups, block #50864545 |
| Secret hygiene | No private key appears anywhere in full git history. `git check-ignore .env.local` exits 0 at repo root and in `sourcepilot/`. |

## Not built

`app/api/` does not exist. `app/page.tsx` is unmodified `create-next-app` boilerplate. `contracts/broadcast/` does not exist — **the contract has never been deployed to Monad testnet**, which means there is currently no address, no explorer link, and therefore no Monad bounty argument. No demo harness. No verification pass. No D4 wallet recording.

The remaining work and its order are in `SCOPE-NOW.md` §3. The scope has been cut to three demo beats and one live screen.

---

## Blocking, in order of how little they can be compressed

### 1. Eligibility — still unresolved, still all-or-nothing

**Waived by Fiona 2026-08-03. Explicitly a decision, not a verification.** The distinction is recorded deliberately: if anyone later asks whether we checked, the honest answer is that we did not.

- **Who:** Fiona, in the manager window, Monday 2026-08-03.
- **Where it is written:** nowhere. Grepped every planning document — the only hits are the places *I* wrote "pre-building is permitted" after that exchange, each citing nothing.
- **How it arose:** it was one of three options in a multiple-choice question I authored, and it was selected. That is not an independent statement of a rule. If my option was worded optimistically, that error has been load-bearing all week.

**Residual risk:** commit timestamps Monday–Friday against a Saturday 1:00 PM start. Unmitigated by anything downstream. Fails all-or-nothing rather than gradually.

**What clears it:** a link or screenshot of the event's official rules on when code may be written, or a named organizer's written answer. **Ten minutes to ask Encode or the event Discord. It is the first item in `SCOPE-NOW.md` §3 for that reason.**

**Fallback if it fires:** the frozen contracts, briefs, and fixtures are schedule-independent and carry over whole. We would lose the build, not the thinking.

### 2. Faucet funding — gates everything on-chain

Four addresses at 0 MON. Two-hour cooldown per token. One of them is the principal's revocation key, which the closer depends on. Clicking takes a minute; waiting cannot be compressed.

⚠ **Both private keys were rendered in the terminal during WP0's `.env.local` write, and that transcript was pasted into the manager window.** These are testnet burners holding nothing, so nothing is lost — but the principal key is the D4 revocation signer, and anyone holding it could revoke mid-demo. **Regenerate before funding, not after:** two minutes now versus a two-hour cooldown per token later.

---

## Decisions worth carrying forward

**Amendment A1 — the one frozen-contract change, escalated for the record.** `record` gained `approvalSig` and `approvalNonce`. R4 was unimplementable as ruled: `PaymentApproval` carries a `nonce`, and none of the six original parameters let the contract reconstruct it, so the approval digest was uncomputable on-chain. Deriving it from `spent` was rejected — it breaks silently whenever another payment lands between signing and execution, which is the worst class of bug because it survives rehearsal. A used-nonce map prevents replay. `RecordArgs` was amended to match.

**`APPROVAL_ONCHAIN_VERIFY = true`**, set at Wednesday's gate with all ten tests green. **Contingent on the deploy landing.** If it never does, it reverts to `false` — the round-2 stage sentence claims something about a contract nobody could inspect. `DEMO-DAY-CARD.md` §4: say the round-2 sentence only if the deploy lands.

**A test-quality finding.** Mutating the EIP-712 domain name to `"SourcePilotX"` left `test_create_onTamperedMandate_revertsBadSignature` **passing** while the pin test failed. The tamper test asserts only *that* `create` reverts, and a broken encoding reverts too. The cross-language pin is the only test anchoring encoding correctness; the two are not interchangeable. Both carry comments saying so.

**Fixture principal ≠ demo principal, deliberately.** `digest-vector.json` is signed by anvil key #0 (`0xf39F…2266`); the live mandate is signed by `0x214B…29c6`. One reproducible for tests, one holding revocation authority on stage. Conflating them makes `create` reject a valid signature and look like broken digest logic.

**Environment defects found before any code was written** — `tsconfig.target` was ES2017, meaning the contracts frozen on Monday were literally uncompilable against the scaffold (BigInt literals are a hard error below ES2020); no test runner was installed at all, so no package could have reached a red phase; `viem` resolved only via workspace-root hoisting. All three fixed.

## Open with the boss

**Recommend cutting `previewConstraints()` from `INTERFACE-CONTRACTS.md` §4.** `simulateRecord` is an `eth_call` — free, instant, and it returns the contract's actual revert reason. `previewConstraints` is a second, off-chain reimplementation of the same five rules. Two implementations of one ruleset drift, and the failure mode is the UI showing "would pass" while the chain reverts — the screen contradicting the chain, in front of judges whose job is spotting exactly that.

Nothing is built against it, so the cut costs nothing. Removing a signature from a frozen contract is the boss's call. **Deferred and not being built pending a ruling** — and under the narrowed scope it will not be built regardless.
