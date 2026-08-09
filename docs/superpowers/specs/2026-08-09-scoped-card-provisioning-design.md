# Scoped Card Provisioning Design

**Date:** 2026-08-09
**Status:** Approved

## Goal

Provision exactly one Rain sandbox scoped card with a $42.99 authorization amount for user `f2675cd0-845f-491d-8426-644e38d816b0`, verify it through the card read endpoint, and persist only the safe identifiers required by later demo steps.

## Constraints

- Use `https://api-dev.raincards.xyz/v1` and authenticate every request with the configured `RAIN_API_KEY`.
- Send `amountInUSDCents: 4299` exactly. Do not send optional `allowedMccs` or `expiresAt` fields.
- Generate the AES-128 session secret locally and never send, log, or persist it.
- Never log or persist decrypted PAN or CVC data.
- Do not overwrite the existing `RAIN_USER_ID` or create another card when a verified `RAIN_CARD_ID` is already saved.
- Treat card creation as an irreversible external side effect. Persist the returned card ID immediately after a successful POST so a later GET or local failure cannot cause an accidental duplicate POST.
- Return sanitized, actionable errors without including request headers, secrets, PAN, CVC, or complete API response bodies that may contain encrypted card material.

## Approaches Considered

### Reusable TypeScript provisioning script — selected

A dedicated Node/TypeScript command separates cryptography, HTTP access, persistence, and orchestration into testable units. It can validate state before making the POST and safely resume verification when a card ID was previously captured.

### One-off shell and OpenSSL sequence

This would be quick to type but fragile across base64 formatting, RSA-OAEP parameters, JSON parsing, error recovery, and environment-file mutation. It is too easy to leak sensitive output or repeat the POST.

### Application API route

An application route would make provisioning remotely accessible and unnecessarily expand the attack surface around card issuance. Provisioning is an operator-only setup operation and belongs in a local CLI.

## Architecture

The implementation will add a focused provisioning module under `sourcepilot/lib/rain/` and a thin operator script under `scripts/`. The module owns input validation, session material generation, Rain response validation, sanitized API errors, and the create/read API calls. The script owns local environment loading, duplicate prevention, safe state persistence, and concise terminal output.

No changes will be made to the existing `RainPort`: scoped-card provisioning is setup infrastructure, not a payment instruction.

## Dependency and State Flow

1. Load `RAIN_API_KEY`, `RAIN_API_BASE`, the approved new user ID, and any saved `RAIN_CARD_ID`.
2. Validate that the base URL is the sandbox URL and that the amount is exactly `4299`.
3. If `RAIN_CARD_ID` exists, skip POST and verify that card with GET.
4. Otherwise generate 16 random bytes. Keep their lowercase hex representation only in process memory as `SESSION_SECRET`.
5. Base64-encode the raw 16 bytes, encrypt the UTF-8 base64 text using the supplied RSA public key with RSA-OAEP/SHA-1, and base64-encode the ciphertext as `SESSION_ID`.
6. POST `/issuing/users/{USER_ID}/cards/scoped` with `Api-Key`, lowercase `sessionid`, `Content-Type: application/json`, and `{ "amountInUSDCents": 4299 }`.
7. Validate a non-empty response `id`. Immediately persist it as `RAIN_CARD_ID` without persisting or displaying encrypted or decrypted card data.
8. GET `/issuing/cards/{CARD_ID}` and validate that the returned ID matches.
9. After successful GET verification, persist the approved new `RAIN_USER_ID` and report only card ID, status, last four digits, and expiry.

The locally generated session secret and returned encrypted PAN/CVC need not be decrypted for this provisioning goal. Avoiding decryption minimizes exposure while still satisfying creation and verification. Crypto-session generation remains compliant with Rain's response-encryption protocol.

## Duplicate Prevention and Recovery

`RAIN_CARD_ID` is the local idempotency boundary because the Rain sequence does not specify an idempotency-key header. A saved card ID always routes execution to GET verification and never to another POST.

Immediately after POST returns a valid ID, the script updates the environment file atomically through a temporary file and rename. This happens before GET verification. If GET subsequently fails, the next run resumes verification with the saved ID rather than creating a duplicate.

This cannot prevent duplication if the POST succeeds remotely but the connection fails before the response ID reaches the client. The script will state this ambiguity explicitly and refuse automatic retries after a network failure during POST. The operator must list cards or ask Rain support before retrying creation.

## Error Handling

- Missing configuration: exit before any network call and name only the missing variable.
- Wrong environment or amount: exit before any network call.
- Existing card ID: skip creation and attempt GET verification.
- HTTP 4xx: report status and a sanitized Rain error message when available.
- HTTP 5xx: report a transient provider failure; do not automatically repeat POST.
- Network failure before/during POST: report that creation outcome is unknown and prohibit automatic retry.
- Invalid POST response: do not print the response; explain that no card ID could be safely captured.
- GET failure after creation: retain the saved card ID and instruct the operator to rerun verification.
- Persistence failure after POST: print the returned card ID because it is required recovery state and is not PAN/CVC, then stop before any new creation attempt.

## Persistence

The script updates `sourcepilot/.env.secrets.local`, which is already ignored by Git. It replaces or appends only `RAIN_CARD_ID` and, after verification, `RAIN_USER_ID`. Existing formatting and unrelated values remain unchanged. The generated session secret, session ID, encrypted PAN/CVC, and decrypted PAN/CVC are never written.

The example environment file will document `RAIN_API_BASE`, `RAIN_API_KEY`, `RAIN_USER_ID`, and `RAIN_CARD_ID` using empty or sandbox-safe values only.

## Testing

Tests will be written first with Vitest and mocked `fetch`/filesystem boundaries. They will prove:

- RSA session generation produces a 32-character lowercase hex secret and decryptable OAEP/SHA-1 session ID with a test keypair.
- POST uses the exact path, lowercase `sessionid` header, and exact amount.
- Existing `RAIN_CARD_ID` skips POST.
- A successful POST persists `RAIN_CARD_ID` before GET.
- Successful verification then persists the new user ID.
- 4xx, 5xx, malformed JSON, invalid response shapes, and ambiguous POST network failures produce sanitized errors.
- No error or success output contains the session secret, session ID, PAN, or CVC.
- Environment updates replace keys without damaging unrelated lines.

The final verification will run the focused tests, the full TypeScript suite, lint, and the production build. The real provisioning command will be an explicit operator action because it creates an external financial resource.
