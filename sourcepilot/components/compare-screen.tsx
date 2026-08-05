import { DEMO_COPY } from "@/lib/contracts/copy";
import { fmtUSD } from "@/lib/contracts/money";
import type { PurchaseRequest, QuoteInput, Supplier } from "@/lib/contracts/sourcing";
import type { QuoteAssessment } from "@/lib/score";
import { buildSupplierRows } from "@/components/compare-model";
import { DataPoint, StatusBadge } from "@/components/ui";

interface CompareScreenProps {
  purchaseRequest: PurchaseRequest;
  quotes: QuoteInput[];
  suppliers: Supplier[];
  assessments: QuoteAssessment[];
  environment: "Local Anvil" | "Monad Testnet";
}

export function CompareScreen(props: CompareScreenProps) {
  const rows = buildSupplierRows(props.purchaseRequest, props.quotes, props.suppliers, props.assessments);

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-slate-950">
      <header className="border-b border-slate-300 bg-[#101820] text-white">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-4 px-6 py-5 lg:px-10">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-lg bg-[#d9ff55] text-lg font-black text-[#101820]">{DEMO_COPY.productMark}</span>
            <span className="text-xl font-bold tracking-tight">{DEMO_COPY.productName}</span>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-white/25 px-4 py-2 text-sm font-semibold">
            <span className="size-2.5 rounded-full bg-[#d9ff55]" />
            {DEMO_COPY.environmentLabel}: {props.environment}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-10">
        <section aria-labelledby="comparison-title" className="min-w-0">
          <div className="flex flex-col gap-6 border-b border-slate-300 pb-7 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 id="comparison-title" className="max-w-3xl text-4xl font-bold tracking-[-0.04em] sm:text-5xl">{DEMO_COPY.pageTitle}</h1>
              <p className="mt-3 max-w-2xl text-lg leading-7 text-slate-600">{DEMO_COPY.pageSummary}</p>
            </div>
            <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              <DataPoint label={DEMO_COPY.requestLabel} value={props.purchaseRequest.id} />
              <DataPoint label={DEMO_COPY.quantityLabel} value={`${props.purchaseRequest.quantity} ${DEMO_COPY.unitsLabel}`} />
              <DataPoint label={DEMO_COPY.destinationLabel} value={props.purchaseRequest.destination} />
              <DataPoint label={DEMO_COPY.suppliersReviewedLabel} value={rows.length} />
            </dl>
          </div>

          <div className="mt-7 space-y-4">
            {rows.map((row) => {
              const recommended = row.assessment.rank === 1;
              return (
                <article key={row.supplier.id} className={`overflow-hidden rounded-2xl border bg-white shadow-[0_14px_40px_rgba(15,23,42,0.06)] ${recommended ? "border-emerald-500" : "border-slate-300"}`}>
                  <div className="grid gap-6 p-6 xl:grid-cols-[minmax(190px,0.8fr)_minmax(360px,1.5fr)_minmax(250px,1fr)] xl:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-bold tracking-tight">{row.supplier.name}</h2>
                        {recommended ? <StatusBadge tone="positive">{DEMO_COPY.recommendedLabel}</StatusBadge> : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-500">{row.supplier.country} · {row.supplier.verificationStatus}</p>
                      <p className="mt-5 text-lg font-bold">{row.assessment.rank ? `${DEMO_COPY.rankLabel} ${row.assessment.rank}` : DEMO_COPY.notRankedLabel}</p>
                    </div>

                    <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                      <DataPoint label={DEMO_COPY.landedCostLabel} value={row.assessment.cost.kind === "complete" ? fmtUSD(row.assessment.cost.breakdown.landedTotal) : DEMO_COPY.unquotableLabel} />
                      <DataPoint label={DEMO_COPY.leadTimeLabel} value={`${row.quote.leadTimeDays} ${DEMO_COPY.daysLabel}`} />
                      <DataPoint label={DEMO_COPY.specMatchLabel} value={`${row.quote.specMatchPct}%`} />
                      <DataPoint label={DEMO_COPY.depositLabel} value={`${Number(row.quote.depositBps) / 100}%`} />
                    </dl>

                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{DEMO_COPY.policyChecksLabel}</h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {row.badges.map((badge) => <StatusBadge key={`${row.supplier.id}-${badge.code}`} tone={badge.tone}>{badge.label}</StatusBadge>)}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="mt-7 rounded-2xl border border-slate-300 bg-white p-6">
            <p className="text-base font-medium leading-7 text-slate-700">{DEMO_COPY.enforcementClaim}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge tone="neutral">{DEMO_COPY.landedReferenceLabel}</StatusBadge>
              <StatusBadge tone="neutral">{DEMO_COPY.deliveryDeadlineLabel}</StatusBadge>
              <StatusBadge tone="neutral">{DEMO_COPY.mandateExpiryLabel}</StatusBadge>
            </div>
          </aside>
        </section>

        <aside aria-label={DEMO_COPY.networkSpaceTitle} className="min-h-40 rounded-2xl border border-dashed border-slate-400 bg-slate-200/60 p-6 lg:min-h-[720px]">
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-700">{DEMO_COPY.networkSpaceTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{DEMO_COPY.networkSpaceBody}</p>
        </aside>
      </div>
    </main>
  );
}
