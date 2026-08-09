/**
 * Deliberately disabled live payment adapter.
 *
 * Rain sandbox authentication is verified separately through a read-only request.
 * Card issuance, authorization, and settlement remain outside this prototype.
 */
import type { CreatePaymentInstruction, RainPort } from "./port";

export class NotApprovedError extends Error {
  constructor(method: string) {
    super(
      `LiveRainAdapter.${method} is disabled: live Rain payment execution is not ` +
        `implemented. Use MockRainAdapterImpl.`,
    );
    this.name = "NotApprovedError";
  }
}

export class LiveRainAdapter implements RainPort {
  async createPaymentInstruction(
    req: CreatePaymentInstruction,
  ): Promise<{ paymentId: string; status: string }> {
    void req;
    throw new NotApprovedError("createPaymentInstruction");
  }

  async getPaymentStatus(paymentId: string): Promise<{ status: string; ref?: string }> {
    void paymentId;
    throw new NotApprovedError("getPaymentStatus");
  }

  async validateDestination(payeeRef: string): Promise<{ ok: boolean; reason?: string }> {
    void payeeRef;
    throw new NotApprovedError("validateDestination");
  }
}
