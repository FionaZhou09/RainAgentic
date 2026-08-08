import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Status badge                                                        */
/* ------------------------------------------------------------------ */

const TONE = {
  positive: {
    wrap: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    dot: "bg-emerald-400 text-emerald-400",
  },
  blocked: {
    wrap: "border-rose-400/30 bg-rose-400/10 text-rose-200",
    dot: "bg-rose-400 text-rose-400",
  },
  neutral: {
    wrap: "border-white/12 bg-white/[0.05] text-slate-300",
    dot: "bg-slate-400 text-slate-400",
  },
} as const;

export function StatusBadge({
  tone,
  children,
}: {
  tone: "positive" | "blocked" | "neutral";
  children: ReactNode;
}) {
  const t = TONE[tone];
  return (
    <span
      className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-[0.8125rem] font-medium leading-5 ${t.wrap}`}
    >
      <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${t.dot}`} />
      <span className="min-w-0">{children}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Data point                                                          */
/* ------------------------------------------------------------------ */

export function DataPoint({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1.5 text-[0.9375rem] font-semibold tracking-tight text-foreground">
        {value}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Product header                                                      */
/* ------------------------------------------------------------------ */

export function AppHeader({
  productMark,
  productName,
  environmentLabel,
  environment,
  current,
}: {
  productMark: string;
  productName: string;
  environmentLabel: string;
  environment: string;
  current?: "compare" | "approve";
}) {
  const live = environment === "Local Anvil" || environment === "Monad Testnet";
  return (
    <header className="sticky top-0 z-30 hairline bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-[0.8125rem] font-black tracking-tight text-accent-ink shadow-[0_0_28px_-6px_rgba(217,255,85,0.7)]"
          >
            {productMark}
          </span>
          <span className="truncate text-[1.0625rem] font-semibold tracking-tight text-foreground">
            {productName}
          </span>
        </div>
        <nav aria-label="Screens" className="pill-nav order-3 sm:order-none">
          <a href="/compare" aria-current={current === "compare" ? "page" : undefined}>Compare</a>
          <a href="/approve" aria-current={current === "approve" ? "page" : undefined}>Approve</a>
        </nav>
        <div className="flex items-center gap-2.5 rounded-full border border-line bg-white/[0.04] px-3.5 py-1.5 text-[0.8125rem]">
          <span
            aria-hidden="true"
            className={`pulse-dot size-2 rounded-full ${live ? "bg-accent text-accent" : "bg-amber-400 text-amber-400"}`}
          />
          <span className="text-faint">{environmentLabel}</span>
          <span className="font-medium text-foreground">{environment}</span>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Panel + section heading                                             */
/* ------------------------------------------------------------------ */

export function Panel({
  as: Tag = "section",
  tone = "default",
  className = "",
  children,
  ...rest
}: {
  as?: "section" | "article" | "aside" | "div";
  tone?: "default" | "accent";
  className?: string;
  children: ReactNode;
} & Record<string, unknown>) {
  return (
    <Tag
      className={`panel panel-lift rounded-2xl ${tone === "accent" ? "panel-accent" : ""} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function SectionTitle({
  id,
  eyebrow,
  children,
}: {
  id?: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <div>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2 id={id} className="mt-1 text-lg font-semibold tracking-tight text-foreground">
        {children}
      </h2>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rank chip                                                           */
/* ------------------------------------------------------------------ */

export function RankChip({ rank, label, notRanked }: { rank: number | null; label: string; notRanked: string }) {
  if (!rank) {
    return (
      <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-faint">
        {notRanked}
      </span>
    );
  }
  const top = rank === 1;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold tabular-nums ${
        top
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-line bg-white/[0.03] text-muted"
      }`}
    >
      <span className="eyebrow !tracking-[0.1em] !text-current opacity-70">{label}</span>
      <span className="text-sm">{rank}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Constraint meter — a value measured against its signed limit        */
/* ------------------------------------------------------------------ */

export function Meter({
  value,
  limit,
  direction,
}: {
  /** A quote may not state the field at all; an unstated value renders no meter. */
  value: number | null | undefined;
  limit: number | null | undefined;
  /** "under" = value must stay at or below limit; "over" = must reach it */
  direction: "under" | "over";
}) {
  if (value === null || value === undefined || !limit) return null;
  const ratio = limit === 0 ? 0 : value / limit;
  const passes = direction === "under" ? value <= limit : value >= limit;
  const atEdge = passes && Math.abs(ratio - 1) < 0.0001;
  const tone = !passes ? "meter-bad" : atEdge ? "meter-edge" : "meter-ok";
  const width = Math.min(100, Math.max(4, ratio * 100));

  return (
    <div className={`meter mt-2 ${tone}`} aria-hidden="true">
      <i style={{ width: `${width}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rank medal                                                          */
/* ------------------------------------------------------------------ */

export function RankMedal({ rank, notRanked }: { rank: number | null; notRanked: string }) {
  if (!rank) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3 py-1 text-xs font-medium text-faint">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-white/25" />
        {notRanked}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-full border border-accent/45 bg-accent/12 text-sm font-bold tabular-nums text-accent shadow-[0_0_22px_-6px_rgba(217,255,85,0.9)]"
      >
        {rank}
      </span>
      <span className="eyebrow !text-accent/80">Rank</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Ceiling meter — spent / this payment / remaining, against the cap   */
/* ------------------------------------------------------------------ */

export function CeilingMeter({
  spentMinor,
  pendingMinor,
  ceilingMinor,
}: {
  spentMinor: number;
  pendingMinor: number;
  ceilingMinor: number;
}) {
  const pct = (n: number) => Math.max(0, (n / ceilingMinor) * 100);
  const remaining = Math.max(0, ceilingMinor - spentMinor - pendingMinor);
  const overflows = spentMinor + pendingMinor > ceilingMinor;

  return (
    <div>
      <div className="ceiling" role="img" aria-label={`${pct(spentMinor).toFixed(0)}% spent, ${pct(pendingMinor).toFixed(0)}% pending, ${pct(remaining).toFixed(0)}% remaining`}>
        <span style={{ width: `${pct(spentMinor)}%`, background: "linear-gradient(90deg,#4ade80,#a3e635)" }} />
        <span
          style={{
            width: `${pct(pendingMinor)}%`,
            background: overflows
              ? "linear-gradient(90deg,#fb7185,#f43f5e)"
              : "linear-gradient(90deg,#d9ff55,#fbbf24)",
            animationDelay: "120ms",
          }}
        />
        <span style={{ width: `${pct(remaining)}%`, background: "rgba(255,255,255,0.10)", animationDelay: "240ms" }} />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-faint">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-sm bg-emerald-400" />Already spent
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={`size-2 rounded-sm ${overflows ? "bg-rose-400" : "bg-accent"}`} />This payment
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-sm bg-white/20" />Remaining headroom
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Iridescent orb — decorative generative artwork                      */
/* ------------------------------------------------------------------ */

export function Orb({ className = "", size = 420 }: { className?: string; size?: number }) {
  return (
    <div
      aria-hidden="true"
      className={`orb pointer-events-none absolute select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="orb-shell orb-a" />
      <span className="orb-shell orb-b" />
      <span className="orb-shell orb-c" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Display heading — first word carries the accent                     */
/* ------------------------------------------------------------------ */

export function DisplayTitle({ id, text, className = "" }: { id?: string; text: string; className?: string }) {
  const [lead, ...rest] = text.split(" ");
  return (
    <h1 id={id} className={className}>
      <span className="text-accent">{lead}</span>
      {rest.length ? <span className="display-grad"> {rest.join(" ")}</span> : null}
    </h1>
  );
}
