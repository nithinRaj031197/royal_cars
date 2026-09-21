import Link from "next/link";
import { requireSession } from "@/server/auth";
import { getRepo } from "@/lib/repo";
import { can } from "@/lib/permissions";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { NewEnquiryButton } from "./new-enquiry-button";

export const dynamic = "force-dynamic";

export default async function AcquisitionsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const repo = getRepo();
  const cases = await repo.table("AcquisitionCases").list();
  const [vehicles, sellers] = await Promise.all([repo.table("Vehicles").list(), repo.table("Sellers").list()]);

  const q = (params.q ?? "").toLowerCase();
  const status = params.status ?? "";
  const rows = cases
    .filter((c) => (status ? c.status === status : true))
    .filter((c) => {
      if (!q) return true;
      const v = vehicles.find((x) => x.id === c.vehicleId);
      const s = sellers.find((x) => x.id === c.sellerId);
      return [c.caseRef, v?.stockRef, v?.make, v?.model, v?.registrationNumber, s?.name, s?.phone]
        .some((f) => (f ?? "").toLowerCase().includes(q));
    })
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));

  return (
    <div>
      <PageHeader
        title="Acquisitions"
        subtitle="Seller enquiries and pre-purchase evaluation"
        actions={can(session.user, "acquisition.manage") ? <NewEnquiryButton /> : undefined}
      />

      <form className="mb-3 flex flex-wrap gap-2" action="/acquisitions">
        <input name="q" defaultValue={params.q ?? ""} className="input max-w-xs" placeholder="Search ref, car, seller, phone" aria-label="Search acquisitions" />
        <select name="status" defaultValue={status} className="input max-w-[180px]" aria-label="Filter by status">
          <option value="">All statuses</option>
          {["New enquiry", "Inspection scheduled", "Evaluated", "Negotiating", "Approved", "Acquired", "Rejected", "Cancelled"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button className="btn-secondary">Filter</button>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No enquiries match" hint="Create a new seller enquiry to get started." />
      ) : (
        <div className="card overflow-hidden"><div className="table-scroll">
          <table className="table-base table-sticky-first">
            <thead>
              <tr>
                <th>Case</th><th>Vehicle</th><th>Seller</th><th>Status</th><th>Expected</th><th>Follow-up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => {
                const v = vehicles.find((x) => x.id === c.vehicleId);
                const s = sellers.find((x) => x.id === c.sellerId);
                return (
                  <tr key={c.id} className="transition-colors hover:bg-slate-50/80">
                    <td>
                      <Link className="font-medium text-brand-700 hover:underline" href={`/acquisitions/${c.id}`}>
                        {c.caseRef}
                      </Link>
                      <div className="text-xs text-slate-500">{v?.stockRef}</div>
                    </td>
                    <td>{`${v?.make ?? ""} ${v?.model ?? ""} ${v?.variant ?? ""}`}</td>
                    <td>
                      {s?.name ?? "—"}
                      <div className="text-xs text-slate-500">{s?.phone}</div>
                    </td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>{can(session.user, "purchase.view") ? formatINR(Number(c.expectedPricePaise ?? 0)) : "—"}</td>
                    <td>{formatDate(c.followUpDate)}</td>
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
