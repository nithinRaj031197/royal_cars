import Link from "next/link";
import { requireSession } from "@/server/auth";
import { getRepo } from "@/lib/repo";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { saleBalances } from "@/server/services/sales";
import { getStore } from "@/lib/store";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requireSession();
  const { q } = await searchParams;
  const repo = getRepo();
  const [sales, reservations, customers, vehicles] = await Promise.all([
    repo.table("Sales").list(),
    repo.table("Reservations").list(),
    repo.table("Customers").list(),
    repo.table("Vehicles").list()
  ]);
  const query = (q ?? "").toLowerCase();
  const rows = sales.filter((s) => {
    if (!query) return true;
    const c = customers.find((x) => x.id === s.customerId);
    const v = vehicles.find((x) => x.id === s.vehicleId);
    return [s.saleRef, c?.name, c?.phone, v?.stockRef, v?.registrationNumber].some((f) => (f ?? "").toLowerCase().includes(query));
  }).sort((a, b) => (b.saleDate ?? "").localeCompare(a.saleDate ?? ""));

  return (
    <div>
      <PageHeader
        title="Sales & Delivery"
        subtitle="Reservations, sales, payments and delivery checklists"
        actions={
          can(session.user, "sales.manage") ? (
            <div className="flex gap-2">
              <Link className="btn-secondary" href="/sales/new?type=reservation">+ Reservation</Link>
              <Link className="btn-primary" href="/sales/new?type=sale">+ Sale</Link>
            </div>
          ) : undefined
        }
      />

      <form className="mb-3" action="/sales">
        <input name="q" defaultValue={q ?? ""} className="input max-w-xs" placeholder="Search sale ref, customer, stock" aria-label="Search sales" />
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No sales yet" hint="Create a reservation or sale from a Ready for sale vehicle." />
      ) : (
        <div className="card overflow-hidden"><div className="table-scroll">
          <table className="table-base table-sticky-first">
            <thead><tr><th>Sale</th><th>Vehicle</th><th>Customer</th><th>Status</th><th>Price</th><th>Balance</th><th>Sale date</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s) => {
                const c = customers.find((x) => x.id === s.customerId);
                const v = vehicles.find((x) => x.id === s.vehicleId);
                return (
                  <tr key={s.id} className="transition-colors hover:bg-slate-50/80">
                    <td><Link className="text-brand-700 hover:underline" href={`/sales/${s.id}`}>{s.saleRef}</Link></td>
                    <td>{v?.stockRef}<div className="text-xs text-slate-500">{v?.make} {v?.model}</div></td>
                    <td>{c?.name ?? "—"}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>{formatINR(Number(s.finalNetPricePaise ?? 0))}</td>
                    <BalanceCell saleId={s.id} />
                    <td>{formatDate(s.saleDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div></div>
      )}

      <section className="mt-6">
        <h2 className="mb-2 font-semibold">Reservations</h2>
        {reservations.length === 0 ? (
          <p className="text-sm text-slate-500">No reservations.</p>
        ) : (
          <div className="card overflow-hidden"><div className="table-scroll">
            <table className="table-base table-sticky-first">
              <thead><tr><th>Ref</th><th>Vehicle</th><th>Customer</th><th>Status</th><th>Booking</th><th>Expires</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {reservations.map((r) => {
                  const c = customers.find((x) => x.id === r.customerId);
                  const v = vehicles.find((x) => x.id === r.vehicleId);
                  return (
                    <tr key={r.id}>
                      <td>{r.reservationRef}</td>
                      <td>{v?.stockRef ?? "—"}</td>
                      <td>{c?.name ?? "—"}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td>{formatINR(Number(r.bookingAmountPaise ?? 0))}</td>
                      <td>{formatDate(r.expiresOn)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div></div>
        )}
      </section>
    </div>
  );
}

async function BalanceCell({ saleId }: { saleId: string }) {
  const bal = await saleBalances(getStore(), saleId);
  return <td className={bal.balance > 0 ? "text-red-700" : "text-green-700"}>{formatINR(bal.balance)}</td>;
}
