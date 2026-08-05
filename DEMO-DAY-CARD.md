# Demo Day Card

**One page. Everything needed on stage, and nothing else.** Values fill in Friday during WP8; the structure exists now so nothing is discovered missing at 11 AM Sunday.

> **Print this, or have it open on a second screen.** Do not go looking for a value mid-demo.

---

## 1. Must be TRUE before Saturday — not tasks for Saturday

| Item | Why it can't wait | Status |
|---|---|---|
| **Four addresses funded with MON** | Faucet has a **2-hour cooldown per token**. Discovering an empty principal wallet Saturday morning means the revocation closer — the whole pitch — cannot run. | ⬜ **OUTSTANDING** |
| `MandateRegistry` deployed to testnet, address recorded | Redeploying live burns time and produces a fresh contract with no history | ⬜ Wednesday |
| Mandate pre-signed with a **prior-session (Thursday) timestamp** | The narrative is that she signed it before, and isn't in the room. Signing it Saturday makes that false. | ⬜ Friday |
| **D4 wallet screen-recording** — wallet showing rendered EIP-712 terms | This *replaced* the live wallet moment. There is no fallback if it doesn't exist. | ⬜ Friday |
| One clean end-to-end run, recorded | Insurance against every live failure | ⬜ Friday |

**Only one thing is genuinely obtained on Saturday:** Rain credentials, 9:00 AM, in person, before the keynote. Everything else is prepared.

---

## 2. On-stage values — fill Friday

```
Contract address      0x________________________________________
Explorer link         https://testnet.monadvision.com/address/0x____________
Mandate hash          0x________________________________________
Principal address     0x214B1e3E38453582Ea1d078c080ec1781C5c29c6
Agent address         0x0e781C29530d33657b9cA8c0A8263F5d75d5DbD4
APPROVAL_ONCHAIN_VERIFY   [ ] true   [ ] false     ← decided at Wednesday's gate
```

**The revoke command** — from `printRevokeCommand()`, pasted into a visible terminal. **Have it on the clipboard before you start.**

```
cast send <REGISTRY> "revoke(bytes32)" <MANDATE_HASH> \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key $PRINCIPAL_PRIVATE_KEY
```

---

## 3. The four beats, in order

1. **$180 sample** → executes autonomously, on-chain ceiling decrements
2. **$1,479 deposit** → escalates. No chain call, no Rain call.
3. **$1,479 to the changed bank account** → refused **by the contract**, before any API call. *Network panel visible and empty.*
4. **Revoke → retry the $180 that worked 90 seconds ago** → reverts

**On demand, in Q&A:** `fireSample(2)` succeeds with $1 left · `fireSample(3)` reverts on `ExceedsMaxTotal`. This is the non-circular answer to *"why does this need an agent?"* — the agent halts itself against a ceiling it did not choose.

---

## 4. Exact wordings — say these, not paraphrases

**Enforcement claim** — depends on Wednesday's flag. Say only the one that matches what shipped.

*If `APPROVAL_ONCHAIN_VERIFY` is **false**:*
> "The contract enforces the ceiling, the payee scope, the time window, and revocation. The deposit ratio is asserted by the caller and bound into the signed approval — so it's auditable, but I won't claim it's unforgeable."

*If **true**:*
> "The contract enforces the ceiling, the payee scope, the time window, and revocation. On this payment it also enforces the deposit cap — it checks the founder's approval signature on-chain, so the PO value the ratio is measured against is one she signed, not one our server asserted. What no contract can check is whether that PO value matches the real invoice. That's the remaining seam, and I'd rather name it than let you find it."

**Never say:**

- ❌ "we replay the same request" → ✅ **"the agent tries that order again"**
- ❌ "the contract enforces the 30% cap" → use the sentence above
- ❌ "the mandate expires in sixty days" → ✅ **"expires in ninety days."** Sixty days is the *delivery* deadline.
- ❌ "supplier C is secretly expensive" — it isn't, and Juan Blanco will catch it. C is genuinely cheaper and fails on **terms**: no freight quote, 70 days, 87% spec match.

**The duty line, verbatim:** *"HTS 6109.10.00 MFN base rate — excludes Section 301 and trade-remedy tiers."*

---

## 5. Hard questions, and the honest answers

**"What breaks if you delete the server's call to the contract?"** *(Jarrod — this is the bounty question)*
> The payment loses its authorization and the ceiling stops decrementing. It isn't a log; it's the gate.

**"How do you know the server didn't register different constraints than she signed?"** *(Farhan)*
> The contract recomputes the EIP-712 digest on-chain from all twelve signed fields and recovers the signer. We never pass it a hash. There's a test that takes a valid signature, changes one field, and watches it revert.

**"What if she rejects the escalation?"**
> Nothing was debited. The escalation gate runs *before* the chain call, precisely so we never spend a ceiling on a payment she may refuse.

**"Does `spent` increment before the money actually moves?"** *(name this before they find it)*
> Yes — we authorize, we don't capture. If Rain then failed, the ceiling is debited for money that never moved. That fails safe: we over-reserve, never overspend. A production version separates reserve and settle. We chose the safe direction and didn't build two-phase in a weekend.

**"Is this a real Rain integration?"**
> The demo runs on a mock shaped against their API. *(If Saturday's round-trip landed:)* And here's a live authenticated call against the sandbox.

**"Did you verify the suppliers?"**
> No. Out of scope, and we don't claim it.

---

## 6. Sunday

9:00–10:00 two clean recorded takes · 10:00–11:15 five slides · 11:15–11:45 three timed rehearsals, **standing up** · **placeholder submitted 11:00** · final 11:45.

Submit the placeholder at 11:00 regardless of state. A submitted imperfect entry beats a perfect unsubmitted one.
