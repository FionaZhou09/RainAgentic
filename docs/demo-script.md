# Weekend Game Plan, Demo Script & Pitch Template

---

## Part 1 — The time you actually have

Submissions close Sunday 12:00 PM. Hacking starts Saturday 1:00 PM. That looks like 23 hours; it is not.

| Block | Hours | Notes |
|---|---|---|
| Sat 1:00–6:00 PM | 5.0 | Your best block. Highest energy, everyone present. |
| Sat 6:00–8:00 PM | 0.0 | Hometown BBQ dinner. **Go.** This is where the Rain team is reachable. |
| Sat 8:00–9:00 PM | 1.0 | Venue wraps ~9:00 PM |
| Sat 9:00 PM–late | 2–4 | Offsite, degrading returns. Sleep is a competitive advantage here. |
| Sun 9:00 AM–12:00 PM | 3.0 | **Not build time — this is demo-prep time.** |

**Realistic build budget: 13–15 hours, of which only 6 are prime.**

The hard read: whatever isn't working by **Saturday 9:00 PM** is not going to be in the demo. Plan for a Saturday-night feature freeze and treat Sunday morning as recording, rehearsal, and slides. Teams that keep coding until 11:55 AM Sunday demo badly and lose to weaker projects with better demos. This is the most reliable pattern at hackathons of this size.

---

## Part 2 — Hour-by-hour

### Saturday

**9:00–11:00 AM — the most valuable two hours of the weekend, and most people waste them**

- [ ] Arrive at 9:00. Not 10:30.
- [ ] **Get Rain sandbox credentials and the `docs.rain.xyz` access code.** Before the keynote. Find a Rain engineer at breakfast and ask directly. This is the single highest-leverage action of the weekend — it's your only true external dependency.
- [ ] Read the API reference for issuance + Agent Control Layer fields while it's quiet.
- [ ] Find teammates if you're not pre-formed. Look for one person who can make a UI look good — for a 3-minute demo that is worth more than a third backend engineer.
- [ ] Confirm your scope in one written sentence before hacking starts.

**11:00 AM–12:30 PM — sessions.** Don't code through these.

- Charles Yoo-Naut (CTO keynote) will describe Rain's product direction. **Write down the exact phrases he uses.** Echoing his framing in your Sunday pitch is nearly free and disproportionately effective.
- Rain workshop (11:30): ask your §2.6 questions. Especially *how to simulate an authorization*, not just an issuance.
- Monad workshop (12:00): Jarrod owns the bounty. Ask him directly what would make a build a serious contender. He'll tell you.

**12:30–1:00 PM — lunch.** Sketch the demo storyboard on paper *now*, before writing code. Working backward from the demo is the discipline that saves you Sunday.

**1:00–3:00 PM — Stage 1: mandate → card, end to end**
Signed EIP-712 mandate → server verifies → Rain issues a scoped card. Ugly console output is fine. **Do not touch the UI yet.**
→ *Checkpoint: a card exists because a signature authorized it.*

**3:00–5:00 PM — Stage 2: contract + enforcement**
Deploy `MandateRegistry` to Monad testnet. Creation and revocation events. Server reads state from chain, not just its database. Enforce a constraint and produce a *legible* decline.
→ *Checkpoint: a decline you can explain, and a revocation that actually blocks issuance.*

**5:00–6:00 PM — Stage 3: the console**
Live mandate list, authorization stream, decision reasons. This is what the judges see; it deserves real hours.
→ *Checkpoint: the demo is watchable.*

**6:00–8:00 PM — dinner. Actually go.**
Talk to Rain engineers about what you're building. Two things happen: you get unstuck on API details, and a judge arrives Sunday already primed on your project. The dinner is not a break from the hackathon.

**8:00–9:00 PM — integrate and cut.**
Full run-through of the three-beat demo. Write down everything broken. Then **cut ruthlessly** — anything not in the demo path is deleted from the plan, not "maybe later."

**Evening (optional, 2–4h) — Monad depth**
Only if Stages 1–3 are solid: make Monad load-bearing (independent merchant-side verification, or settle a funding leg onchain), or bolt on the x402 earning loop. **Hard stop at midnight.** A tired mistake in the settlement path Saturday night is a broken demo Sunday.

### Sunday

**9:00–10:00 AM — freeze and record.**
Feature freeze at 9:00, no exceptions. Then **screen-record a clean run of the full demo.** Two takes. This is your insurance policy: if the venue wifi dies or the Rain sandbox hiccups at 3:15 PM, you narrate over video and nobody cares. Teams that skip this and then hit a live failure lose outright.

**10:00–11:15 AM — slides.** Five, per Part 4 below. Not fifteen.

**11:15–11:45 AM — rehearse out loud, three times, timed.** Out loud, standing up. The first time you say it, it will be 6 minutes; you need 3. The cutting only happens by rehearsing.

**11:45 AM–12:00 PM — submit.** Buffer for the submission form being slower than you expect. Submit at 11:50, not 11:59.

**12:00–3:00 PM — judging period.** Lunch, boba, and conversations. Be findable and be able to give the 60-second version on demand. This window matters more than people assume — most judging conviction forms in hallway conversations, not in the 3-minute stage slot.

**3:15 PM — demos.**

---

## Part 3 — Demo script (3 minutes)

The structure that works: **one concrete story, three beats, and the third beat is the one nobody else will have.**

Most teams demo the happy path. The happy path is the least interesting thing about a permissions system. **Your differentiation is the denial and the revocation** — they're what prove the constraint is real rather than decorative.

### 0:00–0:25 — the problem, as a specific scene

> "Ten minutes ago I gave an AI agent my credit card number to book a hotel. It now has my 16-digit PAN — the same number, valid at every merchant on earth, for the next three years. I have no way to tell it 'hotels only, four hundred dollars, this week,' and no way to take it back except calling my bank and cancelling the card.
>
> Rain's Head of Product wrote last month that the credential can't express what an agent is allowed to do — only that an account exists. That's the gap. We built the credential that closes it."

Why this works: it's a scene rather than a market-size claim, and it quotes Rain's own product thesis back to a room containing Rain's product leadership. Do not open with "the agentic commerce market is projected to."

### 0:25–1:15 — Beat one: consent, and it works

Live, on screen. Sign the mandate in the wallet — **make sure the wallet's EIP-712 rendering is visible**, because seeing human-readable terms in a signature prompt is the whole idea made concrete.

> "I'm signing a mandate: hotels only, four hundred dollars max, seventy-two hours. Notice I'm signing *readable terms*, not a hash. That's on Monad now — revocable, auditable, and the merchant can verify it without asking my server for permission."

Agent books the hotel. Card issues. Receipt appears on the right.

> "Rain issued a single-use scoped card derived from that mandate. The limits weren't typed into an API call by me — they were *derived from a signature the user made*. The agent never saw a permanent credential."

### 1:15–2:00 — Beat two: it says no, legibly

> "Now the agent tries to book a flight. Nine hundred dollars, wrong category."

**Declined.** Show both sides: what the agent sees, and the audit entry with the reason.

> "That's not fraud detection after the fact. The card that could have made that purchase was never issued. Constraint instead of detection."

If you built anomaly detection, this is where the 200-transaction burst goes — a prompt-injected agent spreading spend across 40 merchants, each transaction individually in-bounds, the *pattern* caught. That earns the Monad throughput point without you having to assert it.

### 2:00–2:30 — Beat three: revocation (your closer)

> "The part nobody has: I change my mind."

One transaction. Mandate revoked onchain.

> "The agent retries — nothing. No card can be minted against that mandate again, and that's verifiable onchain without trusting us. Today, revoking an agent's spending authority means cancelling the card. Here it's a signature I can undo."

### 2:30–3:00 — what it means, and where it goes

> "So: a credential that identifies the funding source, carries human-approved constraints, is auditable by the user *and* the issuer, and is revocable. Rain's scoped cards for the 175 million merchants that exist today; x402 on Monad for machine-to-machine, where the buyer and seller are both software. Same mandate, both rails.
>
> This is roughly four hundred lines and one contract. The reason it's small is that Rain already built the enforcement layer — we built the consent layer on top of it."

That last line is deliberate: it's honest about scope, credits the platform, and positions the work as a component of Rain's stack rather than a competitor to it. Farhan and Charles will both register it.

### Demo hygiene

- **Play the recording if anything is fragile.** Nobody has ever been penalized for a smooth recorded demo. Plenty of teams have lost to a spinner.
- Zoom your editor and browser to ~150%. Judges are 20 feet away.
- Hide your bookmarks bar, Slack, and notifications. Quit everything else.
- Have the tab order set before you walk up. No hunting.
- **Do not read code on stage.** One architecture diagram if you must.
- Rehearse the handoff if two people present — awkward transitions cost real credibility.
- Never say "normally this works." Cut to the recording instead.

---

## Part 4 — Five slides

Backdrop only. The demo is the pitch.

**1 — Title.** Project name, one line, your names. *"Mandate — a portable, revocable spend credential for AI agents."*

**2 — The gap.** One visual: what a PAN carries (an account number) vs. what an agent purchase needs (funding source, constraints, audit trail, revocation). Cite Pooja Shah's four requirements. This slide earns you the right to the rest.

**3 — Architecture.** One diagram, five boxes: User wallet → Mandate (EIP-712) → MandateRegistry on Monad → your enforcement service → Rain scoped card issuance → merchant. Overlay the audit stream. Should be readable in four seconds.

**4 — What's real.** Be precise and be honest. What's live testnet, what's sandboxed, what's stubbed. Engineering judges trust teams that name their own limits, and they *will* find the seams if you don't. Name the hard ones yourself: MCC allowlists are coarse; final settlement amounts can differ from authorization; onchain mandate terms leak purchase intent unless you commit to hashes.

**5 — Where it goes.** Two beats: (a) the mandate is rail-agnostic — cards today for 175M merchants, x402/Monad for machine-to-machine tomorrow, same consent object; (b) the standards fight (ACP, AP2, UCP, x402) is about the checkout handshake, and delegated authority is the unclaimed layer beneath all of them.

---

## Part 5 — Questions they will ask

Have crisp answers. Six of these are near-certain.

**"How is this different from Rain's Agent Control Layer?"** — *The likeliest question; do not be caught flat.* The Control Layer enforces constraints Rain's partner sets at issuance time. Mandate makes the *user's* consent a portable, signed, independently verifiable object that determines what the partner is even allowed to request. It's the authoring and attestation layer above enforcement, not a replacement for it. It also survives across rails: the same mandate governs a card purchase and an x402 payment.

**"Why does this need a blockchain?"** — *You will be asked this. A weak answer here undoes the whole pitch.* Three properties a database can't give you: the user can verify their own constraints without trusting the operator; a counterparty can verify a mandate without an API relationship with us; and revocation is publicly observable, so "we didn't get the revocation in time" stops being available as an excuse. If your build only anchors hashes, say so plainly and describe the settlement path you'd build next — that's more credible than overclaiming.

**"Sybil / who can post reputation?"** (if you touched ERC-8004) — Only counterparties who actually paid via x402, so feedback is gated by a real economic interaction. Weight by transaction value and recency. Be honest that it's mitigation, not a solution.

**"What about MCC granularity?"** — MCCs are coarse and frequently miscoded; merchant-ID allowlists are precise but don't scale to open-ended shopping. Real systems need both plus a merchant-identity layer. Naming this unprompted signals you've thought past the demo.

**"What happens when the settled amount exceeds the authorization?"** (hotel incidentals, tips, fuel) — The classic issuing edge case, and the sort of thing Farhan asks. Options: a headroom allowance in the mandate, or a mandate that permits a bounded post-auth adjustment. Have a position.

**"Where do the keys live?"** — Server-side signing, nothing in the client. If you're using a session key or delegated signer for the agent, be able to describe its scope and expiry. "In the .env" is a fine hackathon answer *if* you can describe the production design.

**"What's the business here?"** (Rob Hadick, Arnav Bimbhet) — Don't invent a revenue model. Say honestly: this is infrastructure that makes agentic spend underwritable, and it accrues to whoever issues the credential. That's Rain. It expands the addressable volume rather than creating a new toll.

**"What would you build next with a month?"** — Have a real answer. Suggested: merchant-side verification SDK so the constraint is checkable at checkout without any Rain API call, plus dispute resolution keyed to the mandate — because "the agent did it" is the liability question the whole category is going to hit.

---

## Part 6 — Failure modes to avoid

Ranked by how often they actually decide outcomes:

1. **Coding until the submission deadline.** Freeze Saturday 9 PM. Sunday morning is for the demo.
2. **No recorded backup.** Ten minutes of insurance against the most common way good projects lose.
3. **Skipping the BBQ to code.** The Rain team is at dinner. Access to them is a listed feature of this event.
4. **Demoing only the happy path.** Everyone will. The decline and the revocation are your differentiation.
5. **Three half-built features instead of one working one.** Six prime hours. Pick one thing.
6. **Waiting for the workshop to get Rain credentials.** Ask at 9:00 AM.
7. **Overclaiming on stage.** Six engineering judges. They will find the seam, and finding it themselves is much worse than you naming it.
8. **Reading code aloud in a 3-minute slot.** No.
9. **Faucet cooldowns discovered at 2 PM Saturday.** Four funded addresses on Friday night (see the prep brief, §2.3).
10. **Sleeping four hours.** Sunday morning judgment is worth more than Saturday-night lines of code.

---

## Two last things

**Submit something at 11:00 AM Sunday even if it's incomplete**, then update it. Submission systems fail and deadlines are enforced.

**The prize is a dinner with the founders and hiring conversations.** That reframes what you're optimizing for. Being memorable, technically honest, and genuinely interesting to talk to in the 12:00–3:00 judging window is worth as much as the code. Have a clean 60-second version ready for the hallway, and be someone the Rain team wants to keep talking to.
