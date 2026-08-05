# Interface Contracts — FROZEN v1.0

**Supersedes** `EXECUTION-PLAN.md` §5 and `SourcePilot-PRD-v2.md` §7 and §9.
**Amended for** D0, D1, D3, D4, D5, D6, D7. **Status:** frozen pending boss eyeball; no parallel work starts until then.

**Change control:** no agent may alter a signature in this file. A package that believes a signature is wrong stops and escalates to me. Types live in `sourcepilot/lib/contracts/` and are imported everywhere — nothing is redeclared locally.

**Amendment log vs. EXECUTION-PLAN §5**

| # | Ruling | What changed here |
|---|---|---|
| 1 | D0 | `mandateHash` is a **return value**, never an input to `create`. `MandateInput` carries all twelve signed fields. TS client asserts the on-chain hash equals the locally computed one. |
| 2 | D1 | `maxLandedPerUnit` = `cents(1200)`. `LANDED_OVER_BUDGET` moved out of `hardFailures` into `advisories` — **price can no longer eliminate anyone**. |
| 3 | D3 | `maxTotalMinor` = `184_000n`. Harness gains `fireSample(n)` so sample 2 (succeeds, $1 left) and sample 3 (`ExceedsMaxTotal`) are on-demand. |
| 4 | D4 | wagmi deleted from every surface. `revoke` is a `cast send` command string, not a client method. Wallet EIP-712 rendering is a Friday screen recording. |
| 5 | D5 | `poValueMinor` caller-asserted, emitted, bound in `PaymentApproval`. `APPROVAL_ONCHAIN_VERIFY` flag reserved for the Saturday-evening 45-min upgrade. Language discipline pinned as a code constant. |
| 6 | D6 | `idempotencyKey` typed as a branded `AttemptKey`, minted only by `newAttemptKey()`. Three ratified wordings pinned in `DEMO_COPY`. |
| 7 | D7 | §5.7 pipeline is normative; PRD §9 ordering is dead. |
| 8 | Boss-approved amendment, 2026-08-05 | Removed `ConstraintPreview` and `previewConstraints`. `simulateRecord` is the only constraint preview, so local code cannot drift from Solidity enforcement. |
| 9 | A2, boss-approved 2026-08-05 | Canonical mandate domain, hash, sign, and recovery helpers now require explicit `chainId` and `verifyingContract`. No implicit Monad default; RegistryClient uses the same helper. |
| 10 | A3, boss-approved 2026-08-05 | Approval helpers use the same explicit domain; `SerializedApproval` canonically carries all six fields; `PayRequest.approvalNonce` propagates the signed nonce unchanged. |

---

## 1. Money, identifiers, rounding — unchanged from §5.1

```ts
// lib/contracts/money.ts
/** Integer US cents. Never a float. Never dollars. */
export type Cents = number & { readonly __brand: "Cents" };
/** Basis points. 3000 = 30.00%. */
export type Bps = number & { readonly __brand: "Bps" };

export type Hex = `0x${string}`;
export type Address = Hex;
export type Bytes32 = Hex;

export function cents(n: number): Cents;   // throws RangeError on non-integer
export function bps(n: number): Bps;       // throws RangeError outside [0, 10_000]

/**
 * THE ONLY rounding rule in this codebase: half-up, at cent granularity,
 * applied once per derived line item, never to an already-rounded value.
 * Integer arithmetic; the divisor is always 10_000.
 */
export function applyBps(base: Cents, rate: Bps): Cents;

export function fmtUSD(c: Cents): string;  // display only — never re-enters arithmetic
export function perUnit(total: Cents, qty: number): { exactMilliCents: number; display: string };
```

---

## 2. Sourcing types — WP1 · **amended for D1**

```ts
// lib/contracts/sourcing.ts
export interface PurchaseRequest {
  id: string;                    // "PR-1042"
  idHash: Bytes32;               // keccak256(utf8(id)) — the signed purchaseRequestId
  product: string;
  quantity: number;              // 600
  /**
   * D1: $12.00/unit. INFORMATIONAL REFERENCE ONLY.
   * Rendered as a badge, emitted in the rationale, and NEVER an elimination gate.
   * A quote over this budget still ranks. See `advisories` below.
   */
  landedPerUnitReference: Cents; // cents(1200)
  maxLeadTimeDays: number;       // 60   — hard gate
  minSpecMatchPct: number;       // 90   — hard gate
  /** Mirrors the mandate's maxDepositBps for UI badging. THE CONTRACT IS THE AUTHORITY. */
  maxDepositBps: Bps;            // 3000 — hard gate (sourcing-side badge only)
  destination: "US";
}

/** Exactly six. `samplingFee` is intentionally absent: a stated $0.00 is data, not a gap. */
export const REQUIRED_QUOTE_FIELDS = [
  "unitPrice", "quantity", "shipping", "leadTimeDays", "depositBps", "specMatchPct",
] as const;
export type RequiredQuoteField = (typeof REQUIRED_QUOTE_FIELDS)[number];

/** null = not stated by the supplier. 0 = stated as zero. These are different facts. */
export interface QuoteInput {
  id: string; supplierId: string; purchaseRequestId: string;
  currency: "USD";
  unitPrice: Cents | null; quantity: number | null;
  samplingFee: Cents | null; shipping: Cents | null;   // seller-arranged freight; part of PO value
  leadTimeDays: number | null; depositBps: Bps | null; specMatchPct: number | null;
}

export interface Supplier {
  id: string; name: string; country: string;
  payeeRef: string;                  // raw; normalize before hashing (§4)
  verificationStatus: "unverified";  // we do not verify suppliers. Out of scope, say so.
}
```

---

## 3. Cost and score — WP1 · **amended for D1**

```ts
// lib/cost/index.ts
export interface CostAssumptions {
  dutyRateBps: Bps;    // 1650
  paymentFeeBps: Bps;  // 100
  dutyLabel: string;   // "HTS 6109.10.00 MFN base rate — excludes Section 301 and trade-remedy tiers"
  fxNote: string;      // "USD only; FX hardcoded and out of scope"
}

export interface CostBreakdown {
  productSubtotal: Cents;
  samplingFee: Cents;
  shipping: Cents;
  /** product + sampling + seller-arranged freight. THE maxDepositBps DENOMINATOR. */
  poValue: Cents;
  dutyEstimate: Cents;   // applyBps(productSubtotal, dutyRateBps) — goes to customs, never a payee
  paymentFee: Cents;     // applyBps(poValue, paymentFeeBps)
  landedTotal: Cents;    // poValue + dutyEstimate + paymentFee
  landedPerUnitMilliCents: number;
  depositDue: Cents;     // applyBps(poValue, quote.depositBps)
}

export type CostResult =
  | { kind: "complete"; breakdown: CostBreakdown }
  | { kind: "incomplete"; missing: RequiredQuoteField[] };  // C. No partial totals — unquotable means unquotable.

export function computeLandedCost(q: QuoteInput, a: CostAssumptions): CostResult;
export function missingRequiredFields(q: QuoteInput): RequiredQuoteField[];
```

```ts
// lib/score/index.ts
export type PolicyFailureCode =
  | "MISSING_REQUIRED_FIELD" | "LEAD_TIME_OVER" | "SPEC_MATCH_UNDER" | "DEPOSIT_OVER_CAP";

/** D1: no longer a failure code. Advisory only, and it CANNOT appear in `hardFailures`. */
export type AdvisoryCode = "LANDED_OVER_REFERENCE";

export interface PolicyNote<C extends string> {
  code: C;
  field?: RequiredQuoteField;
  message: string;   // human-readable, rendered verbatim as a badge
  observed: string;  // "70 days"
  limit: string;     // "60 days"
}
export type PolicyFailure  = PolicyNote<PolicyFailureCode>;
export type PolicyAdvisory = PolicyNote<AdvisoryCode>;

export interface ScoreWeights { landedCost: number; leadTime: number; specMatch: number; completeness: number }

export interface QuoteAssessment {
  quoteId: string; supplierId: string;
  /** 100 * present/6. A=100, B=100, C=83.3 */
  completenessPct: number;
  cost: CostResult;
  /**
   * Sourcing eliminations only, and — per D1 — price is not among them.
   * Payment-authority failures come from the chain, never from here.
   */
  hardFailures: PolicyFailure[];
  /** D1: informational. Rendered as a neutral badge. NEVER affects rank or eligibility. */
  advisories: PolicyAdvisory[];
  /** null when cost is incomplete. Never score an unquotable quote — that would imply we priced C. */
  score: number | null;
  rank: number | null;  // null iff hardFailures.length > 0 || score === null
}

export function assessQuotes(
  pr: PurchaseRequest, quotes: QuoteInput[], suppliers: Supplier[], a: CostAssumptions,
): QuoteAssessment[];
```

**D1 done-criteria, pinned as WP1 tests (all must exist):**

1. `assessQuotes` never emits a `hardFailure` whose code relates to landed cost — assert `hardFailures.every(f => f.code !== "LANDED_OVER_REFERENCE" as never)` and assert the union type has no price member (compile-time).
2. Property test: for any `dutyRateBps` in `[0, 10_000]`, the set `{eliminated supplier ids}` is **constant** — `{A, C}` — and `rank === 1` is always B. This is the test that removes tariff policy from the critical path.
3. A eliminated on `DEPOSIT_OVER_CAP` (5000 > 3000). C eliminated on `MISSING_REQUIRED_FIELD["shipping"]`, and additionally carries `LEAD_TIME_OVER` (70 > 60) and `SPEC_MATCH_UNDER` (87 < 90).
4. B at exactly 3000 bps **passes** (`<=`, boundary pinned).
5. `samplingFee: 0` (C) is not missing; `shipping: null` (C) is. Completeness C = 83.3%, A = B = 100%.

---

## 4. Mandate, payee scope, approval — WP2 · **amended for D0, D3, D5**

```ts
// lib/mandate/types.ts
export interface MandateDomainConfig {
  chainId: 31337 | 10143;
  verifyingContract: Address;
}
export const mandateDomain = (config: MandateDomainConfig) => ({
  name: "SourcePilot", version: "1",
  chainId: config.chainId,
  verifyingContract: config.verifyingContract,
} as const);

/** Twelve fields. This list is the source of truth; MandateInput.sol mirrors it in this exact order. */
export const MANDATE_TYPES = {
  ProcurementMandate: [
    { name: "principal",         type: "address" },
    { name: "agent",             type: "address" },
    { name: "purchaseRequestId", type: "bytes32" },
    { name: "fundingSource",     type: "bytes32" },
    { name: "maxTotal",          type: "uint256" },  // cents. TOTAL PAYABLE TO SUPPLIERS.
    { name: "autonomousMax",     type: "uint256" },  // cents, per transaction
    { name: "maxDepositBps",     type: "uint256" },  // OF SUPPLIER PO VALUE
    { name: "payeeScope",        type: "bytes32" },
    { name: "purpose",           type: "string"  },
    { name: "validAfter",        type: "uint256" },
    { name: "validUntil",        type: "uint256" },
    { name: "nonce",             type: "bytes32" },
  ],
} as const;

export interface ProcurementMandate {
  principal: Address; agent: Address;
  purchaseRequestId: Bytes32; fundingSource: Bytes32;
  maxTotal: bigint; autonomousMax: bigint; maxDepositBps: bigint;
  payeeScope: Bytes32; purpose: string;
  validAfter: bigint; validUntil: bigint; nonce: Bytes32;
}

/**
 * D0: LOCAL PREDICTION ONLY. This value is NEVER transmitted to the contract as an input.
 * It exists so the client can assert equality against the hash the contract returns.
 * If they disagree, that is a P0 — throw, do not proceed.
 */
export function hashMandate(m: ProcurementMandate, domain: MandateDomainConfig): Bytes32;
export function signMandate(m: ProcurementMandate, domain: MandateDomainConfig, pk: Hex): Promise<Hex>;
export function recoverMandateSigner(m: ProcurementMandate, domain: MandateDomainConfig, sig: Hex): Address;

// ---- payee scope: published-preimage scheme ---------------------------------
/** trim → NFKC → lowercase → collapse internal whitespace. One implementation, UI and chain alike. */
export function normalizePayeeRef(raw: string): string;
export function hashPayeeRef(raw: string): Bytes32;   // keccak256(utf8(normalizePayeeRef(raw)))

export interface PayeeScope {
  scope: Bytes32;     // keccak256(concat(leaves)) — leaves STRICTLY ASCENDING
  leaves: Bytes32[];  // passed to record() as payeeSet
  preimage: string;   // newline-joined normalized refs. PUBLISHED alongside the mandate.
}
export function computePayeeScope(rawRefs: string[]): PayeeScope;
export function verifyPayeeScope(preimage: string, scope: Bytes32): boolean;   // what a third party runs

// ---- approval: escalation is itself signed (D5) -----------------------------
export const APPROVAL_TYPES = {
  PaymentApproval: [
    { name: "mandateHash", type: "bytes32" },
    { name: "payeeHash",   type: "bytes32" },
    { name: "amount",      type: "uint256" },  // cents
    { name: "poValue",     type: "uint256" },  // D5: binds the deposit denominator
    { name: "stage",       type: "uint8"   },
    { name: "nonce",       type: "bytes32" },
  ],
} as const;

export interface PaymentApproval {
  mandateHash: Bytes32; payeeHash: Bytes32;
  amount: bigint; poValue: bigint; stage: number; nonce: Bytes32;
}
export type SerializedApproval = {
  mandateHash: Bytes32; payeeHash: Bytes32;
  amount: string; poValue: string; stage: number; nonce: Bytes32;
};
export function hashApproval(a: PaymentApproval, domain: MandateDomainConfig): Bytes32;
export function recoverApprover(a: PaymentApproval, domain: MandateDomainConfig, sig: Hex): Address;

```

**Cross-language pin — WP2 writes it Friday, WP3's Foundry test asserts against it.** This is how a digest mismatch fails in a red test at 1:20 PM instead of inside `/api/pay` at 3:45 PM.

```ts
// lib/mandate/__fixtures__/digest-vector.json  (shape)
export interface DigestVector {
  registry: Address; mandate: ProcurementMandate;
  expectedDigest: Bytes32; signature: Hex; expectedSigner: Address;
  payeeRefs: string[]; expectedPayeeScope: Bytes32; expectedLeaves: Bytes32[];
  /** D0 addition: a struct differing from `mandate` in ONE field, with `signature` unchanged.
   *  WP3 must prove create() reverts BadSignature on it. This is the Farhan question, as a test. */
  tamperedMandate: ProcurementMandate;
}
```

---

## 5. Chain surface — WP3 (Solidity) ↔ WP5 (TypeScript) · **amended for D0, D4, D5**

```solidity
// contracts/src/MandateRegistry.sol — the normative Solidity surface.
// This block supersedes SourcePilot-PRD-v2.md §7. PRD to be corrected once WP3 lands (D0).
interface IMandateRegistry {
    /// D0: ALL TWELVE SIGNED FIELDS, in EIP-712 order. The digest is RECOMPUTED, never accepted.
    struct MandateInput {
        address principal;
        address agent;
        bytes32 purchaseRequestId;
        bytes32 fundingSource;
        uint256 maxTotal;
        uint256 autonomousMax;
        uint256 maxDepositBps;
        bytes32 payeeScope;
        string  purpose;
        uint256 validAfter;
        uint256 validUntil;
        bytes32 nonce;
    }

    error MandateExists();   error UnknownMandate();  error BadSignature();
    error NotAgent();        error NotPrincipal();
    error Revoked();         error NotYetValid();     error Expired();
    error PayeeOutOfScope(); error ExceedsMaxTotal(); error DepositCapExceeded();
    error BadPayeeSet();     // payeeSet doesn't hash to payeeScope, or isn't strictly ascending
    error BadApproval();     // reserved for the D5 on-chain upgrade; unused in v1

    /// D0 — NO mandateHash PARAMETER. Recomputes the EIP-712 digest over all twelve fields of `m`
    /// (keccak of the `purpose` string, per EIP-712 string encoding), ecrecovers `sig`,
    /// requires signer == m.principal else BadSignature().
    /// Reverts MandateExists() if that digest is already registered (nonce replay).
    /// Stores the enforceable subset PLUS `agent` and `nonce`.
    /// @return mandateHash the digest the CONTRACT computed. The only authoritative source of it.
    function create(MandateInput calldata m, bytes calldata sig) external returns (bytes32 mandateHash);

    /// Called BEFORE Rain. msg.sender MUST be the mandate's `agent` (closes trap 10 on-chain).
    /// `mandateHash` here is a LOOKUP KEY into already-registered state, not a trust input —
    /// an unregistered key reverts UnknownMandate().
    /// Reverts: Revoked, NotYetValid, Expired, PayeeOutOfScope, ExceedsMaxTotal,
    ///          DepositCapExceeded (stage == 1 only; `poValueMinor` is caller-asserted — D5).
    /// Deposit check uses <= : amount * 10000 <= poValueMinor * maxDepositBps  (B sits at exactly 3000).
    /// Increments `spent` and emits PaymentAuthorized on success.
    /// AMENDMENT A1 (Wed) — `approvalSig` + `approvalNonce` added. R4 was unimplementable
    /// without them: `PaymentApproval` carries a `nonce`, and none of the six original
    /// parameters let the contract reconstruct it, so the approval digest was literally
    /// uncomputable on-chain. Deriving it from `spent` was rejected — it breaks silently
    /// whenever another payment lands between signing and execution.
    /// `approvalNonce` is recorded in a used-nonce map: an approval cannot be replayed
    /// for a second identical payment. That is the D6 hazard in another coordinate.
    /// Both are ignored when `stage != 1`.
    function record(
        bytes32 mandateHash,
        uint256 amountMinor,
        bytes32 payeeHash,
        bytes32[] calldata payeeSet,
        uint256 poValueMinor,
        uint8   stage,
        bytes   calldata approvalSig,     // A1 — empty when stage != 1
        bytes32 approvalNonce             // A1 — must match the signed PaymentApproval.nonce
    ) external returns (uint256 remainingMinor);

    /// D4: principal only. Called from a visible terminal via `cast send`. No server path, no wagmi.
    function revoke(bytes32 mandateHash) external;

    /// On demand only — testnet caps eth_call at 25 rps. No polling loops anywhere.
    function remaining(bytes32 mandateHash) external view returns (uint256);

    event MandateCreated(bytes32 indexed mandateHash, address indexed principal, address indexed agent);
    /// D5: poValueMinor is emitted so the deposit ratio is third-party recomputable from chain data alone.
    event PaymentAuthorized(bytes32 indexed mandateHash, uint256 amountMinor, bytes32 payeeHash,
                            uint256 poValueMinor, uint8 stage, uint256 remainingMinor);
    event MandateRevoked(bytes32 indexed mandateHash, uint256 at);
}
```

**WP3 done-criteria (each a separate `forge test`, all must be red-then-green):**

- `create` on the digest-vector fixture returns exactly `DigestVector.expectedDigest`.
- `create` on `tamperedMandate` with the unchanged signature reverts `BadSignature`.
- `create` twice on the same input reverts `MandateExists`.
- `record` reverts on each of the five conditions **individually**.
- `record` at exactly 3000 bps **succeeds** (`<=` boundary).
- `record` from a non-agent `msg.sender` reverts `NotAgent`.
- `record` with a `payeeSet` that is out of order, or doesn't hash to `payeeScope`, reverts `BadPayeeSet`.
- `revoke` from a non-principal reverts `NotPrincipal`; after `revoke`, `record` reverts `Revoked`.
- D3 sequence: with `maxTotal = 184_000`, `record` 18_000 → 147_900 → 18_000 all succeed (remaining 100), and the next 18_000 reverts `ExceedsMaxTotal`.
- **R4 (condition 5), red first:** a `stage == 1` payment carrying a valid `PaymentApproval` signature over a **different `poValueMinor`** than the one passed to `record` reverts `BadApproval`. Without this test, (b) buys nothing it claims to buy.

```ts
// lib/chain/registry.ts   — viem only. D4: wagmi is NOT a dependency of this or any other module.
export const STAGE = { sample: 0, deposit: 1, balance: 2 } as const;
export type Stage = keyof typeof STAGE;

/** 1:1 with the Solidity custom errors. WP5 decodes to this; WP6 renders one sentence per case. */
export type RevertReason =
  | "MandateExists" | "UnknownMandate" | "BadSignature" | "NotAgent" | "NotPrincipal"
  | "Revoked" | "NotYetValid" | "Expired" | "PayeeOutOfScope" | "ExceedsMaxTotal"
  | "DepositCapExceeded" | "BadPayeeSet" | "BadApproval" | "Unknown";

export const REVERT_COPY: Record<RevertReason, string> = {
  Revoked: "Mandate revoked on-chain. No further payment can be authorized against it.",
  PayeeOutOfScope: "Destination is not in the signed payee scope. No payment request was constructed.",
  ExceedsMaxTotal: "Payment would exceed the signed cumulative payment ceiling.",
  DepositCapExceeded: "Deposit exceeds the signed cap as a share of supplier PO value.",
  // ...one legible sentence per case. No raw revert strings on screen.
} as Record<RevertReason, string>;

export interface RecordArgs {
  mandateHash: Bytes32; amountMinor: bigint; payeeHash: Bytes32;
  payeeSet: Bytes32[]; poValueMinor: bigint; stage: Stage;
  /** A1 — required when stage === "deposit" and APPROVAL_ONCHAIN_VERIFY is true. */
  approvalSig?: Hex;
  /** A1 — must equal the signed PaymentApproval.nonce. The contract cannot derive it. */
  approvalNonce?: Bytes32;
}

export type SimulateResult =
  | { ok: true; remainingMinor: bigint }
  | { ok: false; reason: RevertReason; raw: string };

export type RecordResult =
  | { ok: true; txHash: Hex; remainingMinor: bigint; blockNumber: bigint }
  | { ok: false; reason: RevertReason; txHash: Hex | null };  // txHash non-null only when materializeRevert

export class MandateHashMismatch extends Error {}   // D0. Unrecoverable. Never swallowed.

export interface RegistryClient {
  /**
   * D0: `mandateHash` is READ BACK from the contract (simulate return value, confirmed against
   * the MandateCreated event). The client then asserts it equals hashMandate(m, explicitDomain)
   * and throws MandateHashMismatch on disagreement. We never send a hash and never trust ours.
   */
  create(m: ProcurementMandate, sig: Hex): Promise<{ txHash: Hex; mandateHash: Bytes32 }>;

  /** eth_call. Free, instant, yields the revert reason for the UI. ALWAYS called before record. */
  simulateRecord(a: RecordArgs): Promise<SimulateResult>;

  /** Real transaction, sent from the AGENT key. Never called if simulate failed, unless materializeRevert. */
  record(a: RecordArgs, opts?: { materializeRevert?: boolean }): Promise<RecordResult>;

  /** On user action only. NEVER in a poll loop — testnet caps eth_call at 25 rps. */
  remaining(mandateHash: Bytes32): Promise<bigint>;

  explorerTx(txHash: Hex): string;   // https://testnet.monadvision.com/tx/...

  /**
   * D4: revocation is NOT a client method. This returns the exact `cast send` line, printed by the
   * harness and pasted into a visible terminal on stage. Our server cannot revoke, and that is the point.
   */
  revokeCommand(mandateHash: Bytes32): string;
}
```

`materializeRevert` exists for exactly one beat — the revocation closer, where a **failed transaction with an explorer link** is more convincing than a simulated refusal. Default `false`, so the blocked-payee beat produces zero transactions and zero Rain calls.

**R4 — option (b) ratified. Built Wednesday, additive, not a refactor:**

```ts
/**
 * R4. Ships Wednesday alongside WP3. Drives DEMO_COPY.enforcementClaim (§8) — flipping this
 * flag changes the sentence said on stage, and WP9 asserts the two agree.
 *
 * ABORT CONDITION (R4 execution condition 4): if Wednesday's WP3 gate is not green on all
 * ten named tests, this stays false and we say the D5 sentence. (b) is an addition to a
 * working contract, never a repair of a broken one. The manager makes that call at the
 * Wednesday gate without escalating — both wordings already exist, which is the point.
 */
export const APPROVAL_ONCHAIN_VERIFY = false;   // ← left false until WP3's Wednesday gate is green
```
When true, `record` gains `bytes calldata approvalSig` and for `stage == 1` ecrecovers the `PaymentApproval` digest, requiring `signer == principal` else `BadApproval()`.

**What (b) buys, stated exactly** — this is what the round-2 sentence is built on. It binds `poValueMinor` to a signature from the principal that the contract itself checks. It does **not** make the PO value *true*; no contract can know what the supplier's real invoice says. The upgrade is *our server asserted it* → *the founder signed it and the chain checked her signature*. **Residual, on the record:** below `autonomousMax` there is no approval to check, so `poValue` there is still caller-asserted. Not in the stage sentence — every deposit in the demo is escalated — but that is the answer if anyone asks about the autonomous path.

---

## 6. Rain port — WP4 · **amended for D2, D6**

```ts
// lib/rain/port.ts
/** D6: per-ATTEMPT uuid v4. A content-derived key inverts the revocation closer. */
export type AttemptKey = string & { readonly __brand: "AttemptKey" };
/** The ONLY way to make one. Takes no arguments — it cannot be derived from payment content. */
export function newAttemptKey(): AttemptKey;

export interface CreatePaymentInstruction {
  mandateHash: Bytes32;
  payeeRef: string;          // already validated against payeeScope BY THE CONTRACT, not here
  amountMinorUnits: number;  // cents. never a float.
  currency: "USD";
  purchaseRequestId: string;
  stage: Stage;
  idempotencyKey: AttemptKey;
}

export interface RainPort {
  createPaymentInstruction(req: CreatePaymentInstruction): Promise<{ paymentId: string; status: string }>;
  getPaymentStatus(paymentId: string): Promise<{ status: string; ref?: string }>;
  /** Convenience/formatting only. NOT a security boundary — never gates a payment. */
  validateDestination(payeeRef: string): Promise<{ ok: boolean; reason?: string }>;
}

/** Mock invariants, testable:
 *  (1) same AttemptKey => same paymentId, no second effect;
 *  (2) DIFFERENT AttemptKeys with IDENTICAL content => TWO distinct attempts (D6 — this is what a retry is);
 *  (3) status advances created→submitted→settled on configured delays;
 *  (4) every call recorded so the harness can ASSERT ZERO CALLS on blocked beats. */
export interface MockRainAdapter extends RainPort {
  readonly calls: ReadonlyArray<{ at: number; method: string; req: unknown }>;
  reset(): void;
}
export interface MockRainConfig { statusDelaysMs: [number, number, number]; failPayeeRefs?: string[] }

/** D2: file exists so the swap is real; throws until the boss approves the attempt. */
export class NotApprovedError extends Error {}
```

**D2 amendment — mock fidelity is a done-criterion, not a nicety.** After Saturday 9:00 AM credentials, WP4 gets a 20-minute revision pass to align field names, minor-unit conventions, and idempotency semantics with the real API, recorded in `ASSIGNMENTS.md` as a diff. The mock is then evidence of comprehension rather than invention. The 30-minute authenticated round-trip is a **separate, read-only** assignment after the 4:30 checkpoint, gated on green, targeting the cheapest GET — never the payment path.

---

## 7. API surface and the enforcement pipeline — WP5 · **normative, supersedes PRD §9 (D7)**

```ts
// lib/contracts/api.ts

// ---- POST /api/analyze ------------------------------------------------------
export interface AnalyzeRequest { purchaseRequestId: string }
export interface Rationale {
  facts: string[];        // computed by /lib/cost and /lib/score. Slot-filled, never generated.
  assumptions: string[];  // duty label, hardcoded FX, freight assumption for C
  missingData: string[];  // named explicitly. "Supplier C did not state shipping."
  decision: string;
}
export interface AnalyzeResponse {
  pr: PurchaseRequest; assumptions: CostAssumptions;
  assessments: QuoteAssessment[];
  recommendation: { quoteId: string; rationale: Rationale };
}

// ---- POST /api/mandate -----------------------------------------------------
export interface MandateRequest {
  mandate: SerializedMandate;   // bigints as decimal strings
  signature: Hex;
  payeeRefs: string[];          // the PREIMAGE. Required — a commitment only we can open is not auditable.
}
export interface MandateResponse {
  /** D0: the value the CONTRACT returned, not one we computed and sent. */
  mandateHash: Bytes32;
  monadTxHash: Hex; explorerUrl: string;
  payeeScope: Bytes32; payeePreimage: string; recoveredSigner: Address;
  constraints: { maxTotalMinor: string; autonomousMaxMinor: string; maxDepositBps: number;
                 validAfter: number; validUntil: number };
}

// ---- POST /api/pay ---------------------------------------------------------
export interface PayRequest {
  purchaseRequestId: string; supplierId: string;
  payeeRef: string;            // raw. The changed-bank-account case arrives here and MUST reach the CONTRACT.
  amountMinor: number; stage: Stage;
  idempotencyKey: AttemptKey;  // D6: per attempt, uuid v4, from newAttemptKey()
  approvalSig?: Hex;           // required to complete a previously escalated payment
  approvalNonce?: Bytes32;     // A3: required with approvalSig; passed unchanged to record
  materializeRevert?: boolean; // harness only, default false
}

export type PayResponse =
  | { outcome: "autonomous"; paymentId: string; rainPaymentId: string;
      monadTxHash: Hex; explorerUrl: string; remainingMinor: string; events: EventRecord[] }
  | { outcome: "pending_approval"; paymentId: string; reason: string;
      approvalPayload: SerializedApproval; chainCalled: false; rainCalled: false; events: EventRecord[] }
  | { outcome: "approved"; paymentId: string; rainPaymentId: string;
      monadTxHash: Hex; explorerUrl: string; remainingMinor: string; approver: Address; events: EventRecord[] }
  | { outcome: "blocked"; paymentId: string; layer: "offchain" | "onchain";
      reason: RevertReason | PolicyFailureCode; message: string;
      monadTxHash: Hex | null; rainCalled: false; events: EventRecord[] };

/**
 * THE ORDER IS THE CONTRACT (D7 — this governs; PRD §9's ordering is dead).
 * Do not reorder. Do not add checks to step 2.
 *
 *  1. Idempotency lookup by ATTEMPT key. Hit => return the stored PayResponse verbatim.
 *     D6: the key is per-attempt, so the closer's retry is a NEW attempt and reaches step 5.
 *  2. Off-chain pre-checks, EXACTLY THREE:
 *       a. required quote fields present     -> blocked{layer:"offchain", MISSING_REQUIRED_FIELD}
 *       b. sourcing constraints — LEAD TIME, SPEC MATCH ONLY
 *          D1: landed-per-unit is INFORMATIONAL and must NOT block here.
 *       c. caller identity === mandate.agent -> blocked{layer:"offchain"}
 *     ⚠ NO payee scope. NO amount. NO deposit. NO expiry. NO revocation.
 *       Those five belong to the contract. Pre-empting them makes "the contract reverted" FALSE
 *       and the network panel proves the wrong thing. Easiest possible way to destroy the demo.
 *  3. Escalation gate: amount > autonomousMax && !approvalSig
 *       -> pending_approval. NO chain call, NO Rain call.
 *          Never debit the on-chain ceiling for a payment the founder may reject.
 *  4. If approvalSig present: recoverApprover === mandate.principal AND every field of the approval
 *     matches this request exactly (amount, payee, poValue, stage). No field may change after approval.
 *     ⚠ REDLINE 2 — step 4 is NOT a demo beat and NO script line depends on it. It produces
 *       blocked{layer:"offchain"}, and once R4 ships the same condition is also checked on-chain
 *       (BadApproval). Keep both — defense in depth — but we have exactly ONE blocked-by-contract
 *       beat and it is the changed payee. A second "blocked" flavor in the run of show dilutes
 *       the one carrying the argument. Do not surface this as a demo state.
 *  5. registry.simulateRecord  -> failure => blocked{layer:"onchain", reason}
 *  6. registry.record          -> failure => blocked{layer:"onchain", reason}
 *  7. rain.createPaymentInstruction  <-- THE FIRST RAIN CALL IN THE ENTIRE FLOW
 *  8. Persist Payment + append events; cache the response under the ATTEMPT key.
 */
export async function evaluatePayment(req: PayRequest, ctx: PayContext): Promise<PayResponse>;

// ---- event log + SSE -------------------------------------------------------
export type EventType =
  | "quotes_analyzed" | "mandate_registered" | "payment_attempted" | "precheck_failed"
  | "escalated" | "approval_signed" | "chain_authorized" | "chain_rejected"
  | "rain_instruction_created" | "rain_status" | "mandate_revoked";

export interface EventRecord {
  id: string; purchaseRequestId: string;
  type: EventType; actor: "user" | "agent" | "system";
  payload: Record<string, unknown>;  // redacted at the logger. Never a PAN, CVV, or key.
  createdAt: string;                 // ISO 8601
}
/** GET /api/events/stream?prId=PR-1042 — text/event-stream, `data: ${JSON.stringify(EventRecord)}\n\n` */
```

`Payment.outcome` is the union tag above — `autonomous | pending_approval | approved | rejected | blocked` — closing trap 9. The `rainCalled: false` literal on every blocked variant means **the compiler enforces our stage claim.**

---

## 8. Language discipline — WP6 UI copy and WP8 harness output · **D5, D6**

One module. WP6 and WP8 both import it, so the screen and the boss's mouth cannot diverge.

```ts
// lib/contracts/copy.ts
import { APPROVAL_ONCHAIN_VERIFY } from "@/lib/chain/registry";

/**
 * R4 — TWO-STATE. The flag decides the sentence; nobody types it by hand.
 * WP9 asserts the shipped string matches the shipped flag, so the contract cannot
 * diverge from the script any more than the screen can.
 */
export const ENFORCEMENT_CLAIM = {
  /** D5 sentence — used when APPROVAL_ONCHAIN_VERIFY === false. Verbatim, unchanged. */
  callerAsserted:
    "The contract enforces the ceiling, the payee scope, the time window, and revocation. " +
    "The deposit ratio is asserted by the caller and bound into the signed approval — " +
    "so it's auditable, but I won't claim it's unforgeable.",

  /** R4 round-2 ratified sentence — used when APPROVAL_ONCHAIN_VERIFY === true.
   *  Copied exactly from BOSS-DECISIONS-R2.md §R4. Do not edit without a boss ruling. */
  approvalVerified:
    "The contract enforces the ceiling, the payee scope, the time window, and revocation. " +
    "On this payment it also enforces the deposit cap — it checks the founder's approval " +
    "signature on-chain, so the PO value the ratio is measured against is one she signed, " +
    "not one our server asserted. What no contract can check is whether that PO value " +
    "matches the real invoice. That's the remaining seam, and I'd rather name it than let you find it.",
} as const;

export const DEMO_COPY = {
  /** Never the bare "the contract enforces the 30% deposit cap" — in EITHER state. */
  enforcementClaim: APPROVAL_ONCHAIN_VERIFY
    ? ENFORCEMENT_CLAIM.approvalVerified
    : ENFORCEMENT_CLAIM.callerAsserted,

  /** D6 — retry wording. "replay the same request" invites "so your idempotency is broken?" */
  retryLabel: "The agent tries that order again",

  /**
   * D6 + **Redline 1**. The mandate window is 90 days (§9 `validUntilOffsetDays: 90`).
   * The previous label, "Expires at the end of the month", was FALSE against a signed
   * field that renders in the D4 wallet screen-recording and is readable on the explorer.
   * It is now a banned string. "Sixty days" belongs to DELIVERY only — two distinct
   * numbers with distinct labels don't collide; a false one does.
   */
  mandateExpiryLabel: "Expires in ninety days",
  deliveryDeadlineLabel: "Delivery within sixty days",

  dutyLine:
    "HTS 6109.10.00 MFN base rate — excludes Section 301 and trade-remedy tiers",

  /** D1 — the per-unit badge is neutral, never an elimination reason. */
  landedReferenceLabel: "Landed budget reference: $12.00/unit (informational)",
} as const;
```

**Banned strings, enforced by a WP9 grep over `app/`, `lib/`, and harness output — a hit is a failing check:**
`replay the same request` · `enforces the 30%` · `enforces the thirty percent` · `expires in sixty days` (on any mandate surface) · **`expires at the end of the month`** (Redline 1 — it was the round-1 wording and it is now false; banned so it cannot drift back) · `over budget` as an elimination reason.

**Both `enforces the 30%` forms stay banned even after R4 ships.** The round-2 sentence never uses that phrasing, and the bare unqualified form must remain structurally unsayable.

**WP9 two-state check (R4 execution condition 2).** Assert that the string rendered on screen and printed by the harness equals `ENFORCEMENT_CLAIM.approvalVerified` when `APPROVAL_ONCHAIN_VERIFY === true`, and `ENFORCEMENT_CLAIM.callerAsserted` when it is `false`. A mismatch is a failing check, not a note.

---

## 9. Fixtures — WP1 writes, WP8 owns the harness · **amended for D1, D3**

```ts
// lib/fixtures/pr-1042.ts
export const PR_1042: PurchaseRequest = {
  id: "PR-1042", quantity: 600,
  landedPerUnitReference: cents(1200),   // D1: $12.00/unit, INFORMATIONAL
  maxLeadTimeDays: 60, minSpecMatchPct: 90, maxDepositBps: bps(3000), destination: "US",
};
export const ASSUMPTIONS: CostAssumptions = { dutyRateBps: bps(1650), paymentFeeBps: bps(100), /* ... */ };

// A: 640/600/12000/98000 · B: 685/600/18000/64000 · C: 595/600/0/null   (all Cents)
// Expected, unit-tested to the cent:
//   A poValue 494000  duty 63360  fee 4940  landed 562300  perUnit 9.3717  deposit@5000 247000
//   B poValue 493000  duty 67815  fee 4930  landed 565745  perUnit 9.4291  deposit@3000 147900
//   C incomplete: missing ["shipping"], completeness 83.3%

export const MANDATE_FIXTURE = {
  autonomousMaxMinor:  20_000n,   // $200.00 — the $180 sample sits under it
  maxTotalMinor:      184_000n,   // D3: $1,840. Demo spends $1,659, leaving $181.
  maxDepositBps:        3_000n,   // B is EXACTLY at the cap. Boundary test pinned.
  validAfterOffsetSec:     -60,   // clock skew
  validUntilOffsetDays:     90,   // mandate window 90 DAYS. Delivery deadline 60. Never conflate.
  signedAt: "prior session (Thursday) — visible timestamp in the UI",
} as const;

export const PAYEE_REFS = [
  "rain:payee:hanzhou-apparel",
  "rain:payee:yuanfeng-textiles",
  "rain:payee:rongcheng-garment",
];
export const FRAUD_PAYEE_REF = "rain:payee:hanzhou-apparel-new-account";  // must NOT be in PAYEE_REFS
```

**D3 harness contract — WP8 must expose this, it is the answer to "why does this need an agent?"**

```ts
// scripts/harness.ts
export interface DemoHarness {
  runLockedArc(): Promise<PayResponse[]>;   // the four scripted beats, cold start
  /**
   * D3: fire an additional $180 sample on demand, during Q&A.
   * After the locked arc ($1,659 spent, $181 remaining):
   *   fireSample(2) -> autonomous, remaining $1
   *   fireSample(3) -> blocked{layer:"onchain", reason:"ExceedsMaxTotal"}
   * The agent halts itself against a ceiling it did not choose. Non-circular.
   */
  fireSample(n: 2 | 3): Promise<PayResponse>;
  assertZeroRainCalls(): void;              // the blocked beats
  printRevokeCommand(): string;             // D4 — pasted into the visible terminal
}
```

---

## 10. What I need from you

Eyeball §5's Solidity block and §7's pipeline comment — those two are what everything else binds to. On your nod I freeze this file, create `ASSIGNMENTS.md`, and start the Friday lanes with faucets first (2-hour cooldown, four addresses).

Two things I am doing on my own authority unless you object: renaming `maxLandedPerUnit` → `landedPerUnitReference` so no agent can mistake it for a gate (D1), and adding `tamperedMandate` to the digest-vector fixture so the D0 defect has a permanent regression test.
