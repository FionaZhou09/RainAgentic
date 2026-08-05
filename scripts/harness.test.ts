import { afterEach, describe, expect, it } from "vitest";
import { createDemoHarness, type DemoHarness, type HarnessRecord } from "./harness";

const active: DemoHarness[] = [];

afterEach(async () => {
  await Promise.all(active.splice(0).map((harness) => harness.stop()));
});

describe("cold-start real-Anvil demo harness", () => {
  it("deploys and registers a real mandate, then runs the four locked beats in order", async () => {
    const harness = await createDemoHarness();
    active.push(harness);

    const arc = await harness.runLockedArc();

    expect(arc.map((beat) => beat.beat)).toEqual([
      "autonomous_sample",
      "escalation",
      "changed_payee",
      "revocation",
    ]);
    expect(arc[0].records.at(-1)).toMatchObject({ outcome: "autonomous", amountMinor: 18_000 });
    expect(arc[1].records.map((record) => record.outcome)).toEqual(["pending_approval", "approved"]);
    expect(arc[2].records.at(-1)).toMatchObject({ outcome: "blocked", reason: "PayeeOutOfScope", rainCalls: 0 });
    expect(arc[3].records.at(-1)).toMatchObject({ outcome: "blocked", reason: "Revoked", rainCalls: 0 });
    expect(arc.spentMinor).toBe(165_900n);
    expect(arc.registryAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(arc.mandateHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
  }, 30_000);

  it("preserves the pending evidence and approves with a new AttemptKey and the same signed nonce", async () => {
    const harness = await createDemoHarness();
    active.push(harness);
    const arc = await harness.runLockedArc();
    const [pending, approved] = arc[1].records;

    expect(pending.attemptKey).not.toBe(approved.attemptKey);
    expect(pending.approvalNonce).toBe(approved.approvalNonce);
    expect(pending.outcome).toBe("pending_approval");
    expect(approved.outcome).toBe("approved");
  }, 30_000);

  it("demonstrates D3 on-chain ceiling exhaustion after the locked arc", async () => {
    const harness = await createDemoHarness();
    active.push(harness);
    await harness.runLockedArc();

    expect(await harness.fireSample(2)).toMatchObject({ outcome: "autonomous", remainingMinor: "100" });
    expect(await harness.fireSample(3)).toMatchObject({ outcome: "blocked", reason: "ExceedsMaxTotal", rainCalls: 0 });
  }, 30_000);

  it("proves blocked beats made zero Rain calls", async () => {
    const harness = await createDemoHarness();
    active.push(harness);
    await harness.runLockedArc();
    expect(() => harness.assertZeroRainCalls()).not.toThrow();
  }, 30_000);

  it("prints a configured revoke command without secret material", async () => {
    const harness = await createDemoHarness();
    active.push(harness);
    const command = harness.printRevokeCommand();

    expect(command).toContain(harness.rpcUrl);
    expect(command).toContain(harness.registryAddress);
    expect(command).toContain("revoke(bytes32)");
    expect(command).not.toMatch(/private|key|--private-key/i);
  }, 30_000);

  it("labels every record Local Anvil under chain 31337", async () => {
    const harness = await createDemoHarness();
    active.push(harness);
    const arc = await harness.runLockedArc();
    const records = arc.flatMap((beat) => beat.records) as HarnessRecord[];
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((record) => record.environment === "Local Anvil" && record.chainId === 31337)).toBe(true);
  }, 30_000);

  it("cleans up the child Anvil process", async () => {
    const harness = await createDemoHarness();
    await harness.stop();
    expect(harness.stopped).toBe(true);
    await expect(fetch(harness.rpcUrl)).rejects.toThrow();
  }, 30_000);
});
