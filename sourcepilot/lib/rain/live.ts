/**
 * Live Rain adapter — D2.
 *
 * This file exists so the swap is REAL: the port is implemented against a second class,
 * not bolted on later. It throws until the boss approves the attempt.
 *
 * Ruling D2, unchanged in every particular: we do NOT build the live payment path.
 * Extra days do not shrink a 4–6 hour trap, and doing it tired on the money path is how
 * teams lose. Saturday gets a 20-minute mock-fidelity pass and a 30-minute timeboxed
 * authenticated round-trip against the CHEAPEST read-only call — never this path.
 */
import type { CreatePaymentInstruction, RainPort } from "./port";

export class NotApprovedError extends Error {
  constructor(method: string) {
    super(
      `LiveRainAdapter.${method} is not approved. D2: the live payment path is deliberately ` +
        `not built. Use MockRainAdapterImpl. Changing this requires a boss ruling.`,
    );
    this.name = "NotApprovedError";
  }
}

export class LiveRainAdapter implements RainPort {
  async createPaymentInstruction(
    _req: CreatePaymentInstruction,
  ): Promise<{ paymentId: string; status: string }> {
    throw new NotApprovedError("createPaymentInstruction");
  }

  async getPaymentStatus(_paymentId: string): Promise<{ status: string; ref?: string }> {
    throw new NotApprovedError("getPaymentStatus");
  }

  async validateDestination(_payeeRef: string): Promise<{ ok: boolean; reason?: string }> {
    throw new NotApprovedError("validateDestination");
  }
}
