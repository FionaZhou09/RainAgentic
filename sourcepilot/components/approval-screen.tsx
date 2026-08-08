import { DEMO_COPY } from "@/lib/contracts/copy";
import { AppHeader, CeilingMeter, DataPoint, Orb, Panel, StatusBadge } from "@/components/ui";
import { formatMinor, type ApprovalModel } from "@/components/approval-model";
import type { FormEventHandler } from "react";

export function ApprovalScreen({
  model,
  interactive = false,
  onApprovalSubmit,
  submitting = false,
  interactionStatus = "",
}: {
  model: ApprovalModel;
  interactive?: boolean;
  onApprovalSubmit?: FormEventHandler<HTMLFormElement>;
  submitting?: boolean;
  interactionStatus?: string;
}) {
  const pending = model.response.outcome === "pending_approval";
  const blocked = model.response.outcome === "blocked";
  const ceilingMinor = Number(model.mandate.maxTotalMinor);
  const pendingMinor = model.approvalPayload ? Number(model.approvalPayload.amount) : 0;
  const spentMinor = model.chainEvidence
    ? Math.max(0, ceilingMinor - Number(model.chainEvidence.remainingMinor) - pendingMinor)
    : 0;

  return (
    <main className="min-h-screen text-foreground">
      <AppHeader
        productMark={DEMO_COPY.productMark}
        productName={DEMO_COPY.productName}
        environmentLabel={DEMO_COPY.environmentLabel}
        environment={model.environment}
        current="approve"
      />

      <Orb className="-right-28 -top-28 hidden lg:block" size={480} />

      <div className="relative mx-auto grid w-full min-w-0 max-w-[1480px] gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-10">
        <section aria-labelledby="approval-title" className="min-w-0 space-y-4 sm:space-y-5">
          {/* Hero ------------------------------------------------------ */}
          <div className="rise pb-7 hairline">
            <p className="eyebrow">Payment authorization</p>
            <h1
              id="approval-title"
              className="mt-3 text-4xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[3.6rem]"
            >
              <span className="text-accent">Payment</span>
              <span className="display-grad"> approval</span>
            </h1>
            <div className="mt-5 flex flex-wrap items-center gap-3" role="status" aria-live="polite">
              <StatusBadge tone={model.stateTone}>{model.layerLabel}</StatusBadge>
              <p className="min-w-0 text-[0.9375rem] leading-6 text-muted">{model.message}</p>
            </div>
          </div>

          {/* Signed mandate -------------------------------------------- */}
          <Panel
            aria-labelledby="mandate-summary"
            className="rise w-full min-w-0 p-5 sm:p-6"
            style={{ animationDelay: "80ms" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Step 1</p>
                <h2 id="mandate-summary" className="mt-1 text-xl font-semibold tracking-tight">
                  Signed mandate
                </h2>
              </div>
              <StatusBadge tone="neutral">EIP-712 · principal-signed</StatusBadge>
            </div>

            <dl className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
              <DataPoint label="Cumulative ceiling" value={<span className="tabular-nums">{formatMinor(model.mandate.maxTotalMinor)}</span>} />
              <DataPoint label="Autonomous threshold" value={<span className="tabular-nums">{formatMinor(model.mandate.autonomousMaxMinor)}</span>} />
              <DataPoint label="Deposit cap" value={<span className="tabular-nums">{model.mandate.maxDepositBps / 100}% of PO value</span>} />
              <DataPoint label="Expiry" value={model.mandate.expiryLabel} />
            </dl>

            <div className="mt-6 border-t border-line pt-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="eyebrow">Ceiling consumption</h3>
                <p className="text-xs text-faint">
                  against <span className="tabular-nums text-muted">{formatMinor(model.mandate.maxTotalMinor)}</span> signed
                </p>
              </div>
              <div className="mt-3">
                <CeilingMeter spentMinor={spentMinor} pendingMinor={pendingMinor} ceilingMinor={ceilingMinor} />
              </div>
            </div>

            <dl className="mt-6 grid gap-x-6 gap-y-5 border-t border-line pt-5 sm:grid-cols-2">
              <DataPoint
                label="Payee scope commitment"
                value={<code className="block min-w-0 break-all rounded-lg border border-line bg-black/40 px-3 py-2 text-[0.75rem] leading-5 text-accent/90">{model.mandate.payeeScope}</code>}
              />
              <DataPoint
                label="Published payee evidence"
                value={<code className="block min-w-0 whitespace-pre-line break-all rounded-lg border border-line bg-black/40 px-3 py-2 text-[0.75rem] leading-5 text-muted">{model.mandate.payeePreimage}</code>}
              />
            </dl>
          </Panel>

          {/* Approval payload ------------------------------------------ */}
          {model.approvalPayload ? (
            <Panel
              aria-labelledby="signed-payload"
              className="rise w-full min-w-0 p-5 sm:p-6"
              style={{ animationDelay: "160ms", borderColor: "rgba(251,191,36,0.3)" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">Step 2</p>
                  <h2 id="signed-payload" className="mt-1 text-xl font-semibold tracking-tight">
                    Approval payload
                  </h2>
                </div>
                <StatusBadge tone="neutral">6 signed fields</StatusBadge>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-faint">
                Review the exact six EIP-712 fields before supplying an approval signature.
              </p>

              <dl className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
                {model.signedFields?.map(({ label, value }) => (
                  <DataPoint
                    key={label}
                    label={label}
                    value={<code className="block min-w-0 break-all rounded-lg border border-line bg-black/40 px-3 py-2 text-[0.75rem] leading-5 text-muted">{value}</code>}
                  />
                ))}
              </dl>

              {interactive ? (
                <form onSubmit={onApprovalSubmit} className="mt-6 w-full min-w-0 border-t border-line pt-6">
                  <label htmlFor="approval-signature" className="block text-sm font-semibold text-foreground">
                    Injected approval signature
                  </label>
                  <p id="signature-help" className="mt-1.5 max-w-2xl text-sm leading-6 text-faint">
                    The browser does not hold or use a private key. Supply the signature from the approved wallet boundary.
                  </p>
                  <div className="mt-4 flex w-full min-w-0 flex-col gap-3 sm:flex-row">
                    <input
                      id="approval-signature"
                      name="approvalSignature"
                      aria-describedby="signature-help"
                      required
                      pattern="0x[0-9a-fA-F]+"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="0x…"
                      className="mono w-full min-w-0 flex-1 rounded-xl border border-line-strong bg-black/50 px-4 py-3 text-sm text-foreground placeholder:text-faint transition focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent/20"
                    />
                    <button
                      type="submit"
                      disabled={submitting}
                      className="shrink-0 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-ink shadow-[0_0_36px_-10px_rgba(217,255,85,0.85)] transition hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
                    >
                      {submitting ? "Submitting…" : "Submit approved payment"}
                    </button>
                  </div>
                  <p className="mt-3 min-h-5 text-sm text-muted" role="status" aria-live="polite">
                    {interactionStatus}
                  </p>
                </form>
              ) : null}
            </Panel>
          ) : null}

          {/* Transaction evidence -------------------------------------- */}
          {model.chainEvidence ? (
            <Panel tone="accent" aria-labelledby="transaction-evidence" className="ring-accent rise w-full min-w-0 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">Settled</p>
                  <h2 id="transaction-evidence" className="mt-1 text-xl font-semibold tracking-tight">
                    Transaction evidence
                  </h2>
                </div>
                <StatusBadge tone="positive">On-chain</StatusBadge>
              </div>
              <dl className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-3">
                <DataPoint
                  label="Chain transaction"
                  value={
                    <a
                      className="block min-w-0 break-all font-mono text-[0.75rem] leading-5 text-accent underline decoration-accent/40 decoration-2 underline-offset-4 transition hover:decoration-accent"
                      href={model.chainEvidence.explorerUrl}
                    >
                      {model.chainEvidence.txHash}
                    </a>
                  }
                />
                <DataPoint label="Remaining ceiling" value={<span className="tabular-nums">{formatMinor(model.chainEvidence.remainingMinor)}</span>} />
                <DataPoint label="Rain payment reference" value={<span className="mono text-sm">{model.rainPaymentId}</span>} />
              </dl>
            </Panel>
          ) : null}

          {/* Zero effects ---------------------------------------------- */}
          {pending || blocked ? (
            <Panel className="rise w-full min-w-0 p-5 sm:p-6" style={{ animationDelay: "240ms" }}>
              <h2 id="zero-effects" className="text-base font-semibold tracking-tight">
                No payment side effects
              </h2>
              <ul className="mt-3 space-y-2 text-[0.9375rem] text-muted">
                {model.zeroEffects.map((effect) => (
                  <li key={effect} className="flex items-start gap-2.5">
                    <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-rose-400/70" />
                    <span className="min-w-0">{effect}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel as="aside" className="rise w-full min-w-0 p-5 sm:p-6" style={{ animationDelay: "300ms" }}>
            <h3 className="eyebrow">Enforcement boundary</h3>
            <p className="mt-2.5 text-[0.9375rem] leading-7 text-muted">{DEMO_COPY.enforcementClaim}</p>
            <p className="mt-4 text-sm text-faint">Advisory — {model.advisory}</p>
          </Panel>
        </section>

        {/* Network evidence rail ---------------------------------------- */}
        <Panel
          as="aside"
          aria-label={DEMO_COPY.networkSpaceTitle}
          className="rise w-full min-w-0 self-start p-5 sm:p-6 lg:sticky lg:top-24 lg:min-h-[560px]"
          style={{ animationDelay: "200ms" }}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="eyebrow">{DEMO_COPY.networkSpaceTitle}</h2>
            <span aria-hidden="true" className="flex gap-1.5">
              <span className="size-2 rounded-full bg-rose-400/50" />
              <span className="size-2 rounded-full bg-amber-400/50" />
              <span className="size-2 rounded-full bg-emerald-400/50" />
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-faint">{DEMO_COPY.networkSpaceBody}</p>
          <div aria-hidden="true" className="mono mt-5 rounded-xl border border-line bg-black/40 p-4 text-xs leading-6 text-faint">
            <p><span className="text-accent">›</span> POST /api/pay</p>
            <p className="mt-1 opacity-60">{pending ? "→ 200 pending_approval" : blocked ? "→ 200 blocked" : "→ 200 approved"}</p>
            <p className="opacity-40">— — —</p>
          </div>
        </Panel>
      </div>
    </main>
  );
}
