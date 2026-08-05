import { NextResponse } from "next/server";
import { evaluatePayment, type PayContext, type PayRequest, type PayResponse } from "@/lib/contracts/api";

function createPayHandler(context?: PayContext) {
  return async function payRoute(request: Request): Promise<NextResponse<PayResponse | { error: string }>> {
    if (!context) return NextResponse.json({ error: "Payment route is not configured" }, { status: 503 });
    return NextResponse.json(await evaluatePayment(await request.json() as PayRequest, context));
  };
}

export const POST = Object.assign(createPayHandler(), { withDependencies: createPayHandler });
