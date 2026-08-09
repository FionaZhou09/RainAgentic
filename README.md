# SourcePilot AI

**A procurement agent that spends company money inside a limit its owner signed cryptographically — enforced on-chain, revocable in one transaction.**

Rain × Monad hackathon, NYC.

**Live demo:** https://rain-agentic-sourcepilot.vercel.app
**Registry contract:** [`0x9553c581d747107b2f63f9655b32153e2bfcdbf1`](https://testnet.monadvision.com/address/0x9553c581d747107b2f63f9655b32153e2bfcdbf1) · Monad Testnet, chain 10143

**Submission provenance:** the hackathon submission build, Monad deployment, final UI, verification evidence, presentation, and recording materials were completed on August 8–9, 2026. Git history is preserved rather than backdated; earlier preparation commits remain visible where applicable.

---

## The problem

Give an AI agent a corporate card and you have two bad options. Let it spend freely and you're trusting a model with your bank account. Make a human approve everything and you don't have an agent, you have a form.

SourcePilot takes a third path: the founder signs **one** EIP-712 object — a **Procurement Mandate** — that states exactly what the agent may do.

| Field | This demo |
|---|---|
| Cumulative spending ceiling | $1,840.00 |
| Per-payment autonomous ceiling | $200.00 |
| Max deposit ratio | 30% of PO value |
| Approved payee scope | commitment over three suppliers |
| Validity window | 90 days |

That mandate is registered in a Monad contract that holds cumulative spend as **on-chain state**. Every payment calls `record()` **before** the payment processor is touched. Over the ceiling, outside the payee scope, expired, or revoked — the contract reverts and no payment happens.

**The test this design has to keep passing:** *what breaks if you delete the server's call to the contract?* The answer must be "the payment loses its authorization and the ceiling stops decrementing." If it were ever "nothing," the chain would have regressed to an audit log.

---

## Proof on Monad Testnet

Not a diagram. These are public transactions you can open right now.

| Event | Transaction | Result |
|---|---|---|
| Registry deployed | [`0x4fba…4a41`](https://testnet.monadvision.com/tx/0x4fba0104a66f37f6c5c398dbaf892395b50c6813954472c61c47333999234a41) | block 52019868 |
| Mandate created | [`0x6883…1688`](https://testnet.monadvision.com/tx/0x688355e83335d003b92f5137d31bb69da815dccde398ee318e460a1654ab1688) | digest recomputed on-chain from all twelve signed fields |
| $180 sample recorded | [`0xb690…f098`](https://testnet.monadvision.com/tx/0xb69095e0c11d59cda4105cfaf43aaa789da3fba927d3e9e7c4d6f3f0ceb6f098) | `spent` 18000 → remaining **166000** |
| Mandate revoked | [`0x48b5…3ded`](https://testnet.monadvision.com/tx/0x48b52e7b4b75cc631e3b37f4844fb606d975801a95fc06f9f94928805c393ded) | every subsequent payment reverts `Revoked` |

Principal `0x214B1e3E38453582Ea1d078c080ec1781C5c29c6` · Agent `0x0e781C29530d33657b9cA8c0A8263F5d75d5DbD4`

---

## The demo, in three beats

**1. The agent declines the cheapest supplier — on a term, not a price.**
Three quotes for 600 heavyweight cotton T-shirts. Rongcheng Garment is genuinely cheapest per unit and is refused anyway: it never stated shipping (landed cost unquotable), its lead time is 70 days against a 60-day deadline, spec match is 87% against a 90% floor, and it wants a 100% deposit against a 30% cap. Yuanfeng dies on its deposit alone. Hanzhou Apparel wins at a deposit of *exactly* 3000 bps — the boundary case, deliberately pinned.

Price alone cannot eliminate a supplier here. `LANDED_OVER_BUDGET` isn't in the failure union, so it's a compile error rather than a code-review catch. The $12.00/unit landed budget is informational and labeled as such.

**2. A payment to a changed bank account is refused by the contract — before any payment API call.**
Same supplier, same amount, one different payee reference. The contract reverts `PayeeOutOfScope`. The network panel stays empty: zero calls to the payment processor. This is the beat that separates enforcement from logging.

**3. Revoke, then retry a payment that succeeded ninety seconds ago.**
One `cast send` from the principal's key. The $180 payment that worked a minute earlier now reverts `Revoked`. Nothing was redeployed and no server restarted.

---

## What is enforced, and what is not

Being precise here matters more than sounding impressive.

**Enforced by the contract**, and it reverts on each: the cumulative ceiling · the approved-payee scope · the validity window · revocation · the deposit cap, verified against a `PaymentApproval` signature checked **on-chain**, so the PO value the ratio is measured against is one the founder signed rather than one the server asserted.

**Not enforced, and we won't claim otherwise:** no contract can check whether that signed PO value matches the real invoice. That's the remaining seam. We'd rather name it than have you find it.

**Rain sandbox connectivity is live and authenticated.** A read-only `GET /issuing/transactions` request returned HTTP 200. The sandbox account currently has zero transactions. Card issuance, authorization, and settlement are **not** integrated in this build; payment execution uses `MockRainAdapter`. The enforcement pipeline in front of it is real: on blocked requests, `MockRainAdapter.calls = 0`, asserted two independent ways.

---

## Verification

| Gate | Result |
|---|---|
| TypeScript test suite | **208 passed** across 21 files |
| Foundry contract tests | **24 passed**, including all ten named enforcement tests |
| Typecheck | `tsc --noEmit`, exit 0 |
| Production build | `/`, `/compare`, `/approve` and four API routes |
| Demo harness | six outcomes in order; zero processor calls on every blocked beat |
| Browser QA | desktop 1440×900, mobile 390×844, projector 1280×720 — no overflow at any width |

Full evidence, including nine captured screenshots: [`output/playwright/FINAL-QA-REPORT.md`](output/playwright/FINAL-QA-REPORT.md). On-chain record: [`output/monad/deployment.json`](output/monad/deployment.json).

---

## Running it

All commands run from the repository root.

```bash
pnpm install

CHAIN_ID=10143 pnpm dev    # http://localhost:3000 → /compare
pnpm test                  # 208 tests
pnpm demo:all              # the three beats, end to end

CHAIN_ID=10143 \
MANDATE_REGISTRY_ADDRESS=0x9553c581d747107b2f63f9655b32153e2bfcdbf1 \
pnpm verify:claims         # re-check the published Monad evidence

forge test --root sourcepilot/contracts    # 24 contract tests
```

`CHAIN_ID` selects the environment: `10143` Monad testnet, `31337` local Anvil. Without it the header reads "Environment not configured" rather than guessing. `AGENT_PRIVATE_KEY` is required to submit transactions and must never be committed.

---

## Architecture

```
/compare  ─ supplier analysis, policy checks, no numeric score shown
/approve  ─ mandate terms, the six signed approval fields, signature submission
    │
/api/pay ─┬─▶ off-chain sourcing checks   (lead time, spec match, completeness)
          │
          ├─▶ MandateRegistry.record()    ◀── ceiling · payee scope · window
          │   on Monad, reverts           ◀── revocation · deposit cap
          │
          └─▶ MockRainAdapter             ◀── only if the contract did not revert
```

Payee scope, amount, deposit, expiry and revocation are deliberately **absent** from the off-chain pre-checks. Pre-empting any of them would make "the contract reverted" false. Idempotency keys are per-attempt UUIDs, never derived from payment content — a content-derived key would make the revocation beat show "paid" instead of "reverted."

Integer minor units throughout. `BigInt` for token math. Never a float.

**Key modules:** `sourcepilot/contracts/src/MandateRegistry.sol` · `sourcepilot/lib/mandate` (EIP-712 digest, cross-language vector pinned in `__fixtures__/digest-vector.json`) · `sourcepilot/lib/score` · `sourcepilot/lib/cost` · `sourcepilot/lib/chain/registry.ts` · `sourcepilot/app/api/pay`

---

## Repository structure

```text
demo/         submission deck, PDF, recording script, and run-of-show
output/       verified Monad deployment data and browser QA evidence
scripts/      deployment, signing, demo, and claim-verification tools
sourcepilot/  Next.js application, policy engine, Rain adapter, and contracts
```

The frozen cross-layer types and contract signatures are documented in [`INTERFACE-CONTRACTS.md`](INTERFACE-CONTRACTS.md). Recording instructions are in [`demo/SUBMISSION-VIDEO-SCRIPT.md`](demo/SUBMISSION-VIDEO-SCRIPT.md).
