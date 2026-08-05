import { events, type EventStore } from "@/lib/events";

const encoder = new TextEncoder();

function createEventStreamHandler(store: EventStore = events) {
  return async function stream(request: Request): Promise<Response> {
    const prId = new URL(request.url).searchParams.get("prId")?.trim();
    if (!prId) return Response.json({ error: "Missing prId" }, { status: 400 });

    let unsubscribe = () => {};
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of store.read(prId)) controller.enqueue(frame(event));
        unsubscribe = store.subscribe(prId, (event) => controller.enqueue(frame(event)));
        const cleanup = () => {
          unsubscribe();
          try { controller.close(); } catch { /* already closed */ }
        };
        if (request.signal.aborted) cleanup();
        else request.signal.addEventListener("abort", cleanup, { once: true });
      },
      cancel() { unsubscribe(); },
    });

    return new Response(body, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
    });
  };
}

function frame(event: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export const GET = Object.assign(createEventStreamHandler(), { withStore: createEventStreamHandler });
