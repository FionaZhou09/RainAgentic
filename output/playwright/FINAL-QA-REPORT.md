# SourcePilot SP-12 Final QA Report

**Overall: PASS — submission-ready evidence package, subject to Fiona's separate authorization for browser-wallet recording, main merge, tag, and submission.** Those actions were not performed.

## Gate results

| Gate | Result | Evidence |
|---|---|---|
| Baseline/isolation | PASS | Detached exact `534959e0226775ba67962893a5f1c2bce12d3841`; empty initial porcelain; isolated worktree. |
| UI tests | PASS | 24/24. |
| Harness/claim/deployment tests | PASS | 38/38. |
| Full tests | PASS | 206/206 across 20 files. |
| Typecheck | PASS | `tsc --noEmit`, exit 0. |
| Lint | PASS | 0 errors, 5 warnings. |
| Production build | PASS | `/`, `/compare`, `/approve`, and four API routes built; SourcePilot title/metadata; no default Next/Vercel UI. |
| Demo harness | PASS | Ordered autonomous 18000, pending 147900, signed 147900, changed-payee `PayeeOutOfScope`, D3 ceiling, final `Revoked`. |
| Monad public claim verification | PASS | `CHAIN_ID=10143`, registry `0x9553c581d747107b2f63f9655b32153e2bfcdbf1`, 36 source/evidence records. |
| Foundry | PASS | 24/24. |
| Git/scope/audits | PASS | Remote branch equals baseline; diff check clean; exact allowlist enforced; secret/mock/domain/label/one-mandate/eight-step/zero-Rain/child audits passed. |
| Browser QA | PASS | All nine images read; no concealed horizontal overflow, overlap, stale `123300`/`411000`, numeric score, banned claim, or second visual system. |

## Public Monad evidence

- Registry: [0x9553c581d747107b2f63f9655b32153e2bfcdbf1](https://testnet.monadvision.com/address/0x9553c581d747107b2f63f9655b32153e2bfcdbf1)
- Deployment: [transaction `0x4fba…4a41`](https://testnet.monadvision.com/tx/0x4fba0104a66f37f6c5c398dbaf892395b50c6813954472c61c47333999234a41), block `52019868`.
- Mandate creation: [transaction `0x6883…1688`](https://testnet.monadvision.com/tx/0x688355e83335d003b92f5137d31bb69da815dccde398ee318e460a1654ab1688).
- Record proof: [transaction `0xb690…f098`](https://testnet.monadvision.com/tx/0xb69095e0c11d59cda4105cfaf43aaa789da3fba927d3e9e7c4d6f3f0ceb6f098), block `52019873`, `amountMinor=18000`, `spentMinor=18000`, `remainingMinor=166000`.
- Revocation: [transaction `0x48b5…3ded`](https://testnet.monadvision.com/tx/0x48b52e7b4b75cc631e3b37f4844fb606d975801a95fc06f9f94928805c393ded).

These references are prior public Monad Testnet evidence. This QA run made read-only verification calls only and did not sign or submit a transaction.

## Browser observations

- `/` redirects to `/compare`; only `/compare` and `/approve` are product screens; title is `SourcePilot`.
- Desktop `1440×900`: content grids are `1008px + 320px`; three compare cards are each `1008px`.
- Mobile `390×844`: compare content/cards are `342px`; approve content is `358px`; `clientWidth=scrollWidth=390`; long hashes wrap; submit target is 48px.
- Projector `1280×720`: CSS viewport is exactly `1280×720`; grids are `848px + 320px`; CSS zoom is `1`; transform is `none`.
- All base captures visibly say `Environment: Monad Testnet`. Approval DOM contains the six required fields: `mandateHash`, `payeeHash`, `amount`, `poValue`, `stage`, and `nonce`.
- Keyboard Tab focuses the labeled `#approval-signature` input. Landmarks, heading order, status regions, and contrast were credible on visual inspection.

## Rain waiver and simulation truthfulness

Rain is **simulated via `MockRainAdapter` only**. This package does not claim live card issuance, authorization, settlement, or readback. The approved and blocked state captures use deterministic same-origin `/api/pay` interception and are visibly labeled **SIMULATED DISPLAY FIXTURE**. The approved fixture's reference is `mock_rain_simulated_001`.

Two-source zero-Rain proof:

1. Browser observation: the blocked capture recorded only the same-origin document/framework traffic and intercepted `POST /api/pay`; there was no external Rain endpoint, Monad transaction submission, analytics, or payment third party.
2. Independent harness assertion: changed-payee `PayeeOutOfScope`, D3 `ExceedsMaxTotal`, and final `Revoked` each had `MockRainAdapter.calls=0`.

## Outcome sequence

See [demo-outcomes.txt](demo-outcomes.txt): autonomous `18000`; pending `147900`; signed `147900`; changed-payee `147900` blocked `PayeeOutOfScope`; second sample leaves `100`; third sample blocks `ExceedsMaxTotal`; final retry blocks `Revoked`.

## Artifacts

- [compare-desktop.png](compare-desktop.png), [compare-mobile.png](compare-mobile.png), [compare-projector.png](compare-projector.png)
- [approve-pending-desktop.png](approve-pending-desktop.png), [approve-pending-mobile.png](approve-pending-mobile.png), [approve-pending-projector.png](approve-pending-projector.png)
- [approve-approved-simulated.png](approve-approved-simulated.png), [approve-blocked-simulated.png](approve-blocked-simulated.png), [blocked-network.png](blocked-network.png)
- [demo-outcomes.txt](demo-outcomes.txt), [evidence.json](evidence.json), this report.

SHA-256 hashes for the nine images and sanitized demo outcome file, plus per-image route/state/viewport/geometry/classification, are in [evidence.json](evidence.json). The metadata and report omit their own hashes to avoid self-referential digests; their final hashes are reported in the executor handoff.

## Unresolved items and readiness

No SP-12 evidence blocker remains. Lint reports five non-fatal unused-variable warnings; no errors. Browser-wallet recording, main merge, tag, and submission were **not performed** and require separate Fiona authorization. No push was performed. No live Rain capability is implied.
