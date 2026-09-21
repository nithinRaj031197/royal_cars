import Link from "next/link";
import { requireSession } from "@/server/auth";
import { getStore } from "@/lib/store";
import { repoFor } from "@/lib/repo";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * Index of the customer-facing documents staff can open, print or hand over.
 *
 * These are still staff-authenticated pages — this phase builds no public site.
 * What makes them "customer view" is the projection: they are rendered from the
 * allowlists in services/reports.ts, so purchase cost, seller identity, minimum
 * price, investment and margin are structurally absent rather than hidden by CSS.
 */
export default async function CustomerViewIndex() {
  await requireSession();
  const repo = repoFor(getStore());
  const [sales, vehicles, customers] = await Promise.all([
    repo.table("Sales").list(),
    repo.table("Vehicles").list(),
    repo.table("Customers").list()
  ]);

  const forSale = vehicles.filter((v) => ["In preparation", "Ready for sale", "Reserved"].includes(v.lifecycleState ?? ""));

  return (
    <div>
      <PageHeader
        title="Customer view"
        subtitle="Printable copies for buyers — no costs, margins or seller details"
      />

      <h2 className="mb-2 mt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Sale &amp; delivery copies</h2>
      {sales.length === 0 ? (
        <EmptyState title="No sales yet" hint="Customer copies appear once a sale is recorded." />
      ) : (
        <div className="card divide-y divide-slate-200">
          {sales.map((s) => {
            const v = vehicles.find((x) => x.id === s.vehicleId);
            const c = customers.find((x) => x.id === s.customerId);
            return (
              <Link
                key={s.id}
                href={`/customer/sale/${s.id}`}
                className="flex items-center justify-between gap-3 p-3 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    {s.saleRef} · {c?.name ?? "—"}
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {v ? `${v.stockRef} ${v.make} ${v.model}` : "—"} · {formatDate(s.saleDate)}
                  </p>
                </div>
                <StatusBadge status={s.status} />
              </Link>
            );
          })}
        </div>
      )}

      <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">Vehicle detail sheets</h2>
      {forSale.length === 0 ? (
        <EmptyState title="No vehicles in stock" hint="Acquire a vehicle to produce a customer detail sheet." />
      ) : (
        <div className="card divide-y divide-slate-200">
          {forSale.map((v) => (
            <Link
              key={v.id}
              href={`/customer/vehicle/${v.id}`}
              className="flex items-center justify-between gap-3 p-3 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">
                  {v.manufactureYear} {v.make} {v.model} {v.variant}
                </p>
                <p className="truncate text-sm text-slate-500">
                  {v.stockRef} · {v.fuel} · {v.transmission} · {v.odometerKm} km
                </p>
              </div>
              <StatusBadge status={v.lifecycleState} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
