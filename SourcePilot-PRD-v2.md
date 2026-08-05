# SourcePilot AI — PRD v2 (Hackathon Build)

**Tagline:** A procurement agent with a spending limit you can prove.

**Status:** Revision of v1. Retargeted from "AI picks the best supplier" to "AI agent with bounded, revocable authority to spend company money." Scoped to a 15-hour build.

---

## 0. What changed from v1, and why

| v1 | v2 | Reason |
|---|---|---|
| Policy engine = server-side JSON config | Policy = **user-signed mandate** (EIP-712), anchored on Monad | A server-side rule means "trust the operator." A signature means the constraint is verifiable and revocable by the person whose money it is. This is Rain's own published position on where consent belongs. |
| Human approves every payment | **Three outcomes:** autonomous / approval-required / hard-blocked | If a human approves everything, the programmable controls do no work and it isn't agentic commerce. |
| Monad writes status hashes | Monad **enforces** the mandate: cumulative spend and payee scope checked on-chain, reverting | Writing audit hashes is "chain as logging table." A contract that refuses the payment is the enforcement point. |
| Blocked demo = over-limit amount | Blocked demo = **vendor-impersonation fraud** (changed bank details) | Same code path, vastly more visceral, and BEC accounted for >$3B in reported US losses in FBI IC3's 2025 report. Already specified in v1 §16 but absent from v1's demo. |
| 6 screens, 20 FRs, 9 endpoints, FastAPI+Postgres+Next | 2 screens, 9 FRs, 3 endpoints, one Next.js app + SQLite | v1 P0 was a 6-week build. |
| LLM-generated confidence score | Deterministic completeness score | An LLM emitting "87% confident" is theater; these judges discount it. |
| Supplier B dominates A on every axis | A is $31 cheaper but violates a deposit term | v1's demo data made the scoring model do zero work. |

**The through-line:** sourcing analysis is the *reason* the agent needs to spend. Bounded authority is the *product*.

---

## 1. Problem

A small brand founder ordering 600 T-shirts overseas gets three quotes in three formats. Unit price doesn't reflect landed cost. Then payment happens in an entirely separate system — a wire, from a bank tab, with no connection to the analysis that justified it.

Two gaps, and v2 targets the second one:

1. **Decision gap.** Comparing landed cost, MOQs, lead times, deposit terms, and spec compliance by hand is slow and error-prone.
2. **Authority gap.** The moment you let software touch procurement, you face a question nobody has a good answer to: *what is this agent allowed to spend, who decided that, and how do I take it back?* Today the options are "give it the company card" or "approve every transaction manually." Neither scales.

Existing AI sourcing tools stop before the transaction. Existing payment tools don't know whether a transaction is commercially appropriate. Neither addresses the authority gap at all.

---

## 2. Why this is agentic commerce and not an AI wrapper

The distinction the judges will apply: does the agent *transact*, or does it *advise*?

SourcePilot's agent transacts, inside limits its principal signed:

- A **sample order under $200** to a supplier already on the signed shortlist executes with **no human in the loop**. This is the load-bearing claim.
- A **deposit above the approval threshold** escalates to the founder with a rationale.
- A payment to a **destination not in the mandate** is refused, and no payment API call is made at all.

The agent's authority is a signed object, not a config file. The founder can revoke it in one transaction, and that revocation is observable by anyone — including Rain — without trusting SourcePilot's database.

**Design principle (unchanged from v1, and correct):** the language model extracts, reasons, and explains. Deterministic code computes every number and validates every transaction field before money moves. The model never does arithmetic and never authorizes.

---

## 3. The mandate — core primitive

A **Procurement Mandate** is an EIP-712 typed object signed once by the founder, in their wallet, with human-readable terms rendered at signing time.

```ts
// Domain binds the mandate to one chain and one registry.
// Without this, a testnet-signed mandate replays on mainnet.
export const MANDATE_DOMAIN = {
  name: "SourcePilot",
  version: "1",
  chainId: 10143,                       // Monad testnet
  verifyingContract: MANDATE_REGISTRY,  // deployed address
} as const;

export const MANDATE_TYPES = {
  ProcurementMandate: [
    { name: "principal",         type: "address" },  // the founder
    { name: "agent",             type: "address" },  // the delegate
    { name: "purchaseRequestId", type: "bytes32" },
    { name: "fundingSource",     type: "bytes32" },  // hash of Rain wallet/account ref
    { name: "maxTotal",          type: "uint256" },  // cents; TOTAL PAYABLE TO SUPPLIERS
    { name: "autonomousMax",     type: "uint256" },  // per-tx ceiling for the no-human path
    { name: "maxDepositBps",     type: "uint256" },  // 3000 = 30% OF SUPPLIER PO VALUE
    { name: "payeeScope",        type: "bytes32" },  // sorted keccak over normalized payeeRefs
    { name: "purpose",           type: "string"  },  // rendered in the wallet
    { name: "validAfter",        type: "uint256" },
    { name: "validUntil",        type: "uint256" },
    { name: "nonce",             type: "bytes32" },  // registry reverts on replay
  ],
} as const;
```

**Ambiguities that must be pinned down before you write the evaluator** — each is a one-question puncture on stage otherwise:

- `maxTotal` bounds **payments to suppliers**, not landed cost. Duties go to customs and freight may go to a forwarder; neither is ever in `payeeScope`, so neither can be inside this ceiling. PR-1042's $10.00/unit landed budget is a *sourcing* constraint evaluated in `/lib/cost`; `maxTotal` is a *payment* constraint evaluated on-chain. Two different numbers — never say "the six thousand dollar limit" without saying which.
- `maxDepositBps` is a percentage **of supplier PO value** (product + sampling + seller-arranged freight). Say the denominator out loud; "30%" of landed, of PO, and of `maxTotal` are three different dollar amounts.
- `payeeScope` = `keccak256` over the lexicographically sorted, newline-delimited, normalized `payeeRef` set (Merkle root instead if the list ever gets long). Publish the preimage alongside the mandate — a commitment to a list only you hold does **not** support the third-party verification claim below.
- `nonce` is enforced: `create` reverts on a hash already registered. Otherwise identical terms with different nonces yield two simultaneously-valid ceilings.

Four properties, each mapping to a requirement Rain has publicly said today's credential cannot meet:

| Property | How |
|---|---|
| Identifies the funding source | `fundingSource` commits to the Rain account the money comes from |
| Carries human-approved constraints | Amount ceilings, deposit cap, payee scope, time window — all inside the signature |
| Auditable | Verifiable by the founder *and* by any third party from the contract plus the published payee preimage, without SourcePilot's cooperation |
| Revocable | One onchain transaction; afterward the registry **reverts** on any further payment against it |

**Where enforcement lives — the thing that makes this more than an audit trail.** Cumulative spend and payee scope are tracked **in the contract**, not in our database. `/api/pay` calls `MandateRegistry.record(...)` *before* it calls Rain, and that call reverts on over-limit, out-of-scope, expired, or revoked. So the ceiling isn't forgeable by our own SQL, a lost row or a second server instance can't leak past it, and revocation makes the next payment *impossible* rather than merely discouraged.

The honest limit, and say it before a judge says it: **we hold the Rain credential**, so an operator who ignored its own contract could still instruct Rain directly. The mandate is a constraint SourcePilot applies to itself, verifiably. Closing that gap means the *issuer* checks the mandate at authorization — which is a composition with Rain's Agent Control Layer, not a thing we can build in a weekend. That's the roadmap answer, not a weakness to hide.

**Why `purpose` is in the signed payload:** EIP-712 renders it in the wallet at signing time. The founder sees *"Deposit and sampling for PR-1042, 600 heavyweight cotton tees, ≤30% deposit, approved payees only, expires 2026-10-14"* — not an opaque hash. That's the difference between a signature and informed consent, and it costs nothing to implement.

**Why `payeeScope` is a hash/root rather than an address list:** the approved-payee set can be long, and the enforcement path needs cheap membership checks while the signing UI needs something legible. For a three-supplier demo a plain array is honest and simpler — be ready to explain the tradeoff rather than over-engineering it.

**What goes onchain:** the mandate hash, the enforceable numeric constraints, and a revocation flag. Not `purpose` (it's already covered by the signature), and no quotation contents, supplier terms, or PII.

---

## 4. Scope

### In (P0 — nothing else starts until all of this works)

- **FR-1** Load a purchase request with requirements and constraints (prefilled for demo).
- **FR-2** Accept 3 supplier quotes via structured entry; one pre-parsed PDF for illustration.
- **FR-3** Normalize quotes to one schema; flag missing required fields.
- **FR-4** Compute landed cost and cost-per-unit deterministically.
- **FR-5** Compute a **completeness score** = % of required fields present. No LLM-generated confidence.
- **FR-6** Rank suppliers on weighted criteria; surface the ranking *and* any term-level policy failures separately.
- **FR-7** Generate a natural-language rationale that separates facts from assumptions and names missing data.
- **FR-8** Sign the mandate; anchor it on Monad; verify signature + constraints server-side before any payment path opens.
- **FR-9** Three payment outcomes — autonomous, approval-required, blocked — with Rain issuance derived from the mandate, plus idempotency and an immutable event log.

### Out (explicitly, and say so on stage)

Supplier marketplace · KYC/AML/sanctions screening · real customs classification · contract negotiation · production/inventory management · accounting integration · FX (hardcoded rate, disclosed) · multi-user roles · recurring purchases · email ingestion.

### Cut from v1 — do not build these

| Cut | Instead |
|---|---|
| Dashboard screen | Static screenshot in the deck |
| New-purchase-request form | Prefilled fixture |
| Transaction-status screen | Inline panel on the approval screen |
| Reliable PDF extraction | One pre-parsed PDF for show; structured entry is the real path |
| FX normalization | Hardcoded rate, labeled as hardcoded |
| Duty calculation engine | Flat 16.5%, labeled in the UI as **"HTS 6109.10.00 MFN base rate — excludes Section 301 and trade-remedy tiers"** (see the warning in §5) |
| 6-agent architecture | One orchestrator + typed tools. Six agents for a linear pipeline is worse engineering and reads as résumé-driven design. |
| 9 API endpoints | 3 |
| FastAPI + Postgres + separate frontend | One Next.js app + SQLite (Drizzle) |
| LLM confidence score | Deterministic completeness metric |
| x402 integration | Stretch only, and only after the Monad revocation path works |

**Two screens ship:** the quote comparison table, and the payment approval screen with the event log inline.

---

## 5. Demo data (fixed — v1's had no tension)

**Purchase request PR-1042:** 600 heavyweight cotton T-shirts, 240gsm, max landed cost **$10.00/unit** ($6,000), delivery ≤ **60 days**, deposit ≤ **30%**, spec match ≥ **90%**, destination US.

| | **A — Yuanfeng Textiles** | **B — Hanzhou Apparel Co.** | **C — Rongcheng Garment** |
|---|---|---|---|
| Unit price | $6.40 | $6.85 | **$5.95** |
| Product subtotal | $3,840.00 | $4,110.00 | $3,570.00 |
| Sampling / tooling | $120.00 | $180.00 | $0.00 |
| Shipping | $980.00 | $640.00 | **not provided** |
| **Supplier PO value** | **$4,940.00** | **$4,930.00** | $3,570.00 + freight |
| Est. duties (16.5% of subtotal) | $633.60 | $678.15 | $589.05 |
| Payment fee (1.0% of PO) | $49.40 | $49.30 | — |
| **Landed total** | **$5,623.00** | **$5,657.45** | **incomplete** |
| **Landed / unit** | **$9.37** | **$9.43** | — |
| Deposit | **50% = $2,470.00** | 30% = $1,479.00 | **100%** |
| Lead time | 55 days | 45 days | **70 days** |
| Spec match | 95% | 98% | **87%** |

Every derived figure follows one rule, stated once: duties = 16.5% of product subtotal; payment fee = 1.0% of PO value; landed = PO + duties + fee; deposit = `depositBps` × PO. `/lib/cost` is unit-tested against this table, so if a judge recomputes on their phone, it matches.

**Why this data works.** A and B land **$34.45 apart on a ~$5,600 order — 0.61%.** Cost is a tie, so the decision turns entirely on terms and risk, which is exactly where the scoring model earns its place:

- **A is nominally cheapest but its 50% deposit violates the mandate's 30% cap.** The cheapest compliant-on-paper option is eliminated by a *term*, not a price — the policy engine is visibly load-bearing rather than decorative. A also puts **$991 more cash at risk** up front and lands 10 days later against a 60-day deadline.
- **C is 13% below B on unit price and is probably genuinely cheaper on landed cost too** — at B's own freight it would land near $8.07/unit, and it only loses on cost if freight exceeds ~$1,448, or 2.3× B's on a smaller shipment. **Do not claim C is secretly expensive; it isn't, and a data engineer will catch that in ten seconds.** C is *cheap and non-compliant*: 70-day lead time against a 60-day deadline, 87% spec match against a 90% floor, 100% advance payment against a 30% cap, and a missing freight figure that makes its landed cost unquotable. Three hard failures, any one of them sufficient. **This is the more interesting story anyway** — the agent declines the cheapest supplier *knowing* it's the cheapest, because price was never the binding constraint.
- **B is the only quote that satisfies every hard constraint**, and it wins on total cost of ownership rather than sticker price.

**Demo payments:** sample order **$180** to B (autonomous — matches B's sampling line, under the $200 `autonomousMax`) → deposit **$1,479** (escalates) → same $1,479 **to a changed bank account** (blocked) → **revoke, retry the $180, reverts.**

Two spec traps this table sets, so fix them in the evaluator before Saturday: **B's deposit is exactly 3000 bps**, so a `<` where you need `<=` hard-blocks your own winner on stage; and B's landed cost of $9.43 sits $0.57 under a $10.00 ceiling, so any upward revision to the duty assumption breaks the demo.

> ### ⚠️ Verify the duty rate before you commit to these numbers
>
> 16.5% is the correct **MFN/general** rate for HTS 6109.10.00 (cotton knit T-shirts). It is almost certainly **not** the effective rate on Chinese-origin goods, and all three suppliers here are Chinese. US tariff policy on China has moved repeatedly through 2026 — Section 301 apparel lines and forced-labor tiers stack on top of MFN, and the stacked effective rate has been reported in the high-20s to mid-30s.
>
> This matters because it is not a rounding error: **at ~29% duty, both A and B breach the $10.00/unit budget and C becomes the only supplier that passes on price** — inverting your entire demo. Two fixes, do both:
>
> 1. **Label the line as MFN base only, excluding trade-remedy tiers.** That's accurate at any rate, and it signals you know the distinction — which is worth more to these judges than a number you can't defend.
> 2. **Give PR-1042 headroom.** Raise the budget to $12.00/unit, or drop the per-unit ceiling as a hard gate entirely and let deposit terms and lead time do the eliminating. The demo's tension comes from *terms*, not from price — so don't let a tariff assumption you can't verify be load-bearing.
>
> Check the current rate on hts.usitc.gov Friday. Expect **"why are you using a pre-2026 duty rate?"** — that's the question you'll actually get, not §13's "duties are wrong for half the world."

---

## 6. Demo script — 3:00

**Staging note that changes how the whole thing reads:** the mandate must be signed **before the demo starts**, with a visible timestamp from a prior session — *"she signed this Thursday; she is not in the room."* If the founder signs at 0:30 and money moves at 1:30, a skeptical judge sees a button with two extra steps, not autonomy. Autonomy is a claim about **time, absence, and surprise**; sign-then-immediately-pay demonstrates none of them.

**0:00–0:20 — the authority problem**

> "This founder is buying six hundred T-shirts from overseas suppliers — about five thousand dollars to whichever one she picks. If she lets software handle it, her options today are handing it the company card or approving every transaction herself. We built the third option."

**0:20–0:40 — the mandate already exists**

Show it, pre-signed, with Thursday's timestamp and the wallet's rendered terms.

> "On Thursday she signed this: a payment ceiling, thirty percent maximum deposit, these three suppliers, expires in sixty days. Readable terms, not a hash. It's registered on Monad — and the contract, not our database, is what tracks how much of that ceiling is left."

**0:40–1:20 — analysis, and the agent turns down the cheapest supplier**

Comparison table renders with policy badges.

> "Supplier C is thirteen percent cheaper per unit, and it's probably genuinely cheaper landed — we're not pretending otherwise. It's also uninvestable: seventy days against a sixty-day deadline, eighty-seven percent spec match against a ninety percent floor, and a hundred percent payment up front against a thirty percent cap. Three independent failures.
>
> A and B land thirty-four dollars apart. That's a rounding error, so price isn't the decision — A wants fifty percent down, and **the mandate caps deposits at thirty.** The cheapest bid on the table is out on a *term*. B it is."

**1:20–1:50 — the autonomous beat (your differentiation)**

> "The agent orders samples from B. A hundred and eighty dollars, approved payee, inside the per-transaction ceiling — **it just does it.** No approval screen, and I haven't touched anything."

Point at the registry read.

> "Before Rain saw a single request, the contract checked the payee against the signed scope and debited the ceiling. Every field in that Rain instruction was validated against the signature — if any of them failed, the request is never constructed."

**1:50–2:15 — escalation**

> "The deposit is fourteen seventy-nine. That's above the per-transaction ceiling, so it stops and asks, with the reasoning attached." *(Approve.)*

**2:15–2:40 — the fraud block**

> "Now something that happens in real procurement constantly. An email arrives: *'we've updated our banking details.'*"

Agent attempts the same $1,479 to a new account. **Blocked.**

> "That destination isn't in the signed scope, so the contract reverted and no payment API call was made at all."

**Have the network panel visible.** Showing zero outbound requests beats asserting it — "how do you know?" is the obvious follow-up and this answers it without you saying anything.

> "Vendor impersonation and business email compromise ran to over three billion dollars in reported US losses last year, and it works because payment authority and payment destination live in different systems. Here they're the same signature."

**2:40–3:00 — revocation (the closer, and the reason a chain is here)**

> "Last thing. She changes her mind."

One transaction. Then **retry the same $180 sample order that succeeded ninety seconds ago.** It reverts.

> "Not flagged, not logged — refused, by a contract we don't control at that point. That's the difference between an audit trail and an authority."

### Hygiene

Record two clean takes Sunday 9 AM and **play the recording if anything is fragile.** Editor and browser at 150%. Notifications off, tab order preset. No reading code aloud.

Three script disciplines, each closing a one-question puncture:

- **One meaning per number.** "Sixty days" is currently both the delivery deadline and the mandate expiry. Pick one, rename the other.
- **Never say "the six thousand dollar limit."** Landed-cost budget and payment ceiling are different constraints (§3). Say "payment ceiling" or "landed budget," always.
- **Don't say "derived from the signature"** unless you can name which field. Say what's true and equally strong: *"every field is checked against the signed object, and the request isn't built unless all of them pass."*

---

## 7. Architecture

One Next.js 15 app (App Router, TypeScript, Tailwind), SQLite via Drizzle, viem + wagmi for chain and signing, Foundry for the contract, Anthropic SDK for the agent loop, server-sent events for the log stream.

```
/app
  /compare              Screen 1 — normalized quote table
  /approve              Screen 2 — approval + inline event log
  /api/analyze          POST — extract, normalize, cost, score, explain
  /api/mandate          POST — verify signature, anchor on Monad
  /api/pay              POST — evaluate → autonomous | approval | blocked
/lib
  /cost                 deterministic landed-cost math (pure, unit-tested)
  /score                weighted ranking + completeness metric
  /mandate              EIP-712 types, sign/verify, constraint evaluator
  /rain                 RainPort interface + Mock and Live adapters
  /chain                viem clients, ABIs, addresses
/contracts              MandateRegistry.sol (Foundry)
```

**Boundary that matters:** `/lib/cost`, `/lib/score`, and `/lib/mandate` are pure deterministic TypeScript with unit tests. The LLM never enters these paths. It extracts fields into a validated schema and writes prose about results it did not compute. Be able to point at this on stage — it's the answer to "how do you know the model didn't hallucinate the numbers?"

### Rain integration — behind one port

`docs.rain.xyz` is access-code gated and partner access normally needs an NDA. **Getting sandbox credentials is the first task Saturday, 9 AM, before the keynote — not at the 11:30 workshop.**

```ts
export interface RainPort {
  createPaymentInstruction(req: {
    mandateHash: string;
    payeeRef: string;              // must be inside mandate payeeScope
    amountMinorUnits: number;      // cents. never a float.
    currency: string;
    purchaseRequestId: string;
    stage: "sample" | "deposit" | "balance";
    idempotencyKey: string;        // always
  }): Promise<{ paymentId: string; status: string }>;

  getPaymentStatus(paymentId: string): Promise<{ status: string; ref?: string }>;
  validateDestination(payeeRef: string): Promise<{ ok: boolean; reason?: string }>;
}
// → MockRainAdapter   (Friday night, with a simulated status stream)
// → LiveRainAdapter   (Saturday, once credentials land)
```

Write `MockRainAdapter` Friday.

**The mock is the plan of record, not the fallback.** "Swapping to live is one line" is the most optimistic sentence you could write about a payments API you've never touched. What actually happens: an auth flow you didn't expect (HMAC request signing, org/account IDs you must fetch first), payees that must exist as pre-created counterparty entities before they can receive anything, minor-unit and currency conventions that differ from yours, idempotency-key scoping that isn't yours, no sandbox mechanism to advance a payment past "created," and webhooks you can't receive on venue wifi. Budget **4–6 hours, not two** — and it lands in your least-prime window.

So: build and rehearse the entire demo against the mock, and treat the live Rain call as a **20-second additional beat** — "and here's that same instruction hitting the real sandbox." If it works, you've lost nothing. If it doesn't, your demo is unaffected and you were never depending on it. Inverting this is a decision to make Friday, calmly, rather than at 7pm Saturday.

**Ask at the workshop:** sandbox rate limits · how to simulate settlement, not just instruction creation · which Agent Control Layer fields are live in beta vs. roadmap · webhooks or polling (install `cloudflared` Friday) · idempotency key scope and TTL · whether payment metadata can carry `purchaseRequestId`.

### Monad integration

```solidity
contract MandateRegistry {
    struct Mandate {
        address principal;
        uint256 maxTotal;        // cents, payable to suppliers
        uint256 autonomousMax;
        uint256 maxDepositBps;
        bytes32 payeeScope;
        uint256 validAfter;
        uint256 validUntil;
        uint256 spent;           // cumulative — THE CEILING LIVES HERE, NOT IN OUR DB
        bool    revoked;
    }

    /// @notice Verifies the founder's EIP-712 signature on-chain. Reverts on a
    ///         duplicate hash (nonce replay). The server cannot register a
    ///         mandate the principal did not actually sign.
    function create(Mandate calldata m, bytes32 mandateHash, bytes calldata sig) external;

    /// @notice Called BEFORE Rain. Reverts on: revoked, outside the time window,
    ///         payee not in scope, spent + amount > maxTotal, or deposit > cap.
    ///         Increments `spent` on success.
    function record(
        bytes32 mandateHash,
        uint256 amount,
        bytes32 payeeHash,
        bytes32[] calldata payeeProof,
        uint8   stage
    ) external returns (uint256 remaining);

    function revoke(bytes32 mandateHash) external;   // principal only
    function remaining(bytes32 mandateHash) external view returns (uint256);

    event MandateCreated(bytes32 indexed mandateHash, address indexed principal);
    event PaymentAuthorized(bytes32 indexed mandateHash, uint256 amount,
                            bytes32 payeeHash, uint8 stage, uint256 remaining);
    event MandateRevoked(bytes32 indexed mandateHash, uint256 at);
}
```

Testnet: chain `10143`, RPC `https://testnet-rpc.monad.xyz` (50 rps; **25 rps for `eth_call`** — don't poll the view functions), explorer `testnet.monadvision.com`, faucet `faucet.monad.xyz`. Backups: `rpc-testnet.monadinfra.com`, `rpc.ankr.com/monad_testnet`. Mainnet is `143`. Testnet was reset from genesis 2025-12-16 — verify any address from an older source.

**Why this isn't a logging table.** This is the likeliest hostile question, and the version of this design that only stored a hash and a boolean did not survive it. The test to apply to yourself: **what breaks if I delete the server's call to the contract?** With a read-only `isValid()`, nothing — the server was just being polite. With `record()`, the payment loses its authorization and the ceiling stops decrementing, because **cumulative spend is on-chain state and the contract reverts rather than reporting.** `PaymentAuthorized` makes the log a *derivation* of the payment rather than a description of it, so a third party can reconstruct remaining allowance without us.

If you run out of time and ship only the anchor-and-read version, **say so plainly** and describe this as the next step. Overclaiming to Monad's AI engineering lead is worse than a small honest scope.

---

## 8. Data model (trimmed to 6 entities)

**PurchaseRequest** — id, product, quantity, budgetMinorUnits, destination, deadline, specs (json), status
**Supplier** — id, name, country, payeeRef, verificationStatus
**Quote** — id, purchaseRequestId, supplierId, currency, unitPriceMinorUnits, subtotal, setupFee, shipping, dutyEstimate, paymentFee, landedTotal, landedPerUnit, leadTimeDays, depositBps, specMatchPct, missingFields (json)
**Mandate** — id, purchaseRequestId, principal, agent, hash, signature, constraints (json), monadTxHash, revokedAt
**Payment** — id, purchaseRequestId, supplierId, amountMinorUnits, currency, stage, outcome (`autonomous`|`pending_approval`|`approved`|`rejected`|`blocked`), blockedReason, approvalSig, monadTxHash, rainPaymentId, idempotencyKey, createdAt
**Event** — id, purchaseRequestId, type, actor (`user`|`agent`|`system`), payload (json), createdAt — append-only, powers the log and the audit story

**Money rules, non-negotiable:** integer minor units everywhere (cents; 6-decimal base units for USDC), `BigInt` for token math, never a float. Idempotency key on every mutating call — agents retry, and retries double-spend. Never log a PAN, CVV, or private key; redact at the logger. Server-side signing only; `.env.local` gitignored before the first commit.

---

## 9. Policy evaluation

Evaluated against the *signed* mandate, not a config file. Order matters, and each failure returns a human-readable reason.

**Off-chain pre-checks** (fast feedback, and they gate quote selection):

1. Required quote fields present → else **BLOCKED** *(eliminates Supplier C — landed cost unquotable)*
2. Sourcing constraints — landed cost, lead time, spec match → else **BLOCKED**
3. Caller address == `agent` in the mandate → else **BLOCKED** *(nothing else authenticates this)*

**On-chain enforcement** — `MandateRegistry.record()` is called next, and it is the authority. It reverts on: revoked · outside `validAfter`/`validUntil` · `payeeHash` not in `payeeScope` · `spent + amount > maxTotal` · deposit > `maxDepositBps` **of PO value** *(eliminates Supplier A)*. Use `<=` on the deposit comparison — Supplier B sits exactly on 3000 bps.

**Routing** — only reached if the contract call succeeded: `amount <= autonomousMax` → **AUTONOMOUS**, else **PENDING_APPROVAL**.

Note the off-chain checks are *convenience*, not security. Every constraint that protects the founder's money is enforced in the contract, so a bug or a rollback in our database cannot leak past the ceiling.

**Escalation is itself signed.** A founder approving $1,479 is a second consent event, so it gets a second EIP-712 signature — `PaymentApproval` over `mandateHash + payeeHash + amount + stage + nonce` — stored in `Payment.approvalSig`. If approval were just a database row, the post-approval field freeze would be a database constraint, which is precisely the flaw §0 criticizes v1 for. Do not half-adopt the pattern.

---

## 10. Agent behavior contract

**Must:** emit structured output validated against a JSON schema · separate facts from assumptions in every rationale · name missing fields explicitly rather than inferring them · prefer a blocked transaction over an unsafe one · log inputs and rules used for each recommendation · ask for clarification when a required field is absent.

**Must not:** compute any figure that reaches a payment · modify a payee or amount after approval · describe a supplier as verified without evidence · present estimated duties as actual · put quote contents or PII onchain · claim a transaction succeeded before Rain confirms.

---

## 11. Build timeline

Realistic budget: **13–15 hours, only 6 of them prime** — and honoring the BBQ (correctly) puts the real build figure near **11**. FR-1..9 as originally written is a 22–28 hour list. Two cuts, decided now rather than at 8pm Saturday:

- **FR-7 becomes a template with slot-filled deterministic values.** Nothing in the room can distinguish good template prose from generated prose, §2's design principle already forbids the model from computing anything, and this saves 2–3 hours of prompt iteration that appears in no Saturday block.
- **FR-2 becomes fixtures**, with the quote-entry form as a screenshot in the deck.

That's 4–5 hours back — which is what funds the on-chain `record()` work.

**Friday (2–3h)** — Repo boots, both screens render with fixtures. `/lib/cost` and `/lib/score` written and unit-tested against the §5 table. EIP-712 sign/recover round-trip passing, **with the domain separator including chainId and the registry address**. `MockRainAdapter` with simulated status stream. Monad testnet in wallet, MON funded across 3 addresses (faucets throttle), viem reading a block. **Foundry deploys a hello-world to testnet** — do not discover Foundry problems Saturday. `cloudflared` installed. Backup RPC in reserve. Check the current HTS 6109.10.00 rate.

**Sat 9–11 AM** — **Rain credentials and docs access code before the keynote.** Read the issuance API while it's quiet. Confirm scope in one written sentence.

**Sat 11:00–12:30** — Sessions. Don't code through them. Write down the CTO's exact phrasing; echo it Sunday. Ask Jarrod directly what makes a serious Monad contender.

**Sat 1–3 PM** — `MandateRegistry` with `create` + `record` + `revoke` deployed to testnet. Signature verified on-chain. `record()` reverting correctly on each condition. *Checkpoint: the contract refuses a payment, and `spent` increments on-chain.*

**Sat 3–4:30 PM** — All three outcomes wired end to end against `MockRainAdapter`. Legible block reasons. **Revocation path working** — this is not optional, it's the closer. *Checkpoint: autonomous, escalated, blocked, and revoked all fire.*

**Sat 4:30–6 PM** — Comparison table with policy badges and the approval screen with inline SSE log. Readable at 150% on a projector. Budget the full 90 minutes; this is what the judges actually look at. *Checkpoint: watchable.*

**Sat 6–8 PM** — **Go to the BBQ.** The Rain team is there. You get unstuck on API details, and a judge arrives Sunday already primed on your project. This is not a break from the hackathon.

**Sat 8–9 PM** — Full timed run-through. Feature freeze at 9. Anything off the demo path is deleted from the plan, not deferred.

**Sat evening (optional, ≤midnight)** — `LiveRainAdapter` as an additive beat, or x402 for a supplier-verification lookup (the Permit2 proxies are already deployed on Monad testnet, so this is cheaper than it looks). Hard stop at midnight; a tired mistake in the payment path is a broken demo.

**Sun 9–10 AM** — Freeze. **Record two clean takes of the full demo.** This is insurance against venue wifi and sandbox hiccups.
**Sun 10–11:15** — Five slides.
**Sun 11:15–11:45** — Rehearse aloud, standing, timed, three times. The first pass will run six minutes.
**Sun 11:45** — Submit. Not 11:59.
**Sun 12–3 PM** — Judging window. Be findable; have a clean 60-second version ready. Most judging conviction forms in hallway conversations.

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| **Rain credentials delayed or the API is deeper than expected** | Mock is the plan of record (§7). Live Rain is an additive 20-second beat. Be explicit on stage about which is which — these judges built the API and will know. |
| **"Why does this need a blockchain?"** | Cumulative spend is on-chain state and `record()` reverts. Delete our call and the payment loses its authorization. Revocation makes the next payment impossible, not discouraged. If you shipped only the read-only version, say so. |
| **"How is this different from Rain's Agent Control Layer?"** | The Control Layer enforces constraints Rain's *partner* sets at issuance. The mandate makes the *buyer's* consent a portable signed object that determines what the partner may even request. Authoring and attestation above enforcement. The composition worth naming: **we author, Rain enforces** — the end state is Rain's issuance checking a mandate like this one. |
| **"Why does this need an agent at all?"** | Weak answer: "the $180 order." That's circular — it needed an agent because we built one. **Strong answer: the ceiling binds across transactions.** Fire two or three autonomous payments and let one hit the limit and stop on its own. One payment is an anecdote; a running total that halts itself is a system. |
| **"What decision did the agent actually make?"** | Be precise and don't inflate: it selected *which* of three payees and *which* payment stage. That's the real degree of freedom. Claiming more invites a follow-up you can't answer. |
| **Model hallucinates numbers** | Deterministic pure functions, unit-tested against §5, LLM structurally excluded from `/lib/cost` and `/lib/mandate`. Point at the module boundary. |
| **Scope creep** | Nothing in §4-Out starts until all nine FRs pass. |
| **Live payment failure** | Sandbox/testnet only. Two recorded takes. Explicit error states in the UI. |
| **Reads as an AI wrapper** | Autonomous path + on-chain refusal + live revocation. Three things a chatbot cannot do. |
| **The demo overruns 3:00** | It will on the first pass — §11 budgets three timed rehearsals for exactly this. Cut the escalation beat first (§6, 1:50–2:15); it's the least differentiated. Never cut revocation. |

---

## 13. Judge Q&A prep

- **"Why are you using a pre-2026 duty rate?"** The question you'll actually get, not the generic one. 16.5% is the MFN base for HTS 6109.10.00; Section 301 and trade-remedy tiers stack on top for Chinese-origin goods and the effective rate is materially higher. The UI labels the line as MFN-base-only, and PR-1042 has budget headroom so the demo doesn't hinge on it. Real classification is a licensed-broker function, explicitly out of scope. *(Naming your own limits unprompted buys credibility with engineering judges — they will find the seams anyway.)*
- **"Isn't the autonomous payment just a button, since she signed two minutes ago?"** Which is why the mandate is pre-signed from a prior session with a visible timestamp (§6), and why the ceiling binding across multiple payments is the better proof.
- **"What stops you from ignoring your own mandate?"** Nothing, at the API layer — we hold the Rain credential. The mandate is a constraint we apply to ourselves, verifiably, with on-chain state a third party can audit. Real enforcement belongs to the issuer, and that's the composition with Rain described in §12. Don't pretend this is solved.
- **"How is `payeeScope` verifiable if only you hold the list?"** It isn't, unless the preimage is published. It is (§3). Sorted keccak over normalized refs, published alongside the mandate.
- **"What if the supplier's real bank details genuinely changed?"** The founder re-signs the mandate with the new payee. That's the point: changing where money can go requires human action, not an email.
- **"Who signs the Monad transaction?"** The founder signs the mandate. Our server relays it. If the server signed, the record would attest to nothing but our own claim.
- **"What's the settled-vs-authorized gap?"** Card authorizations can settle for a different amount (tips, incidentals). Not an issue for the wire/stablecoin path we demo, but for card-based procurement the mandate needs bounded post-auth headroom. Have a position, don't hand-wave.
- **"Sybil / payee verification?"** We don't verify suppliers — explicitly out of scope. The mandate constrains *where money goes*, not *who deserves it*. Different problem, and conflating them would be dishonest.
- **"Business model?"** Infrastructure that makes agentic procurement underwritable. Value accrues to whoever issues the credential — that's Rain. It expands addressable volume rather than adding a toll.
- **"Next month?"** Merchant/supplier-side verification SDK so the constraint is checkable without calling us, plus dispute resolution keyed to the mandate — because "the agent did it" is the liability question this whole category is about to hit.

---

## 14. Open questions for Saturday

Rain: sandbox credentials and test funds? · can payment metadata carry `purchaseRequestId`? · which Agent Control Layer fields are enforced in beta? · transaction-specific payment instruments available in sandbox? · which stablecoins and networks? · webhooks or polling? · idempotency semantics?

Monad: testnet or mainnet expected for the bounty? · is a deployed contract required? · does reading `isValid()` on the enforcement path satisfy "best implementation of Monad," or is settlement expected?

Event: pre-existing code permitted, and must it be disclosed?

---

## 15. Definition of done

A judge can, in under three minutes: see a mandate signed in a *prior session* with readable terms → see the cheapest supplier declined on a *term* while the agent openly acknowledges it's the cheapest → **watch a payment execute with no human involved and the on-chain ceiling decrement** → watch a redirected payment refused before any API call, with zero network egress visible → **watch revocation kill a payment that succeeded ninety seconds earlier** → and explain back to you what this agent is and isn't allowed to do.

The last item is the real test. If the judge can restate the authority model, you've built a product. If they can only restate the workflow, you've built a demo.

---

## 16. Pitch

**One line:** SourcePilot AI is a procurement agent that analyzes supplier quotes and spends company money inside a limit its owner signed cryptographically, enforced on-chain, and revocable in one transaction.

**Thirty seconds:** Small businesses compare international supplier quotes by hand, then pay through a completely separate system. SourcePilot connects them — landed cost, spec compliance, risk, a recommendation. But the real problem isn't analysis, it's authority: the moment you let software spend, your options are handing it the company card or approving every transaction yourself. So the owner signs one mandate — payment ceiling, deposit cap, approved payees, expiry. Small orders execute autonomously. Larger ones escalate. Payments to unapproved destinations are refused before any API call is made. Rain moves the money; the mandate lives in a Monad contract that tracks cumulative spend and reverts when a payment falls outside it — so the limit is enforced, not just recorded, and revocation takes one transaction.

**Principle:** The agent recommends autonomously. Money moves only inside authority a human signed and can take back.
