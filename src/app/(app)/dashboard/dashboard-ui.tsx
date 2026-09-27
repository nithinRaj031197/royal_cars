import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Presentation-only building blocks for the dashboard.
 *
 * None of these read data themselves — page.tsx does exactly the same reads
 * and permission checks as before and passes plain values in. Nothing here
 * changes what a role can see; it only changes how the same numbers look.
 */

// ---------- Financial KPI card ----------------------------------------------

const TONE_STYLES = {
  neutral: {
    icon: "bg-slate-100 text-slate-600",
    accent: "before:bg-slate-300",
    value: "text-slate-900"
  },
  positive: {
    icon: "bg-emerald-50 text-emerald-600",
    accent: "before:bg-emerald-500",
    value: "text-emerald-700"
  },
  negative: {
    icon: "bg-red-50 text-red-600",
    accent: "before:bg-red-500",
    value: "text-red-700"
  },
  brand: {
    icon: "bg-brand-50 text-brand-600",
    accent: "before:bg-brand-600",
    value: "text-slate-900"
  }
} as const;

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  emphasis = false,
  href
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: keyof typeof TONE_STYLES;
  /** Gives the card a tinted background and slightly larger figure — reserve
   * for the one or two numbers that matter most (e.g. gross profit). */
  emphasis?: boolean;
  href?: string;
}) {
  const t = TONE_STYLES[tone];
  // No entrance animation here. An earlier version started these at
  // `opacity-0` in the server-rendered HTML and revealed them with a CSS
  // animation — the exact pattern PageTransition (components/motion.tsx) was
  // rewritten once before to avoid, after it shipped every page blank until
  // hydration. It reproduced under Cypress: DOM/computed-style reported
  // opacity 1 with a correct box, yet nothing painted — a real risk, not a
  // theoretical one, so the animation is gone rather than debugged further.
  const cardClass = cn(
    "group relative flex h-full flex-col gap-3 overflow-hidden rounded-xl border p-4 shadow-sm",
    "before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
    t.accent,
    emphasis ? "border-brand-100 bg-gradient-to-br from-brand-50/70 to-white" : "border-slate-200/80 bg-white",
    href && "transition-all duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:-translate-y-0.5"
  );

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", t.icon)} aria-hidden>
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
      </div>
      <p className={cn("tabular font-display tracking-tight font-semibold", emphasis ? "text-3xl" : "text-2xl", t.value)}>
        {value}
      </p>
      {hint ? <p className="text-xs leading-relaxed text-slate-500">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cardClass}>
        {content}
      </Link>
    );
  }
  return <div className={cardClass}>{content}</div>;
}

// ---------- Section wrapper ---------------------------------------------------

export function DashSection({
  title,
  subtitle,
  action,
  children,
  className
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("card p-4 sm:p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ---------- Stock pipeline ---------------------------------------------------

export interface PipelineStage {
  label: string;
  value: number;
  icon: LucideIcon;
  href: string;
  tone: "neutral" | "progress" | "positive" | "waiting" | "done";
}

const PIPELINE_TONE: Record<PipelineStage["tone"], string> = {
  neutral: "bg-slate-100 text-slate-600 group-hover:bg-slate-200",
  progress: "bg-blue-50 text-blue-600 group-hover:bg-blue-100",
  positive: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100",
  waiting: "bg-amber-50 text-amber-700 group-hover:bg-amber-100",
  done: "bg-violet-50 text-violet-600 group-hover:bg-violet-100"
};

/** The lifecycle funnel: same counts as before, shown as the flow they are. */
export function StockPipeline({ stages }: { stages: PipelineStage[] }) {
  const total = stages.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-200 px-6 py-10 text-center">
        <p className="text-sm font-medium text-slate-700">No vehicles in the system yet</p>
        <p className="text-xs text-slate-500">Add your first seller enquiry to start the pipeline.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0 sm:flex-row sm:items-stretch sm:gap-0">
      {stages.map((s, i) => (
        <div key={s.label} className="group flex flex-1 items-stretch">
          <Link
            href={s.href}
            className="flex flex-1 flex-col items-center gap-2 rounded-lg px-2 py-3 text-center transition-colors hover:bg-slate-50 sm:py-2"
          >
            <span
              className={cn(
                "grid h-10 w-10 place-items-center rounded-full transition-colors",
                PIPELINE_TONE[s.tone]
              )}
              aria-hidden
            >
              <s.icon className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <span className="tabular text-xl font-semibold tracking-tight text-slate-900">{s.value}</span>
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{s.label}</span>
          </Link>
          {i < stages.length - 1 ? (
            <div className="hidden w-6 shrink-0 items-center justify-center text-slate-300 sm:flex" aria-hidden>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ---------- Alerts / pending actions -----------------------------------------

export interface AlertRowData {
  label: string;
  count: number;
  href: string;
  icon: LucideIcon;
  severity: "critical" | "warning" | "info";
}

const SEVERITY_DOT = {
  critical: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-blue-500"
} as const;

export function AlertList({ items }: { items: AlertRowData[] }) {
  const active = items.filter((i) => i.count > 0);

  if (active.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-medium text-emerald-800">All clear</p>
          <p className="text-xs text-emerald-700/80">Nothing needs attention right now.</p>
        </div>
      </div>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-slate-100">
      {items.map((item) => (
        <li key={item.label}>
          <Link
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-slate-50",
              item.count === 0 && "opacity-50"
            )}
          >
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", item.count > 0 ? SEVERITY_DOT[item.severity] : "bg-slate-300")} aria-hidden />
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600" aria-hidden>
              <item.icon className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1 text-sm text-slate-700">{item.label}</span>
            <span className="tabular text-sm font-semibold text-slate-900">{item.count}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ---------- Profit-margin bar -------------------------------------------------

/**
 * A single period's sales value against the profit inside it.
 *
 * Not a time-series chart: dashboardMetrics only ever returns one period's
 * aggregate, so there is nothing to plot a trend against. This shows the
 * relationship that number actually has — how much of what came in is margin
 * — as a plain CSS bar rather than pulling in a charting library for one data
 * point.
 */
export function ProfitMarginBar({
  salesValuePaise,
  grossProfitPaise,
  formatMoney
}: {
  salesValuePaise: number;
  grossProfitPaise: number;
  formatMoney: (p: number) => string;
}) {
  if (salesValuePaise <= 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-slate-200 px-6 py-8 text-center">
        <p className="text-sm font-medium text-slate-700">No sales in this period</p>
        <p className="text-xs text-slate-500">Widen the date range, or check back once a sale is booked.</p>
      </div>
    );
  }

  const marginPct = Math.max(0, Math.min(100, (grossProfitPaise / salesValuePaise) * 100));
  const isNegative = grossProfitPaise < 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sales value</p>
          <p className="tabular font-display text-xl font-semibold text-slate-900">{formatMoney(salesValuePaise)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Gross profit</p>
          <p className={cn("tabular font-display text-xl font-semibold", isNegative ? "text-red-700" : "text-emerald-700")}>
            {formatMoney(grossProfitPaise)}
          </p>
        </div>
      </div>

      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {isNegative ? (
          <div className="h-full w-full rounded-full bg-red-200" />
        ) : (
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-[width] duration-500"
            style={{ width: `${marginPct}%` }}
          />
        )}
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        {isNegative ? "This period is running at a loss." : `Margin: ${marginPct.toFixed(1)}% of sales value`}
      </p>
    </div>
  );
}

// ---------- Recent activity ---------------------------------------------------

export interface ActivityRow {
  id: string;
  summary: string;
  actorEmail: string;
  action: string;
  createdAt: string;
}

/** "3m ago" / "2h ago" / "5d ago" — falls back to a plain date past a week. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function ActivityFeed({ items }: { items: ActivityRow[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-slate-200 px-6 py-10 text-center">
        <p className="text-sm font-medium text-slate-700">No activity yet</p>
        <p className="text-xs text-slate-500">Actions across the app will show up here as they happen.</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      {items.map((row) => (
        <li key={row.id} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-slate-700">{row.summary || row.action}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {row.actorEmail || "system"} · {relativeTime(row.createdAt)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
