import { DEMO_COPY } from "@/lib/contracts/copy";
import { fmtUSD } from "@/lib/contracts/money";
import type { PurchaseRequest, QuoteInput, Supplier } from "@/lib/contracts/sourcing";
import type { QuoteAssessment } from "@/lib/score";
import { buildSupplierRows } from "@/components/compare-model";
import { AppHeader, DataPoint, DisplayTitle, Meter, Orb, Panel, RankMedal, StatusBadge } from "@/components/ui";

interface CompareScreenProps {
  purchaseRequest: PurchaseRequest;
  quotes: QuoteInput[];
  suppliers: Supplier[];
  assessments: QuoteAssessment[];
  environment: "Local Anvil" | "Monad Testnet";
}

export function CompareScreen(props: CompareScreenProps) {
  const rows = buildSupplierRows(props.purchaseRequest, props.quotes, props.suppliers, props.assessments);
  const pr = props.purchaseRequest;
  const capPct = Number(pr.maxDepositBps) / 100;

  return (
    <main className="min-h-screen text-foreground">
      <AppHeader
        productMark={DEMO_COPY.productMark}
        productName={DEMO_COPY.productName}
        environmentLabel={DEMO_COPY.environmentLabel}
        environment={props.environment}
        current="compare"
      />

      <Orb className="-right-24 -top-24 hidden lg:block" size={520} />

      <div className="relative mx-auto grid w-full min-w-0 max-w-[1480px] gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-10">
        <section aria-labelledby="comparison-title" className="min-w-0">
          {/* Hero ------------------------------------------------------ */}
          <div className="rise flex flex-col gap-7 pb-8 hairline xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <p className="eyebrow">{DEMO_COPY.requestLabel} · {pr.id}</p>
              <DisplayTitle
                id="comparison-title"
                text={DEMO_COPY.pageTitle}
                className="mt-3 max-w-3xl text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[3.6rem]"
              />
              <p className="mt-4 max-w-2xl text-[1.0625rem] leading-7 text-muted">
                {DEMO_COPY.pageSummary}
              </p>
            </div>
            <dl className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4 xl:gap-x-10">
              <DataPoint label={DEMO_COPY.requestLabel} value={pr.id} />
              <DataPoint label={DEMO_COPY.quantityLabel} value={`${pr.quantity} ${DEMO_COPY.unitsLabel}`} />
              <DataPoint label={DEMO_COPY.destinationLabel} value={pr.destination} />
              <DataPoint label={DEMO_COPY.suppliersReviewedLabel} value={rows.length} />
            </dl>
          </div>

          {/* Supplier cards -------------------------------------------- */}
          <div className="mt-7 space-y-4">
            {rows.map((row, index) => {
              const recommended = row.assessment.rank === 1;
              const depositPct = Number(row.quote.depositBps) / 100;
              return (
                <Panel
                  as="article"
                  key={row.supplier.id}
                  tone={recommended ? "accent" : "default"}
                  className={`rise ${recommended ? "ring-accent" : ""}`}
                  style={{ animationDelay: `${80 + index * 70}ms` }}
                >
                  <div className="grid gap-6 p-5 sm:p-6 2xl:grid-cols-[minmax(190px,0.8fr)_minmax(360px,1.5fr)_minmax(250px,1fr)] 2xl:items-center">
                    {/* Identity */}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="truncate text-xl font-semibold tracking-tight">{row.supplier.name}</h2>
                        {recommended ? <StatusBadge tone="positive">{DEMO_COPY.recommendedLabel}</StatusBadge> : null}
                      </div>
                      <p className="mt-1.5 text-sm text-faint">
                        {row.supplier.country} <span aria-hidden="true">·</span> {row.supplier.verificationStatus}
                      </p>
                      <div className="mt-4">
                        <RankMedal rank={row.assessment.rank ?? null} notRanked={DEMO_COPY.notRankedLabel} />
                      </div>
                    </div>

                    {/* Metrics, each measured against its signed limit */}
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-5 sm:grid-cols-4 2xl:border-l 2xl:border-t-0 2xl:pl-7 2xl:pt-0">
                      <div className="min-w-0">
                        <DataPoint
                          label={DEMO_COPY.landedCostLabel}
                          value={
                            row.assessment.cost.kind === "complete" ? (
                              <span className="tabular-nums">{fmtUSD(row.assessment.cost.breakdown.landedTotal)}</span>
                            ) : (
                              <span className="text-rose-300">{DEMO_COPY.unquotableLabel}</span>
                            )
                          }
                        />
                      </div>
                      <div className="min-w-0">
                        <DataPoint label={DEMO_COPY.leadTimeLabel} value={<span className="tabular-nums">{row.quote.leadTimeDays} {DEMO_COPY.daysLabel}</span>} />
                        <Meter value={row.quote.leadTimeDays} limit={pr.maxLeadTimeDays} direction="under" />
                        <p className="mt-1.5 text-xs text-faint">limit {pr.maxLeadTimeDays}</p>
                      </div>
                      <div className="min-w-0">
                        <DataPoint label={DEMO_COPY.specMatchLabel} value={<span className="tabular-nums">{row.quote.specMatchPct}%</span>} />
                        <Meter value={row.quote.specMatchPct} limit={pr.minSpecMatchPct} direction="over" />
                        <p className="mt-1.5 text-xs text-faint">floor {pr.minSpecMatchPct}%</p>
                      </div>
                      <div className="min-w-0">
                        <DataPoint label={DEMO_COPY.depositLabel} value={<span className="tabular-nums">{depositPct}%</span>} />
                        <Meter value={depositPct} limit={capPct} direction="under" />
                        <p className="mt-1.5 text-xs text-faint">cap {capPct}%</p>
                      </div>
                    </dl>

                    {/* Policy */}
                    <div className="min-w-0 border-t border-line pt-5 2xl:border-l 2xl:border-t-0 2xl:pl-7 2xl:pt-0">
                      <h3 className="eyebrow">{DEMO_COPY.policyChecksLabel}</h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {row.badges.map((badge) => (
                          <StatusBadge key={`${row.supplier.id}-${badge.code}`} tone={badge.tone}>
                            {badge.label}
                          </StatusBadge>
                        ))}
                      </div>
                    </div>
                  </div>
                </Panel>
              );
            })}
          </div>

          {/* Enforcement claim ----------------------------------------- */}
          <Panel as="aside" className="rise mt-4 p-5 sm:p-6" style={{ animationDelay: "340ms" }}>
            <h3 className="eyebrow">Enforcement boundary</h3>
            <p className="mt-2.5 text-[0.9375rem] leading-7 text-muted">{DEMO_COPY.enforcementClaim}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge tone="neutral">{DEMO_COPY.landedReferenceLabel}</StatusBadge>
              <StatusBadge tone="neutral">{DEMO_COPY.deliveryDeadlineLabel}</StatusBadge>
              <StatusBadge tone="neutral">{DEMO_COPY.mandateExpiryLabel}</StatusBadge>
            </div>
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
          <div
            aria-hidden="true"
            className="mono mt-5 rounded-xl border border-line bg-black/40 p-4 text-xs leading-6 text-faint"
          >
            <p><span className="text-accent">›</span> awaiting request…</p>
            <p className="mt-1 opacity-60">POST /api/pay</p>
            <p className="opacity-40">— — —</p>
          </div>
        </Panel>
      </div>
    </main>
  );
}
