"use client";

import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  hint,
  tone,
  className
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "negative" | "neutral";
  className?: string;
}) {
  const valueClass =
    tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-red-700" : "text-slate-900";
  return (
    // h-full so tiles with hint text do not sit taller than their row.
    <div className={cn("card flex h-full flex-col p-4 transition-shadow duration-150 hover:shadow-md", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-semibold tracking-tight tabular", valueClass)}>{value}</p>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p> : null}
    </div>
  );
}
