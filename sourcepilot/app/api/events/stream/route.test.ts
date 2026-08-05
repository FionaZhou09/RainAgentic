import { describe, expect, it } from "vitest";
import { createEventStore } from "@/lib/events";
import { GET } from "./route";

describe("GET /api/events/stream", () => {
  it("returns exact SSE framing for only the requested purchase request", async () => {
    const store = createEventStore();
    const expected = store.append({ purchaseRequestId: "PR-1", type: "quotes_analyzed", actor: "agent", payload: { ok: true } });
    store.append({ purchaseRequestId: "PR-2", type: "quotes_analyzed", actor: "agent", payload: {} });
    const controller = new AbortController();
    const response = await GET.withStore(store)(new Request("http://local/api/events/stream?prId=PR-1", { signal: controller.signal }));
    const reader = response.body!.getReader();
    const chunk = await reader.read();
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(new TextDecoder().decode(chunk.value)).toBe(`data: ${JSON.stringify(expected)}\n\n`);
    controller.abort();
  });

  it("streams newly appended events and cleans the subscription on abort", async () => {
    const store = createEventStore();
    const controller = new AbortController();
    const response = await GET.withStore(store)(new Request("http://local/api/events/stream?prId=PR-1", { signal: controller.signal }));
    const reader = response.body!.getReader();
    expect(store.subscriberCount("PR-1")).toBe(1);
    const expected = store.append({ purchaseRequestId: "PR-1", type: "mandate_registered", actor: "system", payload: { ok: true } });
    expect(new TextDecoder().decode((await reader.read()).value)).toBe(`data: ${JSON.stringify(expected)}\n\n`);
    controller.abort();
    await Promise.resolve();
    expect(store.subscriberCount("PR-1")).toBe(0);
  });

  it.each(["http://local/api/events/stream", "http://local/api/events/stream?prId="])("rejects a missing prId", async (url) => {
    expect((await GET.withStore(createEventStore())(new Request(url))).status).toBe(400);
  });
});
