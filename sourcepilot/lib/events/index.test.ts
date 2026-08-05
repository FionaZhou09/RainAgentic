import { describe, expect, it, vi } from "vitest";
import { createEventStore } from "./index";

describe("event store", () => {
  it("reads events in append order and isolates purchase requests", () => {
    const store = createEventStore();
    const first = store.append({ purchaseRequestId: "PR-1", type: "quotes_analyzed", actor: "agent", payload: { n: 1 } });
    store.append({ purchaseRequestId: "PR-2", type: "quotes_analyzed", actor: "agent", payload: { n: 2 } });
    const third = store.append({ purchaseRequestId: "PR-1", type: "mandate_registered", actor: "system", payload: { n: 3 } });

    expect(store.read("PR-1")).toEqual([first, third]);
    expect(store.read("PR-2")).toHaveLength(1);
  });

  it("subscribes only to the requested purchase request and cleanly unsubscribes", () => {
    const store = createEventStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe("PR-1", listener);

    store.append({ purchaseRequestId: "PR-2", type: "quotes_analyzed", actor: "agent", payload: {} });
    store.append({ purchaseRequestId: "PR-1", type: "quotes_analyzed", actor: "agent", payload: {} });
    unsubscribe();
    store.append({ purchaseRequestId: "PR-1", type: "mandate_registered", actor: "system", payload: {} });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("creates isolated stores and supports deterministic reset", () => {
    const first = createEventStore();
    const second = createEventStore();
    first.append({ purchaseRequestId: "PR-1", type: "quotes_analyzed", actor: "agent", payload: {} });
    expect(second.read("PR-1")).toEqual([]);
    first.reset();
    expect(first.read("PR-1")).toEqual([]);
  });
});
