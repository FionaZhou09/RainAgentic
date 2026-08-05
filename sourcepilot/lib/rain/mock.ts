/**
 * Mock Rain adapter. INTERFACE-CONTRACTS.md §6 (frozen), D6 semantics.
 *
 * Invariants this class exists to guarantee:
 *   (1) same AttemptKey => same paymentId, no second effect
 *   (2) DIFFERENT AttemptKeys with IDENTICAL content => TWO distinct attempts
 *   (3) status advances created -> submitted -> settled on configured delays
 *   (4) every call is recorded so the harness can ASSERT ZERO CALLS on blocked beats
 *
 * (2) is the one that matters most on stage. See the D6 note in port.ts.
 */
import type {
  CreatePaymentInstruction,
  MockRainAdapter,
  MockRainConfig,
  AttemptKey,
} from "./port";

interface Attempt {
  paymentId: string;
  req: CreatePaymentInstruction;
  createdAt: number;
}

export class MockRainAdapterImpl implements MockRainAdapter {
  private readonly attempts = new Map<AttemptKey, Attempt>();
  private readonly byPaymentId = new Map<string, Attempt>();
  private readonly log: Array<{ at: number; method: string; req: unknown }> = [];
  private counter = 0;

  constructor(private readonly config: MockRainConfig) {}

  get calls(): ReadonlyArray<{ at: number; method: string; req: unknown }> {
    return this.log;
  }

  /** Distinct attempts recorded. Exposed for the D6 "no second effect" assertion. */
  get attemptCount(): number {
    return this.attempts.size;
  }

  async createPaymentInstruction(
    req: CreatePaymentInstruction,
  ): Promise<{ paymentId: string; status: string }> {
    this.record("createPaymentInstruction", req);

    // Keyed by ATTEMPT, never by content. Two identical payloads under two different
    // keys are two different attempts — that is what a retry IS.
    const existing = this.attempts.get(req.idempotencyKey);
    if (existing) {
      return { paymentId: existing.paymentId, status: this.statusOf(existing) };
    }

    const attempt: Attempt = {
      paymentId: `rain_pay_${String(++this.counter).padStart(3, "0")}`,
      req,
      createdAt: Date.now(),
    };
    this.attempts.set(req.idempotencyKey, attempt);
    this.byPaymentId.set(attempt.paymentId, attempt);

    return { paymentId: attempt.paymentId, status: this.statusOf(attempt) };
  }

  async getPaymentStatus(paymentId: string): Promise<{ status: string; ref?: string }> {
    this.record("getPaymentStatus", { paymentId });

    const attempt = this.byPaymentId.get(paymentId);
    if (!attempt) {
      // Never invent a status for a payment we have no record of.
      throw new Error(`MockRainAdapter: unknown paymentId ${paymentId}`);
    }
    return { status: this.statusOf(attempt), ref: attempt.req.purchaseRequestId };
  }

  /**
   * Convenience/formatting only. NOT a security boundary and it NEVER gates a payment —
   * payee scope belongs to the contract. Pre-empting it here would make "the contract
   * reverted" a false sentence on stage.
   */
  async validateDestination(payeeRef: string): Promise<{ ok: boolean; reason?: string }> {
    this.record("validateDestination", { payeeRef });

    if (this.config.failPayeeRefs?.includes(payeeRef)) {
      return { ok: false, reason: "Destination not recognized by the payments provider." };
    }
    return { ok: true };
  }

  reset(): void {
    this.attempts.clear();
    this.byPaymentId.clear();
    this.log.length = 0;
    this.counter = 0;
  }

  private record(method: string, req: unknown): void {
    this.log.push({ at: Date.now(), method, req });
  }

  private statusOf(attempt: Attempt): string {
    const [createdMs, submittedMs, settledMs] = this.config.statusDelaysMs;
    const elapsed = Date.now() - attempt.createdAt;
    if (elapsed >= createdMs + submittedMs + settledMs) return "settled";
    if (elapsed >= createdMs + submittedMs) return "submitted";
    return "created";
  }
}
