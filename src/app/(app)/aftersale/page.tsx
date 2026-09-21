import Link from "next/link";
import { requireSession } from "@/server/auth";
import { getRepo } from "@/lib/repo";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/dates";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AfterSalePage() {
  const session = await requireSession();
  const repo = getRepo();
  const [requests, sales, vehicles] = await Promise.all([
    repo.table("ServiceRequests").list(),
    repo.table("Sales").list(),
    repo.table("Vehicles").list()
  ]);
  const rows = requests.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));

  return (
    <div>
      <PageHeader
        title="After-Sale Service"
        subtitle="Commitments, complaints, repairs and coverage decisions"
        actions={can(session.user, "aftersale.manage") ? <Link className="btn-primary" href="/aftersale/new">+ Service request</Link> : undefined}
      />

      {rows.length === 0 ? (
        <EmptyState title="No service requests" hint="Raise one from a delivered sale." />
      ) : (
        <div className="card overflow-hidden"><div className="table-scroll">
          <table className="table-base table-sticky-first">
            <thead><tr><th>Ref</th><th>Vehicle</th><th>Complaint</th><th>Reported</th><th>Coverage</th><th>Status</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const v = vehicles.find((x) => x.id === r.vehicleId);
                const sale = sales.find((x) => x.id === r.saleId);
                return (
                  <tr key={r.id} className="transition-colors hover:bg-slate-50/80">
                    <td><Link className="text-brand-700 hover:underline" href={`/aftersale/${r.id}`}>{r.requestRef}</Link></td>
                    <td>{v?.stockRef ?? "—"}<div className="text-xs text-slate-500">Sale {sale?.saleRef}</div></td>
                    <td className="cell-wrap">{(r.complaint ?? "").slice(0, 60)}</td>
                    <td>{formatDate(r.reportedDate)}</td>
                    <td>{r.coverageDecision}</td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div></div>
      )}
    </div>
  );
}
