import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { newAttemptKey, type CreatePaymentInstruction } from "./port";
import { MockRainAdapterImpl } from "./mock";
import { LiveRainAdapter, NotApprovedError } from "./live";

const baseReq = (): Omit<CreatePaymentInstruction, "idempotencyKey"> => ({
  mandateHash: "0xaa01c2167148ec34cf58e069b6d048065aa81fd0607d0be002aee1e34bd68348",
  payeeRef: "rain:payee:hanzhou-apparel",
  amountMinorUnits: 18_000,
  currency: "USD",
  purchaseRequestId: "PR-1042",
  stage: "sample",
});

let rain: MockRainAdapterImpl;
beforeEach(() => {
  rain = new MockRainAdapterImpl({ statusDelaysMs: [0, 1_000, 5_000] });
});

describe("newAttemptKey() — D6: a key that cannot be derived from payment content", () => {
  it("takes NO arguments, so payment content cannot reach it", () => {
    expect(newAttemptKey.length).toBe(0);
  });

  it("returns a distinct uuid v4 on every call", () => {
    const keys = new Set(Array.from({ length: 100 }, () => newAttemptKey()));
    expect(keys.size).toBe(100);
    for (const k of keys) {
      expect(k).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    }
  });
});

describe("idempotency is keyed by ATTEMPT, never by content", () => {
  it("same AttemptKey returns the same paymentId with no second effect", async () => {
    const key = newAttemptKey();
    const req = { ...baseReq(), idempotencyKey: key };

    const first = await rain.createPaymentInstruction(req);
    const second = await rain.createPaymentInstruction(req);

    expect(second.paymentId).toBe(first.paymentId);
    expect(rain.attemptCount).toBe(1);
  });

  /**
   * THE test that saves the revocation closer. On stage the agent retries the same $180
   * order after revocation. Byte-identical content, NEW attempt key — so it must reach
   * the contract and revert, not return a cached "paid" from the first attempt.
   */
  it("different AttemptKeys with byte-identical content produce TWO distinct attempts", async () => {
    const content = baseReq();
    const a = await rain.createPaymentInstruction({ ...content, idempotencyKey: newAttemptKey() });
    const b = await rain.createPaymentInstruction({ ...content, idempotencyKey: newAttemptKey() });

    expect(b.paymentId).not.toBe(a.paymentId);
    expect(rain.attemptCount).toBe(2);
  });

  it("a replayed key does not advance the payment id counter", async () => {
    const k1 = newAttemptKey();
    await rain.createPaymentInstruction({ ...baseReq(), idempotencyKey: k1 });
    await rain.createPaymentInstruction({ ...baseReq(), idempotencyKey: k1 });
    const fresh = await rain.createPaymentInstruction({ ...baseReq(), idempotencyKey: newAttemptKey() });
    expect(rain.attemptCount).toBe(2);
    expect(fresh.paymentId).not.toBe("");
  });
});

describe("status stream", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("advances created -> submitted -> settled on the configured delays", async () => {
    const { paymentId } = await rain.createPaymentInstruction({
      ...baseReq(),
      idempotencyKey: newAttemptKey(),
    });

    expect((await rain.getPaymentStatus(paymentId)).status).toBe("created");

    vi.advanceTimersByTime(1_000);
    expect((await rain.getPaymentStatus(paymentId)).status).toBe("submitted");

    vi.advanceTimersByTime(5_000);
    expect((await rain.getPaymentStatus(paymentId)).status).toBe("settled");
  });

  it("throws on an unknown paymentId rather than inventing a status", async () => {
    await expect(rain.getPaymentStatus("rain_pay_nonexistent")).rejects.toThrow();
  });
});

describe("call log — the harness asserts ZERO calls on blocked beats", () => {
  it("records every invocation, including idempotent replays", async () => {
    const k = newAttemptKey();
    await rain.createPaymentInstruction({ ...baseReq(), idempotencyKey: k });
    await rain.createPaymentInstruction({ ...baseReq(), idempotencyKey: k });
    await rain.validateDestination("rain:payee:hanzhou-apparel");

    expect(rain.calls).toHaveLength(3);
    expect(rain.calls.map((c) => c.method)).toEqual([
      "createPaymentInstruction", "createPaymentInstruction", "validateDestination",
    ]);
  });

  it("starts empty, which is what a blocked beat must still look like afterwards", () => {
    expect(rain.calls).toHaveLength(0);
  });

  it("reset() clears calls and attempts", async () => {
    await rain.createPaymentInstruction({ ...baseReq(), idempotencyKey: newAttemptKey() });
    rain.reset();
    expect(rain.calls).toHaveLength(0);
    expect(rain.attemptCount).toBe(0);
  });
});

describe("validateDestination is convenience, NOT a security boundary", () => {
  it("reports configured failures without throwing", async () => {
    const r = new MockRainAdapterImpl({
      statusDelaysMs: [0, 1_000, 5_000],
      failPayeeRefs: ["rain:payee:hanzhou-apparel-new-account"],
    });
    expect((await r.validateDestination("rain:payee:hanzhou-apparel-new-account")).ok).toBe(false);
    expect((await r.validateDestination("rain:payee:hanzhou-apparel")).ok).toBe(true);
  });

  it("does NOT gate createPaymentInstruction — payee scope is the CONTRACT's job", async () => {
    const r = new MockRainAdapterImpl({
      statusDelaysMs: [0, 1_000, 5_000],
      failPayeeRefs: ["rain:payee:hanzhou-apparel-new-account"],
    });
    // If this threw, we would be enforcing payee scope off-chain and stealing the
    // contract's blocked beat. It must not.
    const res = await r.createPaymentInstruction({
      ...baseReq(),
      payeeRef: "rain:payee:hanzhou-apparel-new-account",
      idempotencyKey: newAttemptKey(),
    });
    expect(res.paymentId).toBeTruthy();
  });
});

describe("LiveRainAdapter — D2: the file exists so the swap is real", () => {
  it("throws NotApprovedError on every method until the boss approves the attempt", async () => {
    const live = new LiveRainAdapter();
    await expect(
      live.createPaymentInstruction({ ...baseReq(), idempotencyKey: newAttemptKey() }),
    ).rejects.toThrow(NotApprovedError);
    await expect(live.getPaymentStatus("rain_pay_1")).rejects.toThrow(NotApprovedError);
    await expect(live.validateDestination("rain:payee:x")).rejects.toThrow(NotApprovedError);
  });
});
