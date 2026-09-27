"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { todayDateOnly } from "@/lib/dates";

/**
 * Same navigation as before — `router.push('/dashboard?from=...&to=...')` —
 * with quick-range chips added as an alternative way to reach a common range.
 * A chip just fills the two date fields and submits; it does not add any new
 * query parameter or change what the server does with from/to.
 */
const PRESETS: Array<{ label: string; days: number }> = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 }
];

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function startOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export function PeriodPicker({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);

  function go(nf: string, nt: string) {
    setF(nf);
    setT(nt);
    router.push(`/dashboard?from=${nf}&to=${nt}`);
  }

  const activePreset = PRESETS.find((p) => from === isoDaysAgo(p.days) && to === todayDateOnly())?.label;
  const isThisMonth = from === startOfMonth() && to === todayDateOnly();

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => go(isoDaysAgo(p.days), todayDateOnly())}
            className={
              activePreset === p.label
                ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white"
                : "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
            }
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => go(startOfMonth(), todayDateOnly())}
          className={
            isThisMonth
              ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white"
              : "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
          }
        >
          This month
        </button>
      </div>

      <form
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          go(f, t);
        }}
      >
        <CalendarRange className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <input
          aria-label="From date"
          type="date"
          className="w-[8.5rem] border-0 bg-transparent p-0 text-sm text-slate-700 focus:outline-none focus:ring-0"
          value={f}
          onChange={(e) => setF(e.target.value)}
        />
        <span className="text-slate-300" aria-hidden>
          →
        </span>
        <input
          aria-label="To date"
          type="date"
          className="w-[8.5rem] border-0 bg-transparent p-0 text-sm text-slate-700 focus:outline-none focus:ring-0"
          value={t}
          onChange={(e) => setT(e.target.value)}
        />
        <button className="btn-primary shrink-0 px-3 py-1.5 text-xs">Apply</button>
      </form>
    </div>
  );
}
