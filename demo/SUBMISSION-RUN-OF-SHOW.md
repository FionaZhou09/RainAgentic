# SourcePilot demo — run of show

The deck is now the primary recording surface. It contains the two product screens, three Monad evidence screens, and the sanitized Rain terminal proof in the correct order.

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

Continue only if the app header shows `Environment: Monad Testnet` and claim verification succeeds.

## Recording order

1. Slides 1–3: title, problem, and architecture.
2. Slide 4: supplier comparison.
3. Slide 5: payment approval boundary.
4. Slide 6: Monad contract and transaction list.
5. Slide 7: Monad spend-record transaction.
6. Slide 8: Monad revoke transaction.
7. Slide 9: sanitized Rain sandbox result.
8. Slides 10–11: proof summary and honest boundary.

Do not leave slide show mode during the main recording. Keep the live application and explorer links ready only for Q&A.

## Six evidence screens

### 1 — Compare

- Hanzhou is recommended.
- The cheapest quote fails shipping, delivery, specification, and deposit checks.
- The selected deposit is exactly the signed 30% cap.

### 2 — Approve

- Cumulative ceiling: $1,840.
- Autonomous threshold: $200.
- Deposit cap: 30% of PO value.
- Approval is required before payment side effects.
- Do not submit the form while recording.

### 3 — Monad registry

Contract: `0x9553c581d747107b2f63f9655b32153e2bfcdbf1`

The list shows mandate creation, spend recording, and revocation.

### 4 — Monad spend record

Transaction: `0xb690…f098`

Say that it is a successful public contract interaction recording spend against the mandate.

### 5 — Monad revocation

Transaction: `0x48b5…3ded`

Say that the mandate was revoked on-chain and cannot be reused.

### 6 — Rain sandbox

The cropped screenshot shows:

```json
{
  "rainSandboxAuthenticated": true,
  "endpoint": "GET /issuing/transactions",
  "httpStatus": 200,
  "transactionCount": 0
}
```

Say: “This proves live authenticated read-only sandbox connectivity. It does not prove card issuance or settlement.”

## Values to keep off-screen

- `RAIN_API_KEY`
- wallet private keys
- `.env.secrets.local`
- terminal history containing authentication headers

## Q&A links

- Product: `https://rain-agentic-sourcepilot.vercel.app/compare`
- Approval: `https://rain-agentic-sourcepilot.vercel.app/approve`
- Monad registry: `https://testnet.monadvision.com/address/0x9553c581d747107b2f63f9655b32153e2bfcdbf1`

## If something breaks

| Symptom | Response |
|---|---|
| Live app says “Environment not configured” | Use the deck screenshots; restart later with `CHAIN_ID=10143 pnpm dev`. |
| Rain returns anything other than 200 | Use slide 9 and state that it is the captured authenticated sandbox result. Do not debug on camera. |
| MonadVision is slow | Use slides 6–8. |
| Time is short | Keep slides 4–9 and slide 11; skip most of slides 2–3 and 10. |

## Q&A answers

**Is Rain live?**

> Rain sandbox authentication is live through an authenticated read-only request. Card issuance, authorization, and settlement are not integrated; payment execution uses `MockRainAdapter`.

**Is Monad live?**

> Yes. The registry and its creation, spend-recording, and revocation transactions are public on Monad testnet.

**Why not execute another payment in the video?**

> The prepared public transactions demonstrate the live contract behavior without changing the demo state or risking a failed live dependency.

**What happens when a payment violates the mandate?**

> The contract rejects authorization before the payment adapter is called. Tests assert zero mock-adapter calls for blocked requests.

**What is not enforced?**

> The contract cannot verify that the signed purchase-order value matches an external invoice, and supplier verification is outside this prototype.

## Final check

- Use the updated 11-slide deck.
- Hide bookmarks, notifications, and personal account information.
- Confirm no secret values appear on screen.
- Keep the final video under the submission limit.
- Record two takes.
