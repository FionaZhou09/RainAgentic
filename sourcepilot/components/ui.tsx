import type { ReactNode } from "react";

export function StatusBadge({ tone, children }: { tone: "positive" | "blocked" | "neutral"; children: ReactNode }) {
  const tones = {
    positive: "border-emerald-300 bg-emerald-50 text-emerald-900",
    blocked: "border-rose-300 bg-rose-50 text-rose-950",
    neutral: "border-slate-300 bg-slate-100 text-slate-800",
  } as const;

  return <span className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold leading-5 ${tones[tone]}`}>{children}</span>;
}

export function DataPoint({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 border-l-2 border-slate-200 pl-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className="mt-1 text-base font-semibold text-slate-950">{value}</dd>
    </div>
  );
}
