import { DEMO_COPY } from "@/lib/contracts/copy";
import { DataPoint, StatusBadge } from "@/components/ui";
import { formatMinor, type ApprovalModel } from "@/components/approval-model";
import type { FormEventHandler } from "react";

export function ApprovalScreen({ model, interactive = false, onApprovalSubmit, submitting = false, interactionStatus = "" }: {
  model: ApprovalModel;
  interactive?: boolean;
  onApprovalSubmit?: FormEventHandler<HTMLFormElement>;
  submitting?: boolean;
  interactionStatus?: string;
}) {
  const pending = model.response.outcome === "pending_approval";
  const blocked = model.response.outcome === "blocked";
  return (
    <main className="min-h-screen bg-[#f4f6f8] text-slate-950">
      <header className="border-b border-slate-300 bg-[#101820] text-white">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-lg bg-[#d9ff55] text-lg font-black text-[#101820]">{DEMO_COPY.productMark}</span>
            <span className="text-xl font-bold tracking-tight">{DEMO_COPY.productName}</span>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-white/25 px-4 py-2 text-sm font-semibold">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-[#d9ff55]" />
            {DEMO_COPY.environmentLabel}: {model.environment}
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full min-w-0 max-w-[1480px] gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-10">
        <section aria-labelledby="approval-title" className="min-w-0 space-y-7">
          <div className="border-b border-slate-300 pb-7">
            <h1 id="approval-title" className="text-4xl font-bold tracking-[-0.04em] sm:text-5xl">Payment approval</h1>
            <div className="mt-4 flex flex-wrap items-center gap-3" role="status" aria-live="polite">
              <StatusBadge tone={model.stateTone}>{model.layerLabel}</StatusBadge>
              <p className="text-base text-slate-700">{model.message}</p>
            </div>
          </div>

          <section aria-labelledby="mandate-summary" className="w-full min-w-0 rounded-2xl border border-slate-300 bg-white p-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)] sm:p-6">
            <h2 id="mandate-summary" className="text-2xl font-bold tracking-tight">Signed mandate</h2>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <DataPoint label="Cumulative ceiling" value={formatMinor(model.mandate.maxTotalMinor)} />
              <DataPoint label="Autonomous threshold" value={formatMinor(model.mandate.autonomousMaxMinor)} />
              <DataPoint label="Deposit cap" value={`${model.mandate.maxDepositBps / 100}% of PO value`} />
              <DataPoint label="Expiry" value={model.mandate.expiryLabel} />
            </dl>
            <dl className="mt-6 grid gap-5 border-t border-slate-200 pt-5 sm:grid-cols-2">
              <DataPoint label="Payee scope commitment" value={<code className="min-w-0 break-all text-sm">{model.mandate.payeeScope}</code>} />
              <DataPoint label="Published payee evidence" value={<code className="min-w-0 break-all text-sm">{model.mandate.payeePreimage}</code>} />
            </dl>
          </section>

          {model.approvalPayload ? <section aria-labelledby="signed-payload" className="w-full min-w-0 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:p-6">
            <h2 id="signed-payload" className="text-2xl font-bold tracking-tight">Approval payload</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">Review the exact six EIP-712 fields before supplying an approval signature.</p>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              {model.signedFields?.map(({ label, value }) => <DataPoint key={label} label={label} value={<code className="min-w-0 break-all text-sm">{value}</code>} />)}
            </dl>
            {interactive ? <form onSubmit={onApprovalSubmit} className="mt-6 w-full min-w-0 border-t border-amber-300 pt-5">
              <label htmlFor="approval-signature" className="block text-sm font-bold">Injected approval signature</label>
              <p id="signature-help" className="mt-1 text-sm text-slate-600">The browser does not hold or use a private key. Supply the signature from the approved wallet boundary.</p>
              <input id="approval-signature" name="approvalSignature" aria-describedby="signature-help" required pattern="0x[0-9a-fA-F]+" autoComplete="off" className="mt-3 w-full rounded-lg border border-slate-400 bg-white px-4 py-3 font-mono text-sm focus:outline-none focus:ring-4 focus:ring-emerald-300" />
              <button type="submit" disabled={submitting} className="mt-4 w-full rounded-lg bg-[#101820] px-5 py-3 font-bold text-white focus:outline-none focus:ring-4 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">{submitting ? "Submitting…" : "Submit approved payment"}</button>
              <p className="mt-3 text-sm text-slate-700" role="status" aria-live="polite">{interactionStatus}</p>
            </form> : null}
          </section> : null}

          {model.chainEvidence ? <section aria-labelledby="transaction-evidence" className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6">
            <h2 id="transaction-evidence" className="text-2xl font-bold tracking-tight">Transaction evidence</h2>
            <dl className="mt-5 grid gap-5 sm:grid-cols-3">
              <DataPoint label="Chain transaction" value={<a className="break-all text-sm font-semibold underline decoration-2 underline-offset-4" href={model.chainEvidence.explorerUrl}>{model.chainEvidence.txHash}</a>} />
              <DataPoint label="Remaining ceiling" value={formatMinor(model.chainEvidence.remainingMinor)} />
              <DataPoint label="Rain payment reference" value={model.rainPaymentId} />
            </dl>
          </section> : null}

          {(pending || blocked) ? <section aria-labelledby="zero-effects" className="rounded-2xl border border-slate-300 bg-white p-6">
            <h2 id="zero-effects" className="text-xl font-bold">No payment side effects</h2>
            <ul className="mt-3 space-y-2 text-base text-slate-700">{model.zeroEffects.map((effect) => <li key={effect}>{effect}</li>)}</ul>
          </section> : null}

          <aside className="rounded-2xl border border-slate-300 bg-white p-6">
            <p className="font-medium leading-7 text-slate-700">{DEMO_COPY.enforcementClaim}</p>
            <p className="mt-3 text-sm text-slate-600">Advisory — {model.advisory}</p>
          </aside>
        </section>

        <aside aria-label={DEMO_COPY.networkSpaceTitle} className="w-full min-w-0 rounded-2xl border border-dashed border-slate-400 bg-slate-200/60 p-4 sm:p-6 lg:min-h-[720px]">
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-700">{DEMO_COPY.networkSpaceTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{DEMO_COPY.networkSpaceBody}</p>
        </aside>
      </div>
    </main>
  );
}
