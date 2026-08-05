# Anvil-First, Monad-Friday Delivery Design

**Date:** 2026-08-05  
**Status:** Approved  
**Scope:** Revise the remaining SourcePilot build sequence while Monad accounts are not yet funded.

## Objective

Continue the complete application build without weakening the central enforcement claim. Development and end-to-end testing use the real `MandateRegistry` contract on Anvil through the real viem client. Monad funding remains an active prerequisite, and the tested contract is deployed to Monad as soon as funding succeeds, no later than Friday before evidence capture and build freeze.

## Decisions

1. Do not use an in-memory registry mock. It could drift from Solidity revert behavior and conceal integration failures until deployment.
2. Use Anvil for WP5, WP6, WP8, and local WP9 verification. Contract simulation, record transactions, revocation, nonce replay prevention, and ceiling decrement all execute against the real Solidity contract.
3. Separate funding from deployment. Retry the faucet throughout the week. Deploy immediately when funding succeeds; Friday is the deadline, not the first attempt.
4. Do not defer deployment to Saturday. Saturday remains reserved for Rain credential work and rehearsal.
5. Treat the Monad registry address as an input to every final artifact. EIP-712 binds the mandate to `verifyingContract`; therefore deployment changes the digest and mandate hash.

## Build Sequence

### Local development

- Start a deterministic Anvil instance and deploy `MandateRegistry` locally.
- Implement WP5 against Anvil using the real viem `RegistryClient`.
- Implement WP7 independently.
- Implement WP6 against the WP5 API.
- Implement WP8 so all required outcomes run against Anvil from a cold start.
- Run the local portions of WP9 against the same stack.

Local runs and UI surfaces must identify the environment as local/Anvil. They must not claim Monad deployment or present a local transaction as a Monad transaction.

### Funding and Monad deployment

- Attempt funding throughout the week for the principal, agent, Supplier A, and Supplier B accounts.
- Once funded, deploy the exact contract artifact already passing Foundry tests.
- Record the Monad contract address and explorer link.
- Re-sign the live mandate with chain ID `10143` and the deployed Monad address as `verifyingContract`.
- Register it and execute at least one real `record` transaction, confirming `spent` increments.
- Re-run the critical enforcement path against Monad.

### Final artifacts

The following occur only after the Monad address exists and the live mandate has been re-signed:

- D4 wallet screen-recording of the EIP-712 mandate.
- Screenshots showing a mandate hash, registry address, explorer URL, or live transaction hash.
- Deck assets containing any digest-derived identifier.
- Final WP9 evidence capture and Friday build freeze.

Artifacts created against Anvil may be used only as temporary development evidence and must be clearly labeled. They cannot ship as final Monad evidence.

## Configuration and Data Flow

Chain selection is explicit and derives from runtime configuration. The client reads the configured chain ID, RPC URL, and registry address; it does not silently fall back between Anvil and Monad. Mandate signing uses the same configured chain ID and registry address as the client.

The payment path remains:

1. Load the attempt by its per-attempt UUID.
2. Run only the three permitted off-chain checks.
3. Return pending approval before any chain or Rain call when approval is required.
4. Freeze approval-covered fields.
5. Simulate the real contract call.
6. Submit the real contract transaction.
7. Call the mock Rain adapter only after chain authorization.
8. Persist and emit the result.

Changing environments changes configuration and requires a new signature; it does not change pipeline code.

## Failure Handling

- Missing or inconsistent chain configuration fails at startup with the missing field named.
- A signature whose domain does not match the configured registry is rejected; the system never rewrites or reuses it.
- `MandateHashMismatch` remains fatal.
- Contract reverts are decoded into the frozen `RevertReason` union.
- Blocked outcomes must show zero Rain calls.
- If funding has not succeeded by the Friday deployment gate, final Monad-dependent recording, screenshots, and freeze are blocked and reported explicitly. They are not relabeled as complete.

## Verification

WP9 adds a build-failing environment-claim check:

- When `CHAIN_ID` is Anvil's chain ID, source and rendered output may not claim deployment to Monad, link to a Monad transaction, or label a local hash as a Monad hash.
- When `CHAIN_ID` is `10143`, final evidence must use the configured Monad registry address.

The check covers `app/`, `components/`, `lib/`, harness output, and captured evidence metadata. It complements—not replaces—runtime assertions that the signing domain and registry client share the same chain ID and verifying contract.

## Out of Scope

- An in-memory registry implementation.
- A live Rain payment path before Saturday credentials.
- Any change to the frozen payment ordering or contract enforcement rules.
- Final evidence capture before the Monad deployment address is known.

