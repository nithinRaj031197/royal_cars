import Link from "next/link";
import { requireSession } from "@/server/auth";
import { getRepo } from "@/lib/repo";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InspectionsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requireSession();
  const { q } = await searchParams;
  const repo = getRepo();
  const [inspections, vehicles] = await Promise.all([
    repo.table("Inspections").list(),
    repo.table("Vehicles").list()
  ]);
  const query = (q ?? "").toLowerCase();
  const rows = inspections
    .filter((i) => {
      if (!query) return true;
      const v = vehicles.find((x) => x.id === i.vehicleId);
      return [i.inspectionRef, i.type, v?.stockRef, v?.make, v?.model, v?.registrationNumber]
        .some((f) => (f ?? "").toLowerCase().includes(query));
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  const showMoney = can(session.user, "purchase.view");

  return (
    <div>
      <PageHeader
        title="Inspections & Work"
        subtitle="Pre-purchase, receiving, post-repair, pre-delivery and after-sale inspections"
        actions={<Link className="btn-primary" href="/inspections/new">+ Record inspection</Link>}
      />

      <form className="mb-3" action="/inspections">
        <input name="q" defaultValue={q ?? ""} className="input max-w-xs" placeholder="Search ref, type, vehicle" aria-label="Search inspections" />
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No inspections found" />
      ) : (
        <div className="card overflow-hidden"><div className="table-scroll">
          <table className="table-base table-sticky-first">
            <thead>
              <tr><th>Ref</th><th>Vehicle</th><th>Type</th><th>Date</th><th>Result</th><th>Accident</th><th>Flood</th><th>Est. repair</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((i) => {
                const v = vehicles.find((x) => x.id === i.vehicleId);
                return (
                  <tr key={i.id} className="transition-colors hover:bg-slate-50/80">
                    <td>{i.inspectionRef}</td>
                    <td>
                      <Link className="text-brand-700 hover:underline" href={`/inventory/${i.vehicleId}?tab=inspections`}>
                        {v?.stockRef ?? "—"}
                      </Link>
                      <div className="text-xs text-slate-500">{v?.make} {v?.model}</div>
                    </td>
                    <td>{i.type}</td>
                    <td>{formatDate(i.date)}</td>
                    <td><StatusBadge status={i.overallResult} /></td>
                    <td>{i.accidentHistory}</td>
                    <td>{i.floodHistory}</td>
                    <td>{showMoney ? formatINR(Number(i.estimatedRepairPaise ?? 0)) : "—"}</td>
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
