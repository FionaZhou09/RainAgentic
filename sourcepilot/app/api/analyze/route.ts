import type { AnalyzeRequest, AnalyzeResponse } from "@/lib/contracts/api";
import { renderRationale } from "@/lib/agent/rationale";
import { events as defaultEvents, type EventStore } from "@/lib/events";
import { ASSUMPTIONS, PR_1042, QUOTES, SUPPLIERS } from "@/lib/fixtures/pr-1042";
import { assessQuotes } from "@/lib/score";

const FREIGHT_ASSUMPTION = "Freight is not estimated when Supplier C shipping is unstated.";

function createAnalyzeHandler({ events }: { events: EventStore } = { events: defaultEvents }) {
  return async function analyze(request: Request): Promise<Response> {
    let input: unknown;
    try { input = await request.json(); } catch { return error("Invalid JSON", 400); }
    if (!isAnalyzeRequest(input)) return error("Invalid analyze request", 400);
    if (input.purchaseRequestId !== PR_1042.id) return error("Unknown purchase request", 404);

    const assessments = assessQuotes(PR_1042, QUOTES, SUPPLIERS, ASSUMPTIONS);
    const recommendation = assessments.find((assessment) => assessment.rank === 1);
    if (!recommendation) return error("No eligible recommendation", 422);
    const response: AnalyzeResponse = {
      pr: PR_1042,
      assumptions: ASSUMPTIONS,
      assessments,
      recommendation: {
        quoteId: recommendation.quoteId,
        rationale: renderRationale({
          assessment: recommendation,
          assumptions: [ASSUMPTIONS.dutyLabel, ASSUMPTIONS.fxNote, FREIGHT_ASSUMPTION],
        }),
      },
    };
    events.append({ purchaseRequestId: PR_1042.id, type: "quotes_analyzed", actor: "agent", payload: { recommendationQuoteId: recommendation.quoteId } });
    return Response.json(response);
  };
}

function isAnalyzeRequest(input: unknown): input is AnalyzeRequest {
  return typeof input === "object" && input !== null
    && Object.keys(input).length === 1
    && typeof (input as Record<string, unknown>).purchaseRequestId === "string"
    && (input as Record<string, string>).purchaseRequestId.trim().length > 0;
}

function error(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export const POST = Object.assign(createAnalyzeHandler(), { withDependencies: createAnalyzeHandler });
