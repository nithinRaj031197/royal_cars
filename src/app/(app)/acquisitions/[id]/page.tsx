import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/server/auth";
import { getRepo } from "@/lib/repo";
import { can } from "@/lib/permissions";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { PageHeader, StatusBadge } from "@/components/ui";
import { sellerBalance } from "@/server/services/purchases";
import { CaseActions } from "./case-actions";

export const dynamic = "force-dynamic";

export default async function AcquisitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const repo = getRepo();
  const c = await repo.table("AcquisitionCases").get(id);
  if (!c) notFound();
  const [vehicle, seller, inspections, payments] = await Promise.all([
    c.vehicleId ? repo.table("Vehicles").get(c.vehicleId) : Promise.resolve(null),
    c.sellerId ? repo.table("Sellers").get(c.sellerId) : Promise.resolve(null),
    repo.table("Inspections").list({ where: (r) => r.vehicleId === c.vehicleId }),
    repo.table("PurchasePayments").list({ where: (r) => r.acquisitionCaseId === c.id })
  ]);

  const bal = vehicle ? await sellerBalance(repo.store, c.id) : null;
  const showMoney = can(session.user, "purchase.view");

  return (
    <div>
      <PageHeader
        title={c.caseRef ?? id}
        subtitle={`${vehicle?.make ?? ""} ${vehicle?.model ?? ""} ${vehicle?.variant ?? ""} · ${vehicle?.registrationNumber ?? ""}`}
        actions={<StatusBadge status={c.status} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <h2 className="mb-2 font-semibold">Case details</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Seller</dt>
            <dd>{seller?.name ?? "—"} · {seller?.phone}</dd>
            <dt className="text-slate-500">Lead source</dt>
            <dd>{c.leadSource}</dd>
            <dt className="text-slate-500">Expected price</dt>
            <dd>{showMoney ? formatINR(Number(c.expectedPricePaise ?? 0)) : "—"}</dd>
            <dt className="text-slate-500">Offered</dt>
            <dd>{showMoney ? formatINR(Number(c.offeredPricePaise ?? 0)) : "—"}</dd>
            <dt className="text-slate-500">Agreed purchase price</dt>
            <dd>{showMoney ? formatINR(Number(c.agreedPricePaise ?? 0)) : "—"}</dd>
            <dt className="text-slate-500">Assigned to</dt>
            <dd>{c.assignedTo}</dd>
            <dt className="text-slate-500">Follow-up</dt>
            <dd>{formatDate(c.followUpDate)}</dd>
            <dt className="text-slate-500">Inspection appointment</dt>
            <dd>{c.inspectionAppointmentAt ? new Date(c.inspectionAppointmentAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"}</dd>
            <dt className="text-slate-500">Negotiation notes</dt>
            <dd className="whitespace-pre-line">{c.negotiationNotes || "—"}</dd>
            {c.closeReason ? (
              <>
                <dt className="text-slate-500">Close reason</dt>
                <dd className="text-red-700">{c.closeReason}</dd>
              </>
            ) : null}
          </dl>
        </div>

        <div className="space-y-4">
          {can(session.user, "acquisition.manage") ? <CaseActions id={c.id} status={c.status ?? ""} /> : null}

          {vehicle ? (
            <div className="card p-4">
              <h2 className="mb-2 font-semibold">Vehicle</h2>
              <p className="text-sm text-slate-600">{vehicle.stockRef}</p>
              <p className="text-sm">{vehicle.manufactureYear} {vehicle.make} {vehicle.model}</p>
              <p className="text-sm text-slate-600">{vehicle.fuel} · {vehicle.transmission} · {vehicle.odometerKm} km</p>
              <p className="mt-1"><StatusBadge status={vehicle.lifecycleState} /></p>
              <Link className="btn-secondary mt-3 w-full" href={`/inventory/${vehicle.id}`}>Open vehicle workspace</Link>
            </div>
          ) : null}

          {bal && showMoney ? (
            <div className="card p-4">
              <h2 className="mb-2 font-semibold">Seller balance</h2>
              <p className="text-sm text-slate-600">Purchase price</p>
              <p className="font-semibold">{formatINR(bal.purchasePrice)}</p>
              <p className="text-sm text-slate-600">Paid</p>
              <p className="font-semibold">{formatINR(bal.paid)}</p>
              <p className="text-sm text-slate-600">Outstanding</p>
              <p className={`font-semibold ${bal.outstanding > 0 ? "text-red-700" : "text-green-700"}`}>{formatINR(bal.outstanding)}</p>
            </div>
          ) : null}
        </div>
      </div>

      <section className="mt-4">
        <h2 className="mb-2 font-semibold">Inspections for this vehicle</h2>
        {inspections.length === 0 ? (
          <p className="text-sm text-slate-500">No inspections recorded yet.</p>
        ) : (
          <div className="card overflow-hidden"><div className="table-scroll">
            <table className="table-base table-sticky-first">
              <thead><tr><th>Ref</th><th>Type</th><th>Date</th><th>Result</th><th>Est. repair</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {inspections.map((i) => (
                  <tr key={i.id}>
                    <td>{i.inspectionRef}</td>
                    <td>{i.type}</td>
                    <td>{formatDate(i.date)}</td>
                    <td><StatusBadge status={i.overallResult} /></td>
                    <td>{showMoney ? formatINR(Number(i.estimatedRepairPaise ?? 0)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>
        )}
      </section>

      {showMoney ? (
        <section className="mt-4">
          <h2 className="mb-2 font-semibold">Payments to seller</h2>
          {payments.length === 0 ? (
            <p className="text-sm text-slate-500">No payments recorded.</p>
          ) : (
            <div className="card overflow-hidden"><div className="table-scroll">
              <table className="table-base table-sticky-first">
                <thead><tr><th>Ref</th><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.paymentRef}</td>
                      <td>{formatDate(p.date)}</td>
                      <td>{formatINR(Number(p.amountPaise ?? 0))}</td>
                      <td>{p.method}</td>
                      <td>{p.reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div></div>
          )}
        </section>
      ) : null}
    </div>
  );
}
