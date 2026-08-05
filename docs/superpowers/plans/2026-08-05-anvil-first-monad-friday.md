# Anvil-First, Monad-Friday Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish SourcePilot against the real Solidity contract on Anvil, deploy the identical contract to Monad by Friday, and generate final evidence only from the Monad-bound mandate.

**Architecture:** A single viem `RegistryClient` targets an explicitly configured chain; Anvil and Monad differ only by chain ID, RPC URL, registry address, and newly generated EIP-712 signature. API, UI, harness, and verification consume that client, while Rain remains behind the tested mock port until Saturday credentials arrive.

**Tech Stack:** Next.js 15 App Router, TypeScript, viem, Vitest, Foundry/Anvil, Solidity 0.8.24, Playwright for final evidence.

---

## File map

- `sourcepilot/lib/chain/config.ts`: validates explicit chain configuration and environment labels.
- `sourcepilot/lib/chain/registry.ts`: frozen declarations plus the viem implementation.
- `sourcepilot/lib/chain/registry.test.ts`: real-client integration tests against Anvil.
- `sourcepilot/lib/events/index.ts`: typed in-process event stream used by API and UI.
- `sourcepilot/app/api/{analyze,mandate,pay}/route.ts`: the three product routes.
- `sourcepilot/app/api/events/stream/route.ts`: server-sent event output.
- `sourcepilot/app/api/**/*.test.ts`: route and pipeline tests.
- `sourcepilot/lib/agent/{extract,rationale}.ts`: WP7 schema validation and deterministic rationale.
- `sourcepilot/components/` and `sourcepilot/app/{compare,approve}/page.tsx`: two-screen demo UI.
- `scripts/{start-anvil,sign-mandate,harness,verify-chain-claims}.ts`: local boot, signing, demo, and environment-claim guard.
- `sourcepilot/package.json` and root `package.json`: exact demo and verification commands.
- `sourcepilot/eslint.config.mjs`: ignores generated output so the lint gate evaluates source.
- `output/playwright/`: final post-Monad screenshots and evidence metadata.

## Task 1: Make chain selection explicit and truthful

**Files:**
- Create: `sourcepilot/lib/chain/config.ts`
- Create: `sourcepilot/lib/chain/config.test.ts`
- Modify: `sourcepilot/.env.secrets.local.example`

- [ ] **Step 1: Write failing configuration tests**

Test these exact cases: Anvil `31337` yields label `Local Anvil`; Monad `10143` yields label `Monad Testnet`; missing RPC URL or registry address throws naming the missing variable; any other chain ID throws `Unsupported chain`; a signing domain built from the configuration has the same chain ID and registry address as the client.

- [ ] **Step 2: Verify the red phase**

Run: `pnpm --filter sourcepilot test lib/chain/config.test.ts`  
Expected: FAIL because `./config` does not exist.

- [ ] **Step 3: Implement the smallest explicit configuration surface**

Use this public shape:

```ts
export type ChainEnvironment = Readonly<{
  chainId: 31337 | 10143;
  rpcUrl: string;
  registryAddress: Address;
  label: "Local Anvil" | "Monad Testnet";
}>;

export function loadChainEnvironment(env: NodeJS.ProcessEnv): ChainEnvironment;
```

Require `CHAIN_ID`, `CHAIN_RPC_URL`, and `MANDATE_REGISTRY_ADDRESS`. Do not fall back from Monad to Anvil or vice versa.

- [ ] **Step 4: Run the focused and full tests**

Run: `pnpm --filter sourcepilot test lib/chain/config.test.ts && pnpm test`  
Expected: configuration tests and all existing 119 tests pass.

- [ ] **Step 5: Commit**

```bash
git add sourcepilot/lib/chain/config.ts sourcepilot/lib/chain/config.test.ts sourcepilot/.env.secrets.local.example
git commit -m "feat: add explicit chain environment configuration"
```

## Task 2: Exercise the real registry client against Anvil

**Files:**
- Modify: `sourcepilot/lib/chain/registry.ts`
- Create: `sourcepilot/lib/chain/registry.test.ts`
- Create: `scripts/start-anvil.ts`
- Modify: root `package.json`

- [ ] **Step 1: Write failing viem integration tests**

Start one deterministic Anvil process for the test suite, deploy `MandateRegistry`, and test the frozen `RegistryClient` surface: `create` returns the on-chain hash and compares it with the local prediction; `simulateRecord` decodes `PayeeOutOfScope`; `record` returns a transaction hash and decrements remaining; `revokeCommand` contains the configured RPC URL and registry address. Use the existing fixture principal only for deterministic local tests.

- [ ] **Step 2: Verify the red phase**

Run: `pnpm --filter sourcepilot test lib/chain/registry.test.ts`  
Expected: FAIL because the declarations have no viem implementation.

- [ ] **Step 3: Implement the frozen interface without changing declarations**

Add a factory rather than changing `RegistryClient`:

```ts
export function createViemRegistryClient(args: {
  environment: ChainEnvironment;
  publicClient: PublicClient;
  walletClient: WalletClient;
}): RegistryClient;
```

Use the ABI generated from `IMandateRegistry.sol`; simulate before write; decode known custom errors into the existing `RevertReason`; throw `MandateHashMismatch` on create mismatch.

- [ ] **Step 4: Prove contract enforcement is real**

Run: `pnpm --filter sourcepilot test lib/chain/registry.test.ts && (cd sourcepilot/contracts && forge test)`  
Expected: registry integration tests pass; Foundry remains 24/24.

- [ ] **Step 5: Commit**

```bash
git add sourcepilot/lib/chain/registry.ts sourcepilot/lib/chain/registry.test.ts scripts/start-anvil.ts package.json
git commit -m "feat: connect registry client to real Anvil contract"
```

## Task 3: Implement WP7 independently

**Files:**
- Create: `sourcepilot/lib/agent/extract.ts`
- Create: `sourcepilot/lib/agent/extract.test.ts`
- Create: `sourcepilot/lib/agent/rationale.ts`
- Create: `sourcepilot/lib/agent/rationale.test.ts`

- [ ] **Step 1: Write the four required failing tests**

Assert valid fixture extraction succeeds, malformed quote extraction is rejected, Supplier C's rationale names missing `shipping`, and two renders from the same `QuoteAssessment` are byte-identical. Add an assertion that every number in the prose comes directly from the assessment input.

- [ ] **Step 2: Verify the red phase**

Run: `pnpm --filter sourcepilot test lib/agent`  
Expected: FAIL because both modules are absent.

- [ ] **Step 3: Implement schema validation and pure slot filling**

Do not compute cost, score, eligibility, or authorization in this package. Consume WP1 output and return the frozen `Rationale` shape.

- [ ] **Step 4: Run tests and commit**

Run: `pnpm --filter sourcepilot test lib/agent && pnpm test`  
Expected: all agent tests and the full suite pass.

```bash
git add sourcepilot/lib/agent
git commit -m "feat: add validated extraction and deterministic rationale"
```

## Task 4: Build WP5's ordered enforcement pipeline

**Files:**
- Create: `sourcepilot/lib/events/index.ts`
- Create: `sourcepilot/app/api/analyze/route.ts`
- Create: `sourcepilot/app/api/mandate/route.ts`
- Create: `sourcepilot/app/api/pay/route.ts`
- Create: `sourcepilot/app/api/events/stream/route.ts`
- Create: focused tests beside these files

- [ ] **Step 1: Write failing route tests around observable ordering**

Test `$180` autonomous with a chain hash and decremented remaining; `$1,479` pending approval with `chainCalled:false` and `rainCalled:false`; fraudulent payee blocked on-chain with zero Rain calls; revoke then retry blocked as `Revoked`; mandate creation returns the contract-read hash. Instrument the real Anvil registry client and `MockRainAdapter.calls` rather than substituting a registry mock.

- [ ] **Step 2: Verify the red phase**

Run: `pnpm --filter sourcepilot test app/api lib/chain`  
Expected: FAIL because the routes and events module do not exist.

- [ ] **Step 3: Implement the eight-step pipeline verbatim**

Keep a numbered comment in `pay/route.ts` matching `INTERFACE-CONTRACTS.md` §7. The only off-chain checks are required fields, lead time/spec sourcing constraints, and caller identity. Do not pre-check payee, amount, deposit, expiry, or revocation.

- [ ] **Step 4: Verify exact call boundaries**

Run: `pnpm --filter sourcepilot test app/api lib/chain`  
Expected: all route tests pass; both blocked cases have zero Rain calls; pending approval has zero chain calls.

- [ ] **Step 5: Commit**

```bash
git add sourcepilot/app/api sourcepilot/lib/events sourcepilot/lib/chain
git commit -m "feat: add contract-enforced payment pipeline"
```

## Task 5: Build the two-screen UI

**Files:**
- Create: `sourcepilot/lib/contracts/copy.ts`
- Create: `sourcepilot/components/` focused components and tests
- Create: `sourcepilot/app/compare/page.tsx`
- Create: `sourcepilot/app/approve/page.tsx`

- [ ] **Step 1: Write failing component tests**

Assert `RevertReason` mapping is total, badge transitions are deterministic, advisories use neutral styling and never appear as elimination reasons, Supplier C renders four badges, numeric score is absent, and environment label is always visible near transaction data.

- [ ] **Step 2: Verify the red phase**

Run: `pnpm --filter sourcepilot test components`  
Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement `/compare` and `/approve`**

Import every governed string from `DEMO_COPY`. Render rank and reasons, never score. Show `Local Anvil` during local development. Preserve enough space for the browser network panel during the blocked beat.

- [ ] **Step 4: Run tests and production build**

Run: `pnpm --filter sourcepilot test components && pnpm build`  
Expected: component tests pass and both routes appear in the successful Next.js build output.

- [ ] **Step 5: Commit**

```bash
git add sourcepilot/lib/contracts/copy.ts sourcepilot/components sourcepilot/app/compare sourcepilot/app/approve
git commit -m "feat: add SourcePilot comparison and approval screens"
```

## Task 6: Build the cold-start Anvil demo harness

**Files:**
- Create: `scripts/sign-mandate.ts`
- Create: `scripts/harness.ts`
- Create: `scripts/harness.test.ts`
- Modify: root `package.json`

- [ ] **Step 1: Write failing harness tests**

Assert the four ordered demo outcomes, `fireSample(2)` leaves `$1`, `fireSample(3)` returns `ExceedsMaxTotal`, both blocked beats have zero Rain calls, the revoke command is printed, and every emitted record carries `environment:"Local Anvil"` under chain `31337`.

- [ ] **Step 2: Verify the red phase**

Run: `pnpm exec vitest run scripts/harness.test.ts`  
Expected: FAIL because the harness does not exist.

- [ ] **Step 3: Implement cold-start orchestration**

The harness must start or connect to Anvil, deploy the real contract, sign against that deployed address, drive the API pipeline, and cleanly stop its child process. It must explicitly load `sourcepilot/.env.secrets.local` and must not print private keys.

- [ ] **Step 4: Prove the demo**

Run: `pnpm demo:all`  
Expected: all four outcomes in order, zero Rain calls on blocked beats, completion under 3:30.

- [ ] **Step 5: Commit**

```bash
git add scripts/sign-mandate.ts scripts/harness.ts scripts/harness.test.ts package.json
git commit -m "feat: add real-contract Anvil demo harness"
```

## Task 7: Add environment-claim and lint gates

**Files:**
- Create: `scripts/verify-chain-claims.ts`
- Create: `scripts/verify-chain-claims.test.ts`
- Modify: `sourcepilot/eslint.config.mjs`
- Modify: root `package.json`

- [ ] **Step 1: Write a mutation-proven failing claim test**

Under `CHAIN_ID=31337`, inject each banned claim into a temporary fixture and prove the verifier rejects it: `deployed on Monad`, `Monad transaction`, a `testnet.monadvision.com/tx/` link, and an unlabeled live-chain hash presentation. Under `CHAIN_ID=10143`, prove evidence metadata fails when its registry address differs from `MANDATE_REGISTRY_ADDRESS`.

- [ ] **Step 2: Verify the red phase**

Run: `pnpm exec vitest run scripts/verify-chain-claims.test.ts`  
Expected: FAIL because the verifier is absent.

- [ ] **Step 3: Implement the verifier and generated-file lint ignore**

Scan `sourcepilot/app`, `sourcepilot/components`, `sourcepilot/lib`, harness output, and evidence metadata. Add `.next/**` and other generated outputs to ESLint ignores; do not silence source warnings by disabling rules globally.

- [ ] **Step 4: Prove the gates**

Run: `pnpm verify:claims && pnpm --filter sourcepilot lint && pnpm test && pnpm build`  
Expected: all commands exit 0. Mutation tests must have demonstrated that forbidden Anvil/Monad claims fail.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-chain-claims.ts scripts/verify-chain-claims.test.ts sourcepilot/eslint.config.mjs package.json
git commit -m "test: enforce truthful chain claims"
```

## Task 8: Run the funding gate repeatedly without changing code

**Files:** none

- [ ] **Step 1: Attempt the faucet for all four published addresses**

Record the exact UI response, including authentication, CAPTCHA, rate-limit, eligibility, and cooldown messages. Never paste a private key.

- [ ] **Step 2: Verify funding from the chain**

Run: `pnpm tsx scripts/check-env.ts`  
Expected: principal, agent, Supplier A, and Supplier B each show `PASS` with positive MON balance.

- [ ] **Step 3: Repeat at permitted intervals until Friday's deployment gate**

No polling loop. Each attempt is human-triggered and respects the faucet's displayed cooldown.

## Task 9: Deploy to Monad and regenerate every bound artifact

**Files:**
- Modify only environment configuration and evidence metadata generated by the deployment workflow

- [ ] **Step 1: Re-run immutable contract verification**

Run: `(cd sourcepilot/contracts && forge test)`  
Expected: 24/24 pass immediately before deployment.

- [ ] **Step 2: Deploy the tested contract**

Run the documented `Deploy.s.sol` command against chain `10143` using the funded deployer. Capture the address and transaction hash without printing the private key.

- [ ] **Step 3: Verify bytecode and configuration**

Confirm code exists at the address, `CHAIN_ID=10143`, the RPC is Monad, and `MANDATE_REGISTRY_ADDRESS` equals the deployed address.

- [ ] **Step 4: Re-sign and register the mandate**

Generate a new EIP-712 signature using chain `10143` and the deployed address. Assert the local digest equals the hash returned by `create`. Do not reuse the Anvil signature or hash.

- [ ] **Step 5: Execute the live proof**

Submit one real `record`, wait for its receipt, read `spent`, and assert the expected decrement. Then run the changed-payee simulation and confirm `PayeeOutOfScope` with zero Rain calls.

- [ ] **Step 6: Run the Monad claim gate**

Run: `CHAIN_ID=10143 pnpm verify:claims`  
Expected: all evidence metadata references the configured Monad registry.

## Task 10: Capture final evidence and freeze Friday

**Files:**
- Create: `output/playwright/` screenshots and evidence metadata
- Create: final WP9 report at the location required by `ASSIGNMENTS.md`

- [ ] **Step 1: Record the D4 wallet moment**

Record the wallet rendering the newly signed Monad EIP-712 terms. Verify the displayed `verifyingContract` equals the deployed address before accepting the recording.

- [ ] **Step 2: Capture UI evidence at 150% zoom**

Capture `/compare`, `/approve`, the four outcome states, and the network panel during the blocked beat. Read every capture; reject unreadable text.

- [ ] **Step 3: Cross-check two independent blocked-beat proofs**

The network panel must show no Rain request and `MockRainAdapter.calls` must be empty.

- [ ] **Step 4: Run the complete Friday gate**

Run: `pnpm test && pnpm build && pnpm --filter sourcepilot lint && (cd sourcepilot/contracts && forge test) && pnpm demo:all && pnpm verify:claims`  
Expected: every command exits 0; demo completes under 3:30; all evidence uses the Monad-bound mandate.

- [ ] **Step 5: Review, commit, push, and freeze**

Inspect `git diff`, ensure no secret file is tracked, commit only intended artifacts, push, and create `build-freeze` only after the full gate succeeds.
