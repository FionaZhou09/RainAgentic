# SourcePilot submission video — 3:00

This recording uses six screen states: two slides, two app pages, one sanitized Rain terminal result, and one MonadVision transaction page. Record the narration as voiceover. Do not expose environment variables, API keys, wallet keys, or raw request headers.

## Before recording

1. Start the app:

   ```bash
   cd ~/Documents/RaingenticCommerceHackathonNYC
   CHAIN_ID=10143 pnpm dev
   ```

2. Open these tabs in order:
   - slide 1 of `SourcePilot-deck.pptx`
   - `http://localhost:3000/compare`
   - `http://localhost:3000/approve`
   - a clean terminal containing only the Rain summary below
   - `https://testnet.monadvision.com/address/0x9553c581d747107b2f63f9655b32153e2bfcdbf1`
   - slide 5 of `SourcePilot-deck.pptx`

3. Prepare the Rain proof before recording. Never show the command containing the API header:

   ```bash
   clear
   status=$(curl -sS -o /tmp/rain-transactions.json -w '%{http_code}' \
     -H "Api-Key: $RAIN_API_KEY" \
     "$RAIN_API_BASE/issuing/transactions")

   jq --arg status "$status" '{
     rainSandboxAuthenticated: ($status == "200"),
     endpoint: "GET /issuing/transactions",
     httpStatus: ($status | tonumber),
     transactionCount: length
   }' /tmp/rain-transactions.json
   ```

4. Confirm the Rain output says `rainSandboxAuthenticated: true` and `httpStatus: 200`. A transaction count of zero is valid.

5. Do not submit the payment form in the recorded demo. The current payment execution path uses `MockRainAdapter`; the video uses public Monad records as the proof of enforcement.

## 0:00–0:15 — opening

**On screen:** slide 1.

> SourcePilot gives an AI procurement agent spending authority without giving it an unlimited corporate card. The owner signs the limit once; Monad enforces it before payment execution.

## 0:15–0:55 — compare suppliers

**On screen:** `/compare`. Scroll through the three suppliers and stop on the recommended option.

> Here the agent compares three quotes for six hundred T-shirts. Rongcheng has the lowest unit price, but the agent refuses it because shipping is missing, delivery is late, and the specification match is below the required floor. Hanzhou wins on the complete set of terms, with the deposit exactly at the signed thirty-percent cap.

## 0:55–1:25 — approval boundary

**On screen:** `/approve`. Point to the autonomous threshold and the approval state. Do not press the final payment button.

> The owner’s mandate allows payments up to two hundred dollars autonomously. The one-hundred-and-eighty-dollar sample fits that rule. The larger deposit crosses the threshold, so the agent stops for human approval before any chain call or processor call.

## 1:25–1:45 — Rain proof

**On screen:** the clean four-line JSON result only.

> This is a live authenticated read-only call to Rain’s sandbox: HTTP two hundred from the issuing-transactions endpoint. This sandbox account currently has zero transactions. Card issuance and settlement are not claimed in this build; payment execution remains mocked.

## 1:45–2:30 — Monad proof

**On screen:** the MonadVision contract transaction list. Keep all three contract interactions visible.

> The enforcement is live on Monad testnet. This public contract shows the mandate creation, the one-hundred-and-eighty-dollar spend record, and revocation. Recording the spend reduced the remaining ceiling. After revocation, later attempts fail without redeploying the contract or restarting the application.

If time permits, click the record transaction, then return to the list. Do not open all three transactions unless a judge asks.

## 2:30–3:00 — honest boundary and close

**On screen:** slide 5.

> The contract enforces the cumulative ceiling, approved payees, validity window, revocation, and deposit cap. Rain sandbox authentication is live, while live card issuance and settlement are not. SourcePilot’s payment adapter is mocked, and blocked requests never reach it. The result is a procurement agent whose authority is explicit, inspectable, and revocable on-chain.

End on the Monad transaction list or the SourcePilot title slide.

## Claims to use exactly

| Topic | Accurate wording |
|---|---|
| Rain | “Live authenticated read-only Rain sandbox connectivity; no live issuance or settlement.” |
| Payment execution | “Demonstrated through `MockRainAdapter`.” |
| Monad | “Live Monad testnet contract with public creation, spend-recording, and revocation transactions.” |
| Transaction count | “The Rain sandbox account currently has zero transactions.” |

Never say that SourcePilot completed a real Rain payment or created a live Rain card.

## 90-second version

Use the opening for 10 seconds, `/compare` for 20 seconds, `/approve` for 15 seconds, Rain proof for 15 seconds, Monad proof for 20 seconds, and the boundary slide for 10 seconds.
