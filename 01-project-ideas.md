# Rain × Monad Hackathon — Project Idea Shortlist

## The single most useful thing I found

Rain has publicly published its own gap analysis. Two posts matter enormously:

**Pooja Shah (Head of Product), "Machine-initiated payments will unlock new opportunities for payment credentials"** argues that today's credential (the 16-digit PAN, plus 60 years of bolt-ons: CVV2, 3DS, network tokenization) only identifies an *account*. It cannot express *what an agent is allowed to do*. She names four non-negotiables for a real agentic payment credential:

1. Identifies the funding source (who is on the hook)
2. Carries the human-approved constraints (which merchant, what amount, how long, on whose behalf, under what conditions, how revoked)
3. Is auditable — by the delegating human *and* by issuers, networks, regulators
4. Enables "consumer protection through constraint rather than detection"

She then says: *"The design space for what comes next is wide open."* And: *"That work is still ahead."*

**Kevin Carr (Chief Compliance Officer), "Know Your Agent: the next layer of compliance"** adds the enforcement problem: agentic behavior (rapid transactions, many simultaneous IPs) looks exactly like classic fraud. Rain is building "agent profiles" as behavioral baselines. He explicitly flags the open question: *"'The agent did it' can't become a catch-all loophole... at the same time, the framework has to leave room for legitimate errors that aren't fraud."*

Rain's currently shipped answer to all this is the **Agent Control Layer** (beta): constraints enforced *at card issuance and transfer initiation*, at agent level (amount, merchant/MCC allowlist, spend interval, expiry) and program level (active-card caps, aggregate spend, anomaly visibility). Cards are single-use and scoped; the agent never holds permanent credentials.

**So the highest-conviction framing for the weekend is: build the layer Rain says is missing, on top of the layer Rain has already shipped.** Anything that makes the *consent* portable, verifiable, and auditable — rather than trapped inside Rain's issuance call — is aimed directly at the roadmap the CTO and product lead are already thinking about. Monad is the natural place to anchor and audit it.

---

## Read on the judges

Weight your build toward what these five people can evaluate in three minutes:

| Judge | What they'll be looking at |
|---|---|
| **Charles Yoo-Naut** (Rain CTO, speaker) | Does this belong in Rain's product? Is the abstraction right? |
| **Ross Basri** (Rain product, led Rain Rewards, ex-Uptop loyalty) | Is there a real user and a real behavior change? Loyalty/rewards angles land with him. |
| **Farhan Khwaja** (Rain SWE — high-throughput transactional systems, custody, dev tooling) | Is the transactional path sound? Idempotency, replay, key custody. He will notice if you hand-wave. |
| **Juan Blanco** (Rain data eng — Messari, Flipside, backtesting) | Is there a data/observability story? Can you show the ledger, not just the happy path? |
| **Jarrod Watts** (Monad AI lead — agent orchestration, x402, dev tools) | Owns the Monad bounty. Wants real onchain settlement and agent-to-agent primitives, not a chain used as a logging table. |
| **Siggy Bilstein** (Cursor/Origin, ex-Graphite — dev tooling) | Developer experience. Would an engineer actually adopt this? An SDK with a beautiful 10-line integration will land hard with him. |

Three of six are infrastructure/dev-tooling people. **A well-designed primitive with a clean SDK will beat a prettier consumer app.**

---

## The shortlist

Scored 1–5. "Feasibility" assumes ~13–15 real build hours (see the timeline in `03-demo-pitch-template.md`).

### ⭐ 1. Mandate — a portable, revocable, auditable spend credential

**One line:** A human signs a *mandate* (merchant scope, cap, window, purpose); the mandate is anchored on Monad and becomes the only thing that can cause a Rain card to exist. Every authorization writes a receipt back against the mandate.

**Why it wins:** This is literally Pooja Shah's four non-negotiables, implemented. The mandate is a typed EIP-712 object signed by the user's wallet, hashed onchain on Monad with the constraint set; your service verifies the signature and the constraints, then calls Rain to issue a scoped single-use card whose limits *derive from* the mandate rather than being typed in by hand. Revocation is a single onchain transaction — the user kills the mandate and no further card can be minted against it, verifiably, without trusting your server.

**Demo:** Split screen. Left: a chat agent booking a hotel. Right: a live mandate ledger. User signs "≤$400, hotels only, next 72h." Agent books — card issues, receipt appears. Then the agent tries a $900 flight: **declined, and the reason is legible on both sides.** Then the user hits revoke; the agent retries and gets nothing. That third beat is the whole pitch.

| | |
|---|---|
| Feasibility | ★★★★☆ — the core is one signed struct, one contract, one Rain call |
| Rain fit | ★★★★★ — extends the Agent Control Layer rather than duplicating it |
| Monad bounty | ★★★★☆ — real settlement + anchoring; strengthen it by settling actual stablecoin flows |
| Differentiation | ★★★★★ — this is the thing Rain says doesn't exist |
| Demo drama | ★★★★★ — the decline and the revoke are visceral |

**Sharpest risk:** if you only anchor a hash on Monad, Jarrod will read it as a logging table. Fix: make Monad load-bearing — settle the funding leg (user wallet → program wallet) onchain against the mandate, and/or let a merchant *verify the mandate directly* from the contract without calling your API.

---

### ⭐ 2. Agent Spend Firewall — policy-as-code proxy + live audit plane

**One line:** A drop-in proxy in front of Rain's API. Agents call it exactly like they'd call Rain; it enforces declarative policy, and every decision streams to a real-time audit console with anomaly scoring against a per-agent behavioral baseline.

**Why it wins:** This is Kevin Carr's post as software. It hits three judges at once — Siggy (DX: you change one base URL), Farhan (the transactional gate), Juan (the data plane). Policies are a YAML/TS file in the agent's repo, versioned and reviewable in a PR, which is a story Siggy in particular will feel.

**Demo:** Run 200 synthetic agent transactions through it in 30 seconds — Monad's throughput makes this look good — and watch the console classify them. Then inject a prompt-injected agent that tries to drain the balance across 40 small merchants; the firewall catches the *pattern*, not the individual transaction, because no single transaction is out of bounds.

| | |
|---|---|
| Feasibility | ★★★★★ — a proxy plus a dashboard; degrades gracefully if Rain access is slow |
| Rain fit | ★★★★☆ — could read as "we rebuilt the Agent Control Layer"; frame it as the *authoring and observability* layer above it |
| Monad bounty | ★★☆☆☆ — weak unless you commit the decision log onchain as verifiable receipts |
| Differentiation | ★★★☆☆ — the crowded lane; several teams will attempt policy engines |
| Demo drama | ★★★★☆ |

---

### 3. Agent Treasury — card-in / x402-out, both directions

**One line:** An agent that both *earns* (sells its output via x402 metered endpoints on Monad) and *spends* (Rain scoped card at any of 175M merchants), with a single balance sheet and an autonomous funding policy in between.

**Why it wins:** It's the only idea that makes both platforms structurally necessary rather than decoratively present. Rain is the on/offramp and the card; Monad is where the machine-to-machine revenue actually lands. Use the x402 `v2-eip155-upto` scheme for metered billing (LLM tokens, bandwidth) — almost nobody will, and it's the more interesting half of the spec.

**Demo:** A research agent sells reports for $0.02/request. It accumulates USDC on Monad. When its balance crosses a threshold it offramps a slice via Rain and buys the paid data subscription it needs to keep working. Closed loop, no human in the funding path — but every step inside a mandate.

| | |
|---|---|
| Feasibility | ★★★☆☆ — two rails, two failure surfaces, real integration cost |
| Rain fit | ★★★★☆ — uses onramp, offramp, wallets, *and* cards |
| Monad bounty | ★★★★★ — the strongest Monad story on the list |
| Differentiation | ★★★★☆ |
| Demo drama | ★★★☆☆ — "balance goes up, balance goes down" needs help to feel exciting |

---

### 4. Agent Credit — reputation-collateralized spend limits via ERC-8004

**One line:** Agents register identity on Monad's ERC-8004 Identity Registry; counterparties post immutable feedback to the Reputation Registry; an agent's Rain spend ceiling is a function of its onchain track record.

**Why it wins:** It answers a question nobody else will ask — *how does a brand-new agent earn the right to spend more?* Underwriting for machine actors. This is a genuinely novel primitive and both registries are already live on Monad mainnet, so the plumbing is real, not simulated.

**Risk:** reputation systems are trivially sybil-attackable, and Farhan and Juan will ask about it within ten seconds. Have an answer (stake-weighted feedback, or feedback only from counterparties who actually paid via x402 — payment as proof-of-interaction). If your answer is good this becomes a strong project; if you haven't thought about it, it collapses on stage.

| | |
|---|---|
| Feasibility | ★★★☆☆ | Rain fit ★★★☆☆ | Monad bounty ★★★★★ | Differentiation ★★★★★ | Demo drama ★★★☆☆ |

---

### 5. Procurement Desk — multi-agent B2B negotiation with scoped settlement

**One line:** A buyer agent solicits quotes from supplier agents, negotiates, and settles — Rain offramp to the vendor's bank account or stablecoin wallet — all inside a human-defined approved-vendor mandate that requires human action to change.

**Why it wins:** The most *enterprise-real* idea here, and it's the exact scenario Rain's own money-movement controls describe ("restrict agents to approved vendors, on a defined schedule, for a defined amount"). Rob Hadick and Arnav Bimbhet will see the B2B TAM immediately.

**Risk:** multi-agent negotiation demos are fragile and often read as theater. The judges are engineers; they'll discount the LLM chatter and look for the settlement. Keep negotiation to 2 rounds and spend your polish on the money movement.

| | |
|---|---|
| Feasibility | ★★★☆☆ | Rain fit ★★★★☆ | Monad bounty ★★☆☆☆ | Differentiation ★★★☆☆ | Demo drama ★★★★☆ |

---

### 6. Rewards for machines — programmable loyalty on agent spend

**One line:** Agent-initiated purchases accrue rewards onchain; merchants bid for agent routing preference; the rewards logic is a contract, not a T&C page.

**Why it consider it:** Ross Basri led Rain Rewards and co-founded an onchain loyalty company that Rain acquired. This is the single most *personally* resonant idea for one specific judge, and Rain Rewards is a live product surface. If agents become the buyers, "who captures the interchange and the loyalty value" becomes a real strategic question.

**Risk:** narrower than the others, and it's a business-model idea more than an infrastructure one. Only pick this if it genuinely excites you — a hedged version of this idea will be obvious.

| | |
|---|---|
| Feasibility | ★★★★☆ | Rain fit ★★★★☆ | Monad bounty ★★★☆☆ | Differentiation ★★★★☆ | Demo drama ★★★☆☆ |

---

## What I'd actually build

**Mandate (#1) as the spine, with the Firewall's audit console (#2) as the surface you demo.**

The reasoning: #1 gives you the conceptual claim that maps onto Rain's published roadmap, and it's the smallest thing that is genuinely new — one signed struct, one contract, one issuance call. #2 gives you the visual. A signed mandate with no console is invisible on stage; a console with no mandate underneath is a dashboard. Together they're a product.

Then, if you have hours left on Sunday morning, bolt on the narrowest slice of #3: fund one card from x402 revenue earned on Monad. That single flow converts you from "Rain project that mentions Monad" into a live candidate for the Mac Mini.

Sequence it so each stage is independently demoable — see the checkpoint schedule in `03-demo-pitch-template.md`. If Rain sandbox access is delayed, stages 1 and 2 still work against a mock and you demo the mandate + console, which is 80% of the pitch.

**A note on scope discipline:** you have roughly 13–15 real build hours. Every idea above is scoped to be *under*-ambitious on purpose. The failure mode at hackathons with strong engineers is not building something too simple; it's a half-working three-part system that dies in the demo. Pick the thing you can make work end to end by Saturday 9pm, and spend Sunday morning making it *legible*.
