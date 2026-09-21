import { requireSession } from "@/server/auth";
import { getStore } from "@/lib/store";
import { dashboardMetrics } from "@/server/services/reports";
import { formatINRShort } from "@/lib/money";
import { PageHeader, StatCard } from "@/components/ui";
import { can } from "@/lib/permissions";
import { PeriodPicker } from "./period-picker";
import { Stagger, StaggerItem } from "@/components/motion";
import { todayDateOnly } from "@/lib/dates";

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

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Sales period ${m.periodLabel} (sale dates, IST)`}
        actions={<PeriodPicker from={from} to={to} />}
      />

      <Stagger label="Stock overview" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StaggerItem className="h-full"><StatCard label="Enquiries" value={String(m.enquiries)} hint="In acquisition pipeline" /></StaggerItem>
        <StaggerItem className="h-full"><StatCard label="In preparation" value={String(m.inPreparation)} /></StaggerItem>
        <StaggerItem className="h-full"><StatCard label="Available stock" value={String(m.availableStock)} hint="Ready for sale" /></StaggerItem>
        <StaggerItem className="h-full"><StatCard label="Reserved" value={String(m.reserved)} /></StaggerItem>
        <StaggerItem className="h-full"><StatCard label="Sold (undelivered)" value={String(m.sold)} /></StaggerItem>
        <StaggerItem className="h-full"><StatCard label="Delivered" value={String(m.delivered)} /></StaggerItem>
      </Stagger>

      <Stagger label="Financials" className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StaggerItem className="h-full"><StatCard label="Unsold investment" value={formatINRShort(m.unsoldInvestmentPaise)} hint="Purchase + posted pre-sale costs" /></StaggerItem>
        {can(user, "sales.view") ? (
          <StaggerItem className="h-full"><StatCard label="Sales value (period)" value={formatINRShort(m.salesValuePaise)} hint="Final net sale prices" /></StaggerItem>
        ) : null}
        {can(user, "profit.view") ? (
          <StatCard
            label="Gross vehicle profit"
            value={formatINRShort(m.grossProfitPaise)}
            tone={m.grossProfitPaise >= 0 ? "positive" : "negative"}
            hint="Excludes general overhead"
          />
        ) : null}
        {can(user, "purchase.view") ? (
          <StaggerItem className="h-full"><StatCard label="Seller balance due" value={formatINRShort(m.sellerOutstandingPaise)} tone="negative" /></StaggerItem>
        ) : null}
        {can(user, "payment.view") ? (
          <StaggerItem className="h-full"><StatCard label="Customer balance due" value={formatINRShort(m.customerOutstandingPaise)} tone="negative" /></StaggerItem>
        ) : null}
      </Stagger>

      <Stagger label="Action items" className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Overdue follow-ups" value={String(m.overdueFollowUps)} tone={m.overdueFollowUps > 0 ? "negative" : "neutral"} />
        <StaggerItem className="h-full"><StatCard label="Open service requests" value={String(m.openServiceRequests)} /></StaggerItem>
        <StatCard label="Long-held stock (>90d)" value={String(m.longHeldCount)} tone={m.longHeldCount > 0 ? "negative" : "neutral"} />
        <StaggerItem className="h-full"><StatCard label="Work awaiting approval" value={String(m.awaitingApprovalWork)} /></StaggerItem>
      </Stagger>

      <p className="mt-6 text-xs text-slate-500">
        Metric definitions: investment = agreed purchase price + eligible posted repairs + accessories + other showroom
        costs. Gross vehicle profit = final net sale price − pre-sale investment (snapshot at sale time); it is not
        business net profit.
      </p>
    </div>
  );
}
