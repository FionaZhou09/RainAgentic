# SourcePilot demo — run of show

Keep this on a second screen. The submission video should be evidence-led and repeatable; do not create new payments or revoke anything while recording.

## T–15 minutes

```bash
cd ~/Documents/RaingenticCommerceHackathonNYC
pnpm install
CHAIN_ID=10143 pnpm dev
```

In another terminal:

```bash
CHAIN_ID=10143 \
MANDATE_REGISTRY_ADDRESS=0x9553c581d747107b2f63f9655b32153e2bfcdbf1 \
pnpm verify:claims
```

Continue only if the app header shows `Environment: Monad Testnet` and claim verification exits successfully.

## Tabs, in order

1. `SourcePilot-deck.pptx`, slide 1
2. `http://localhost:3000/compare`
3. `http://localhost:3000/approve`
4. Sanitized Rain terminal output
5. `https://testnet.monadvision.com/address/0x9553c581d747107b2f63f9655b32153e2bfcdbf1`
6. `SourcePilot-deck.pptx`, slide 5

You are showing six screen states, but only four live evidence surfaces: two app pages, one terminal result, and one Monad explorer page.

## Values to keep off-screen

- `RAIN_API_KEY`
- wallet private keys
- `.env.secrets.local`
- terminal history containing authentication headers

## Evidence checklist

### `/compare`

- Rongcheng: cheapest unit price but rejected on incomplete shipping, delivery, and specification terms.
- Hanzhou: recommended supplier.
- Deposit: exactly 30%, matching the mandate cap.

### `/approve`

- Autonomous threshold: $200.
- Sample payment: $180.
- Larger deposit: requires human approval.
- Do not submit payment during the recording.

### Rain terminal

Show only:

```json
{
  "rainSandboxAuthenticated": true,
  "endpoint": "GET /issuing/transactions",
  "httpStatus": 200,
  "transactionCount": 0
}
```

Say: “This proves live authenticated read-only sandbox connectivity. It does not prove card issuance or settlement.”

### MonadVision

Registry:

```text
0x9553c581d747107b2f63f9655b32153e2bfcdbf1
```

The contract transaction list should show:

- mandate creation: `0x6883…1688`
- spend record: `0xb690…f098`
- revocation: `0x48b5…3ded`

One list page is enough. Open an individual transaction only during Q&A.

## If something breaks

| Symptom | Response |
|---|---|
| App says “Environment not configured” | Restart with `CHAIN_ID=10143 pnpm dev`. |
| Rain returns anything other than 200 | Use the previously captured clean result and say it was recorded from the sandbox check. Do not debug on camera. |
| MonadVision is slow | Use the existing explorer screenshot or slide 4. |
| App payment endpoint is unavailable | Continue the planned non-submitting walkthrough. |
| Time is short | Keep `/approve`, Rain proof, and Monad proof; shorten the supplier comparison. |

## Q&A answers

**Is Rain live?**

> Rain sandbox authentication is live through an authenticated read-only request. Card issuance, authorization, and settlement are not integrated; payment execution uses `MockRainAdapter`.

**Is Monad live?**

> Yes. The registry and its creation, spend-recording, and revocation transactions are public on Monad testnet.

**Why not execute another payment in the video?**

> The video separates the product walkthrough from immutable proof. The existing public transactions demonstrate the live contract behavior without changing the prepared demo state.

**What happens when a payment violates the mandate?**

> The contract rejects authorization before the payment adapter is called. Tests assert zero mock-adapter calls for blocked requests.

**What is not enforced?**

> The contract cannot verify that the signed purchase-order value matches an external invoice, and supplier verification is outside this prototype.

## Final pre-recording check

- Close notifications and unrelated tabs.
- Increase browser and terminal font size.
- Hide bookmarks and personal account information.
- Confirm no secrets appear on screen.
- Record two takes.
- Keep the final video under the submission time limit.
