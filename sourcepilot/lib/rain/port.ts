/**
 * Rain port. INTERFACE-CONTRACTS.md §6 (frozen), amended for D2 and D6.
 *
 * Everything downstream of Rain stays mock-first: docs.rain.xyz is access-code gated and
 * credentials arrive Saturday 9:00 AM. The mock is shaped to be swapped, not to be a stub.
 */
import type { Bytes32 } from "@/lib/contracts/money";
import type { Stage } from "@/lib/chain/registry";

/**
 * D6: per-ATTEMPT uuid v4.
 *
 * Branded so it cannot be constructed from a string literal. A content-derived key
 * returns the cached success on retry, which makes the revocation closer show "paid"
 * instead of "reverted" — the single most damaging possible failure on stage. The brand
 * makes that a compile error rather than a code-review catch.
 */
export type AttemptKey = string & { readonly __brand: "AttemptKey" };

/**
 * The ONLY way to make one. Takes no arguments — it CANNOT be derived from payment
 * content. Do not add a parameter to this function.
 */
export function newAttemptKey(): AttemptKey {
  return crypto.randomUUID() as AttemptKey;
}

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

export interface MockRainAdapter extends RainPort {
  readonly calls: ReadonlyArray<{ at: number; method: string; req: unknown }>;
  reset(): void;
}

export interface MockRainConfig {
  statusDelaysMs: [number, number, number];
  failPayeeRefs?: string[];
}
