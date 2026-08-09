# SourcePilot submission video — 3:00

Use `SourcePilot-deck.pptx` as the full-screen recording surface. Slides 4–9 contain the six prepared evidence screens, so you do not need to switch tabs or expose terminal history during the video.

## Before recording

1. Open `demo/SourcePilot-deck.pptx` and start slide show mode.
2. Close notifications and unrelated windows.
3. Confirm the video limit and record at 1080p.
4. Do not demonstrate a new payment or a new revocation. The deck uses prepared public evidence.

## 0:00–0:12 — slide 1: opening

> SourcePilot gives an AI procurement agent spending authority without giving it an unlimited corporate card. The owner signs the limit once; Monad enforces it before payment execution.

## 0:12–0:25 — slides 2–3: problem and architecture

> The risk is not that agents cannot pay. It is that payment authority is usually hidden in application code. SourcePilot makes that authority signed, inspectable, and revocable: compare suppliers, check the mandate, enforce it on Monad, and only then reach the payment adapter.

## 0:25–0:50 — slide 4: compare suppliers

> The agent compares three quotes for six hundred T-shirts. The cheapest quote is rejected because shipping is missing, delivery is late, and the specification and deposit terms violate policy. Hanzhou is recommended because its complete terms clear the signed rules, including the thirty-percent deposit cap.

## 0:50–1:12 — slide 5: approval boundary

> Here the signed mandate exposes the one-thousand-eight-hundred-forty-dollar ceiling, two-hundred-dollar autonomous threshold, approved payees, deposit cap, and expiry. A request outside that authority stops for founder approval before any chain transaction or Rain call.

## 1:12–1:31 — slide 6: Monad contract

> The enforcement is live on Monad testnet. This public registry shows three successful contract interactions together: mandate creation, spend recording, and revocation.

## 1:31–1:49 — slide 7: Monad spend record

> This successful transaction records the approved spend on-chain. It is immutable, independently inspectable evidence that the mandate’s remaining ceiling changed.

## 1:49–2:07 — slide 8: Monad revocation

> This second public transaction revokes the authority. Revocation is a contract state transition, not an application toggle, so later authorization attempts cannot reuse the mandate.

## 2:07–2:27 — slide 9: Rain sandbox

> Rain connectivity is also real but deliberately limited: this authenticated read-only sandbox request returned HTTP two hundred from the issuing-transactions endpoint. The account currently has zero transactions. This build does not claim live card issuance or settlement.

## 2:27–2:45 — slide 10: proof summary

> The implementation is backed by two hundred eight passing tests, zero payment-adapter calls on blocked paths, a live Monad registry, and authenticated Rain sandbox connectivity.

## 2:45–3:00 — slide 11: boundary and close

> The contract enforces the cumulative ceiling, payee scope, validity window, revocation, and deposit cap. Payment execution still uses a mock Rain adapter. SourcePilot’s contribution is a procurement agent whose authority is explicit, inspectable, and revocable on-chain.

## Claims to use exactly

| Topic | Accurate wording |
|---|---|
| Rain | “Live authenticated read-only Rain sandbox connectivity; no live issuance or settlement.” |
| Payment execution | “Demonstrated through `MockRainAdapter`.” |
| Monad | “Live Monad testnet contract with public creation, spend-recording, and revocation transactions.” |
| Rain transaction count | “The Rain sandbox account currently has zero transactions.” |

Never say that SourcePilot completed a real Rain payment or created a live Rain card.

## 90-second cut

Use slide 1 for 8 seconds, slide 4 for 18 seconds, slide 5 for 15 seconds, slides 6–8 for 27 seconds total, slide 9 for 12 seconds, and slide 11 for 10 seconds.
