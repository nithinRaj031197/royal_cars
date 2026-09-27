import {
  Inbox,
  Wrench,
  Car,
  BookmarkCheck,
  ShoppingCart,
  PackageCheck,
  Wallet,
  TrendingUp,
  TrendingDown,
  Users,
  AlertCircle,
  Clock,
  ClipboardList,
  Timer,
  ClipboardCheck,
  Activity
} from "lucide-react";
import { requireSession } from "@/server/auth";
import { getStore } from "@/lib/store";
import { repoFor } from "@/lib/repo";
import { dashboardMetrics } from "@/server/services/reports";
import { formatINRShort } from "@/lib/money";
import { PageHeader } from "@/components/ui";
import { can } from "@/lib/permissions";
import { PeriodPicker } from "./period-picker";
import { todayDateOnly } from "@/lib/dates";
import {
  MetricCard,
  DashSection,
  StockPipeline,
  AlertList,
  ProfitMarginBar,
  ActivityFeed,
  type PipelineStage,
  type AlertRowData,
  type ActivityRow
} from "./dashboard-ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await requireSession();
  const user = session.user;
  const params = await searchParams;
  const to = params.to ?? todayDateOnly();
  const from = params.from ?? new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  const store = getStore();
  let m;
  try {
    m = await dashboardMetrics(store, from, to);
  } catch (err) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <div className="card border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Could not load data: {(err as Error).message}
        </div>
      </div>
    );
  }

  // Same table every other screen already reads (Settings, e.g., reads
  // ImportBatches the same way); this is a read of data every write in the
  // app already produces, not a new business rule.
  const repo = repoFor(store);
  const recentActivity: ActivityRow[] = (await repo.table("ActivityLogs").list())
    .slice()
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, 8)
    .map((r) => ({
      id: r.id,
      summary: r.summary ?? "",
      actorEmail: r.actorEmail ?? "",
      action: r.action ?? "",
      createdAt: r.createdAt ?? ""
    }));

  const stages: PipelineStage[] = [
    { label: "Enquiries", value: m.enquiries, icon: Inbox, href: "/acquisitions", tone: "neutral" },
    { label: "In prep", value: m.inPreparation, icon: Wrench, href: "/inspections", tone: "progress" },
    { label: "Available", value: m.availableStock, icon: Car, href: "/inventory", tone: "positive" },
    { label: "Reserved", value: m.reserved, icon: BookmarkCheck, href: "/sales", tone: "waiting" },
    { label: "Sold", value: m.sold, icon: ShoppingCart, href: "/sales", tone: "done" },
    { label: "Delivered", value: m.delivered, icon: PackageCheck, href: "/sales", tone: "positive" }
  ];

  const alerts: AlertRowData[] = [
    { label: "Overdue follow-ups", count: m.overdueFollowUps, href: "/leads", icon: Clock, severity: "critical" },
    { label: "Open service requests", count: m.openServiceRequests, href: "/aftersale", icon: ClipboardList, severity: "info" },
    { label: "Long-held stock (>90d)", count: m.longHeldCount, href: "/inventory", icon: Timer, severity: "warning" },
    { label: "Work awaiting approval", count: m.awaitingApprovalWork, href: "/inspections", icon: ClipboardCheck, severity: "info" }
  ];

  const showSales = can(user, "sales.view");
  const showProfit = can(user, "profit.view");
  const showSellerBalance = can(user, "purchase.view");
  const showCustomerBalance = can(user, "payment.view");

  return (
    <div className="space-y-4">
      {/* Hero strip — same period label and headline number the plain header
          used to carry, given the visual weight a start-of-day glance needs. */}
      <div className="relative overflow-hidden rounded-2xl bg-ink-950 p-5 sm:p-6">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-brand-600/25 blur-3xl" />
          <div className="absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-brand-800/20 blur-3xl" />
        </div>
        <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              {m.periodLabel} <span className="text-slate-600">·</span> sale dates, IST
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Dashboard
            </h1>
            <div className="mt-3 flex items-baseline gap-2">
              <Wallet className="h-5 w-5 text-brand-400" aria-hidden />
              <span className="tabular font-display text-3xl font-semibold text-white sm:text-4xl">
                {formatINRShort(m.unsoldInvestmentPaise)}
              </span>
              <span className="text-sm text-slate-400">tied up in unsold stock</span>
            </div>
          </div>
          <PeriodPicker from={from} to={to} />
        </div>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard
          label="Unsold investment"
          value={formatINRShort(m.unsoldInvestmentPaise)}
          hint="Purchase + posted pre-sale costs"
          icon={Wallet}
          tone="neutral"
          href="/inventory"
        />
        {showSales ? (
          <MetricCard
            label="Sales value (period)"
            value={formatINRShort(m.salesValuePaise)}
            hint="Final net sale prices"
            icon={TrendingUp}
            tone="brand"
            href="/sales"
          />
        ) : null}
        {showProfit ? (
          <MetricCard
            label="Gross vehicle profit"
            value={formatINRShort(m.grossProfitPaise)}
            hint="Excludes general overhead"
            icon={m.grossProfitPaise >= 0 ? TrendingUp : TrendingDown}
            tone={m.grossProfitPaise >= 0 ? "positive" : "negative"}
            emphasis
          />
        ) : null}
        {showSellerBalance ? (
          <MetricCard
            label="Seller balance due"
            value={formatINRShort(m.sellerOutstandingPaise)}
            icon={Users}
            tone={m.sellerOutstandingPaise > 0 ? "negative" : "neutral"}
            href="/acquisitions"
          />
        ) : null}
        {showCustomerBalance ? (
          <MetricCard
            label="Customer balance due"
            value={formatINRShort(m.customerOutstandingPaise)}
            icon={AlertCircle}
            tone={m.customerOutstandingPaise > 0 ? "negative" : "neutral"}
            href="/sales"
          />
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DashSection title="Stock pipeline" subtitle="Where every car sits today" className="lg:col-span-2">
          <StockPipeline stages={stages} />
        </DashSection>

        <DashSection title="Pending actions" subtitle="Needs a decision or a follow-up">
          <AlertList items={alerts} />
        </DashSection>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {showSales && showProfit ? (
          <DashSection title="Sales performance" subtitle="This period's margin" className="lg:col-span-2">
            <ProfitMarginBar
              salesValuePaise={m.salesValuePaise}
              grossProfitPaise={m.grossProfitPaise}
              formatMoney={formatINRShort}
            />
          </DashSection>
        ) : null}

        <DashSection
          title="Recent activity"
          subtitle="Latest actions across the app"
          className={showSales && showProfit ? "" : "lg:col-span-3"}
          action={<Activity className="h-4 w-4 text-slate-300" aria-hidden />}
        >
          <ActivityFeed items={recentActivity} />
        </DashSection>
      </div>

      <p className="px-1 text-xs leading-relaxed text-slate-500">
        Metric definitions: investment = agreed purchase price + eligible posted repairs + accessories + other showroom
        costs. Gross vehicle profit = final net sale price − pre-sale investment (snapshot at sale time); it is not
        business net profit.
      </p>
    </div>
  );
}
