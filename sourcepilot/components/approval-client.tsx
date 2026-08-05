"use client";

import { useState, type FormEvent } from "react";
import type { Hex } from "@/lib/contracts/money";
import type { PayRequest, PayResponse } from "@/lib/contracts/api";
import { newAttemptKey } from "@/lib/rain/port";
import { ApprovalScreen } from "@/components/approval-screen";
import { buildApprovalFollowUp, buildApprovalModel, type ApprovalMandateSummary } from "@/components/approval-model";
import type { EnvironmentLabel } from "@/components/environment-label";

export function ApprovalClient({
  initialResponse,
  pendingRequest,
  mandate,
  environment,
}: {
  initialResponse: Extract<PayResponse, { outcome: "pending_approval" }>;
  pendingRequest: PayRequest;
  mandate: ApprovalMandateSummary;
  environment: EnvironmentLabel;
}) {
  const [response, setResponse] = useState<PayResponse>(initialResponse);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitApproval(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (response.outcome !== "pending_approval") return;
    const data = new FormData(event.currentTarget);
    const supplied = String(data.get("approvalSignature") ?? "").trim();
    if (!/^0x[0-9a-fA-F]+$/.test(supplied)) {
      setStatus("Enter the hexadecimal signature supplied by the approved wallet boundary.");
      return;
    }
    setSubmitting(true);
    setStatus("Submitting a new payment attempt with the approved nonce.");
    try {
      const request = buildApprovalFollowUp(pendingRequest, response, supplied as Hex, newAttemptKey);
      const result = await fetch("/api/pay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      const body = await result.json() as PayResponse | { error: string };
      if (!result.ok || "error" in body) throw new Error("error" in body ? body.error : "Approval request failed");
      setResponse(body);
      setStatus("Payment state updated.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Approval request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return <ApprovalScreen model={buildApprovalModel(response, mandate, environment)} interactive={response.outcome === "pending_approval"} onApprovalSubmit={submitApproval} submitting={submitting} interactionStatus={status} />;
}
