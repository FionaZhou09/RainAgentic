import { describe, expect, it } from "vitest";
import { createEventStore } from "@/lib/events";
import { POST } from "./route";

const post = (body: unknown, store = createEventStore()) => ({
  store,
  response: POST.withDependencies({ events: store })(new Request("http://local/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })),
});

describe("POST /api/analyze", () => {
  it("returns accepted PR-1042 assessment, D1 behavior, Supplier C gaps, and one success event", async () => {
    const { store, response } = post({ purchaseRequestId: "PR-1042" });
    const result = await response;
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.pr.id).toBe("PR-1042");
    expect(body.assumptions.dutyLabel).toContain("HTS 6109.10.00");
    expect(body.recommendation.quoteId).toBe("Q-B");
    expect(body.assessments.find((a: { quoteId: string }) => a.quoteId === "Q-B").rank).toBe(1);
    expect(body.assessments.flatMap((a: { hardFailures: { code: string }[] }) => a.hardFailures).some((f: { code: string }) => f.code.includes("LANDED"))).toBe(false);
    const supplierC = body.assessments.find((a: { quoteId: string }) => a.quoteId === "Q-C");
    expect(supplierC.cost).toEqual({ kind: "incomplete", missing: ["shipping"] });
    expect(supplierC.hardFailures.map((f: { code: string }) => f.code)).toEqual(expect.arrayContaining(["MISSING_REQUIRED_FIELD", "LEAD_TIME_OVER", "SPEC_MATCH_UNDER"]));
    expect(body.recommendation.rationale).toHaveProperty("decision");
    expect(store.read("PR-1042").map((event) => event.type)).toEqual(["quotes_analyzed"]);
  });

  it.each([
    ["invalid JSON", "{"],
    ["invalid shape", {}],
    ["unknown purchase request", { purchaseRequestId: "PR-9999" }],
  ])("rejects %s with no success event", async (_label, body) => {
    const { store, response } = post(body);
    expect((await response).status).toBeGreaterThanOrEqual(400);
    expect(store.read("PR-1042")).toEqual([]);
    expect(store.read("PR-9999")).toEqual([]);
  });
});
