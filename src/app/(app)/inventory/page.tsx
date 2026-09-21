import Link from "next/link";
import { requireSession } from "@/server/auth";
import { getRepo } from "@/lib/repo";
import { can } from "@/lib/permissions";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATES = ["In preparation", "Ready for sale", "Reserved", "Sold", "Delivered", "Archived"];

export default async function InventoryPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; state?: string; fuel?: string; transmission?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const repo = getRepo();
  // Owned inventory only: exclude vehicles still in the acquisition pipeline.
  let rows = (await repo.table("Vehicles").list()).filter((v) => v.lifecycleState !== "In acquisition pipeline");

  const q = (params.q ?? "").toLowerCase();
  if (q) {
    rows = rows.filter((v) =>
      [v.stockRef, v.registrationNumber, v.vin, v.engineNumber, v.make, v.model, v.variant]
        .some((f) => (f ?? "").toLowerCase().includes(q))
    );
  }
  if (params.state) rows = rows.filter((v) => v.lifecycleState === params.state);
  if (params.fuel) rows = rows.filter((v) => v.fuel === params.fuel);
  if (params.transmission) rows = rows.filter((v) => v.transmission === params.transmission);

  rows.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Owned vehicles — from receiving to delivery" />

      <form className="mb-3 flex flex-wrap items-end gap-2" action="/inventory">
        <div>
          <label className="label" htmlFor="q">Search</label>
          <input id="q" name="q" defaultValue={params.q ?? ""} className="input w-64" placeholder="Stock, reg, VIN, make/model" />
        </div>
        <div>
          <label className="label" htmlFor="state">Lifecycle</label>
          <select id="state" name="state" defaultValue={params.state ?? ""} className="input w-44">
            <option value="">All states</option>
            {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="fuel">Fuel</label>
          <select id="fuel" name="fuel" defaultValue={params.fuel ?? ""} className="input w-32">
            <option value="">All</option>
            {["Petrol", "Diesel", "CNG", "Electric", "Hybrid"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="transmission">Transmission</label>
          <select id="transmission" name="transmission" defaultValue={params.transmission ?? ""} className="input w-36">
            <option value="">All</option>
            {["Manual", "Automatic"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button className="btn-secondary">Apply</button>
        <Link href="/inventory" className="btn-secondary">Reset</Link>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No vehicles found" hint="Try clearing filters, or add stock via Acquisitions → mark acquired." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.slice(0, 60).map((v) => (
            <Link key={v.id} href={`/inventory/${v.id}`} className="card block p-4 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-slate-500">{v.stockRef}</p>
                  <p className="font-semibold">{v.manufactureYear} {v.make} {v.model}</p>
                  <p className="text-sm text-slate-600">{v.variant}</p>
                </div>
                <StatusBadge status={v.lifecycleState} />
              </div>
              <p className="mt-2 text-sm text-slate-600">{v.fuel} · {v.transmission} · {v.odometerKm} km</p>
              <p className="text-sm text-slate-600">{v.registrationNumber} · {formatDate(v.receivingDate)}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-semibold">
                  {can(session.user, "sales.view") ? formatINR(Number(v.currentAskingPaise ?? 0)) : ""}
                </span>
                <span className="text-xs text-brand-700">Open →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">Showing {Math.min(rows.length, 60)} of {rows.length} vehicles.</p>
    </div>
  );
}
