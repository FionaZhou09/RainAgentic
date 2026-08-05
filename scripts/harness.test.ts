import { afterEach, describe, expect, it } from "vitest";
import { createDemoHarness, runDemo, type DemoHarness, type HarnessRecord } from "./harness";

const active: DemoHarness[] = [];

afterEach(async () => {
  await Promise.all(active.splice(0).map((harness) => harness.stop()));
});

describe("cold-start real-Anvil demo harness", () => {
  it("deploys and registers one real mandate, then runs the locked purchase beats in order", async () => {
    const harness = await createDemoHarness();
    active.push(harness);

    const arc = await harness.runLockedArc();

    expect(arc.map((beat) => beat.beat)).toEqual([
      "autonomous_sample",
      "escalation",
      "changed_payee",
    ]);
    expect(arc[0].records.at(-1)).toMatchObject({ outcome: "autonomous", amountMinor: 18_000 });
    expect(arc[1].records.map((record) => record.outcome)).toEqual(["pending_approval", "approved"]);
    expect(arc[2].records.at(-1)).toMatchObject({ outcome: "blocked", reason: "PayeeOutOfScope", rainCalls: 0 });
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
    const arc = await harness.runLockedArc();

    const sample2 = await harness.fireSample(2);
    const sample3 = await harness.fireSample(3);
    expect(sample2).toMatchObject({ outcome: "autonomous", remainingMinor: "100", mandateHash: arc.mandateHash });
    expect(sample3).toMatchObject({ outcome: "blocked", reason: "ExceedsMaxTotal", rainCalls: 0, mandateHash: arc.mandateHash });
  }, 30_000);

  it("runs the irreversible revocation closer only after D3 on the same mandate", async () => {
    const harness = await createDemoHarness();
    active.push(harness);
    const arc = await harness.runLockedArc();
    await expect(harness.runRevocationCloser()).rejects.toThrow(/after D3/i);
    await harness.fireSample(2);
    await harness.fireSample(3);

    const revoked = await harness.runRevocationCloser();
    expect(revoked).toMatchObject({ outcome: "blocked", reason: "Revoked", rainCalls: 0, mandateHash: arc.mandateHash });
    expect(revoked).toHaveProperty("transactionHash");
    expect(revoked).not.toHaveProperty("monadTxHash");
    expect(arc.flatMap((beat) => beat.records).every((record) => record.mandateHash === arc.mandateHash)).toBe(true);
  }, 30_000);

  it("proves blocked beats made zero Rain calls", async () => {
    const harness = await createDemoHarness();
    active.push(harness);
    await harness.runLockedArc();
    await harness.fireSample(2);
    await harness.fireSample(3);
    await harness.runRevocationCloser();
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
    expect(records.filter((record) => record.outcome === "autonomous" || record.outcome === "approved")
      .every((record) => record.transactionHash?.startsWith("0x"))).toBe(true);
  }, 30_000);

  it("cleans up the child Anvil process", async () => {
    const harness = await createDemoHarness();
    await harness.stop();
    expect(harness.stopped).toBe(true);
    await expect(fetch(harness.rpcUrl)).rejects.toThrow();
  }, 30_000);

  it("renders Local Anvil transaction evidence without Monad presentation keys", async () => {
    const rendered = JSON.stringify(await runDemo(), (_, value) => typeof value === "bigint" ? value.toString() : value);
    expect(rendered).not.toMatch(/monadTxHash|monadTransaction/i);
    expect(rendered).toMatch(/localTxHash|transactionHash/);
    expect(rendered).toContain('"environment":"Local Anvil"');
  }, 30_000);
});
