import Link from "next/link";
import { requireSession } from "@/server/auth";
import { getRepo } from "@/lib/repo";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { overdueFollowUps, upcomingFollowUps } from "@/server/services/crm";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const session = await requireSession();
  const repo = getRepo();
  const [leads, customers, vehicles, overdue, upcoming] = await Promise.all([
    repo.table("Leads").list(),
    repo.table("Customers").list(),
    repo.table("Vehicles").list(),
    overdueFollowUps(getStore()),
    upcomingFollowUps(getStore())
  ]);

  return (
    <div>
      <PageHeader
        title="Leads & Customers"
        subtitle="Buyer enquiries, follow-ups and test drives"
        actions={can(session.user, "crm.manage") ? <Link className="btn-primary" href="/leads/new">+ New lead</Link> : undefined}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="min-w-0 lg:col-span-2">
          <h2 className="mb-2 font-semibold">Leads</h2>
          {leads.length === 0 ? (
            <EmptyState title="No leads yet" hint="Create a lead when a buyer enquiry arrives." />
          ) : (
            <div className="card overflow-hidden"><div className="table-scroll">
              <table className="table-base table-sticky-first">
                <thead><tr><th>Ref</th><th>Customer</th><th>Vehicle</th><th>Status</th><th>Budget</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map((l) => {
                    const c = customers.find((x) => x.id === l.customerId);
                    const v = vehicles.find((x) => x.id === l.vehicleId);
                    return (
                      <tr key={l.id} className="transition-colors hover:bg-slate-50/80">
                        <td>{l.leadRef}</td>
                        <td>{c?.name ?? "—"}<div className="text-xs text-slate-500">{c?.phone}</div></td>
                        <td>{v ? `${v.stockRef} — ${v.make} ${v.model}` : "Any"}</td>
                        <td><StatusBadge status={l.status} /></td>
                        <td>{formatINR(Number(l.budgetPaise ?? 0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div></div>
          )}

          <h2 className="mb-2 mt-6 font-semibold">Customers</h2>
          <div className="card overflow-hidden"><div className="table-scroll">
            <table className="table-base table-sticky-first">
              <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>City</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.phone}</td>
                    <td>{c.email || "—"}</td>
                    <td>{(c.address ?? "").split(",")[0] || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>
        </section>

        <aside className="space-y-4">
          <div className="card p-4">
            <h3 className="mb-2 font-semibold text-red-700">Overdue follow-ups ({overdue.length})</h3>
            {overdue.length === 0 ? <p className="text-sm text-slate-500">None.</p> : (
              <ul className="space-y-2 text-sm">
                {overdue.slice(0, 10).map((f) => (
                  <li key={f.id}>
                    <span className="font-medium">{formatDate(f.dueDate)}</span> — {f.note}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card p-4">
            <h3 className="mb-2 font-semibold">Next 7 days ({upcoming.length})</h3>
            {upcoming.length === 0 ? <p className="text-sm text-slate-500">None.</p> : (
              <ul className="space-y-2 text-sm">
                {upcoming.slice(0, 10).map((f) => (
                  <li key={f.id}>
                    <span className="font-medium">{formatDate(f.dueDate)}</span> — {f.note}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
