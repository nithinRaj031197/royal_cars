import { requireSession } from "@/server/auth";
import { getStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { dashboardMetrics, stockAgeing, vehicleReportInternal, customerVehicleProjection } from "@/server/services/reports";

import { getRepo } from "@/lib/repo";
import { formatINR, formatINRShort } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { PageHeader, StatCard } from "@/components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ vehicleId?: string }> }) {
  const session = await requireSession();
  const user = session.user;
  const { vehicleId } = await searchParams;
  const store = getStore();
  const repo = getRepo();

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);
  const metrics = await dashboardMetrics(store, monthStart, todayStr);
  const ageing = await stockAgeing(store);
  const vehicles = await repo.table("Vehicles").list();

  const vehicleOptions = vehicles
    .filter((v) => v.lifecycleState !== "In acquisition pipeline")
    .map((v) => ({ id: v.id, label: `${v.stockRef} — ${v.make} ${v.model}` }));

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle={`Sales period: ${monthStart} → ${todayStr} (this month, IST sale dates)`}
        actions={
          can(user, "report.financial") ? (
            <div className="no-print flex gap-2">
              <a className="btn-secondary" href="/api/reports/export?type=inventory">Export inventory CSV</a>
              <a className="btn-secondary" href="/api/reports/export?type=sales">Export sales CSV</a>
            </div>
          ) : null
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Sales value (month)" value={formatINRShort(metrics.salesValuePaise)} />
        <StatCard label="Gross vehicle profit" value={formatINRShort(metrics.grossProfitPaise)} hint="Not business net profit" />
        <StatCard label="Unsold investment" value={formatINRShort(metrics.unsoldInvestmentPaise)} />
        <StatCard label="Customer outstanding" value={formatINRShort(metrics.customerOutstandingPaise)} />
      </section>

      <h2 className="mb-2 mt-6 font-semibold">Stock ageing</h2>
      <div className="card overflow-hidden"><div className="table-scroll">
        <table className="table-base table-sticky-first">
          <thead><tr><th>Stock</th><th>Vehicle</th><th>Receiving</th><th>Days held</th><th>Asking</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {ageing.slice(0, 20).map((r) => (
              <tr key={r.stockRef} className={r.daysHeld > 90 ? "bg-amber-50" : ""}>
                <td>{r.stockRef}</td>
                <td>{r.make}</td>
                <td>{formatDate(r.receivingDate)}</td>
                <td className={r.daysHeld > 90 ? "font-semibold text-red-700" : ""}>{r.daysHeld}</td>
                <td>{formatINR(r.askingPaise)}</td>
              </tr>
            ))}
            {ageing.length === 0 ? <tr><td colSpan={5} className="text-slate-500">No unsold stock.</td></tr> : null}
          </tbody>
        </table>
      </div></div>

      <h2 className="mb-2 mt-6 font-semibold">Vehicle report</h2>
      <form className="card mb-3 flex flex-wrap items-end gap-2 p-3 no-print" action="/reports">
        <div>
          <label className="label" htmlFor="vehicleId">Vehicle</label>
          <select id="vehicleId" name="vehicleId" className="input min-w-[240px]">
            <option value="">Choose…</option>
            {vehicleOptions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </div>
        <button className="btn-secondary">View internal report</button>
      </form>

      {vehicleId ? <VehicleReport vehicleId={vehicleId} showConfidential={can(user, "purchase.view")} /> : null}
    </div>
  );
}

async function VehicleReport({ vehicleId, showConfidential }: { vehicleId: string; showConfidential: boolean }) {
  const store = getStore();
  const report = await vehicleReportInternal(store, vehicleId);
  const v = report.vehicle;
  const customerCopy = customerVehicleProjection(Object.fromEntries(Object.entries(v).map(([k, val]) => [k, String(val ?? "")])));

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{v.stockRef} — {v.make} {v.model} {v.variant}</h3>
          <p className="text-sm text-slate-600">{v.registrationNumber} · {v.manufactureYear} · {v.fuel} · {v.transmission} · {v.odometerKm} km</p>
        </div>
        <a className="btn-secondary no-print" href={`/api/reports/export?type=vehicle&vehicleId=${vehicleId}`}>CSV</a>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <h4 className="font-medium">Customer-facing copy</h4>
        <p className="mt-0.5 text-sm text-slate-600">
          Shows {customerCopy.title} at {formatINR(Number(customerCopy.askingPricePaise || "0"))} — specification and
          asking price only. Purchase cost, minimum price, investment, margin and seller details are excluded by the
          projection, not merely hidden.
        </p>
        <Link className="btn-secondary mt-2 no-print" href={`/customer/vehicle/${vehicleId}`}>
          Open printable customer sheet
        </Link>
      </div>

      {showConfidential ? (
        <>
          <h4 className="mt-4 font-medium">Internal financials</h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-slate-500">Purchase</dt><dd>{formatINR(report.investment.purchase)}</dd>
            <dt className="text-slate-500">Repairs (posted)</dt><dd>{formatINR(report.investment.repairs)}</dd>
            <dt className="text-slate-500">Accessories</dt><dd>{formatINR(report.investment.accessories)}</dd>
            <dt className="text-slate-500">Other expenses</dt><dd>{formatINR(report.investment.other)}</dd>
            <dt className="text-slate-500">Total investment</dt><dd className="font-semibold">{formatINR(report.investment.total)}</dd>
          </dl>
          <h4 className="mt-4 font-medium">Work orders ({report.work.length})</h4>
          <ul className="text-sm">
            {report.work.map((w) => <li key={w.id}>{w.workOrderRef} · {w.stage} · {w.status} · est {formatINR(Number(w.estimatedPaise ?? 0))} / actual {formatINR(Number(w.actualPaise ?? 0))}</li>)}
          </ul>
        </>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Financial details are hidden for your role.</p>
      )}
      <Link className="btn-secondary mt-4 no-print" href={`/inventory/${vehicleId}`}>Open vehicle workspace</Link>
    </div>
  );
}
