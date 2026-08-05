import type { EventRecord } from "@/lib/contracts/api";

export type EventInput = Omit<EventRecord, "id" | "createdAt">;
export type EventListener = (event: EventRecord) => void;

export interface EventStore {
  append(event: EventInput): EventRecord;
  read(purchaseRequestId: string): EventRecord[];
  subscribe(purchaseRequestId: string, listener: EventListener): () => void;
  reset(): void;
  subscriberCount(purchaseRequestId: string): number;
}

export function createEventStore(): EventStore {
  const records = new Map<string, EventRecord[]>();
  const listeners = new Map<string, Set<EventListener>>();

  return {
    append(input) {
      const event: EventRecord = {
        ...input,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      const current = records.get(input.purchaseRequestId) ?? [];
      current.push(event);
      records.set(input.purchaseRequestId, current);
      for (const listener of listeners.get(input.purchaseRequestId) ?? []) listener(event);
      return event;
    },
    read(purchaseRequestId) {
      return [...(records.get(purchaseRequestId) ?? [])];
    },
    subscribe(purchaseRequestId, listener) {
      const current = listeners.get(purchaseRequestId) ?? new Set<EventListener>();
      current.add(listener);
      listeners.set(purchaseRequestId, current);
      return () => {
        current.delete(listener);
        if (current.size === 0) listeners.delete(purchaseRequestId);
      };
    },
    reset() {
      records.clear();
      listeners.clear();
    },
    subscriberCount(purchaseRequestId) {
      return listeners.get(purchaseRequestId)?.size ?? 0;
    },
  };
}

export const events = createEventStore();
