import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/server/auth";
import { getRepo } from "@/lib/repo";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { serviceChargeBalance } from "@/server/services/aftersale";
import { getStore } from "@/lib/store";
import { PageHeader, StatusBadge } from "@/components/ui";
import { ServiceRequestActions } from "./actions";

export const dynamic = "force-dynamic";

export default async function ServiceRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const repo = getRepo();
  const sr = await repo.table("ServiceRequests").get(id);
  if (!sr) notFound();

  const [vehicle, customer, jobs, charges] = await Promise.all([
    sr.vehicleId ? repo.table("Vehicles").get(sr.vehicleId) : Promise.resolve(null),
    sr.customerId ? repo.table("Customers").get(sr.customerId) : Promise.resolve(null),
    repo.table("ServiceJobs").list({ where: (r) => r.serviceRequestId === id }),
    repo.table("ServiceCharges").list({ where: (r) => r.serviceRequestId === id })
  ]);
  const bal = await serviceChargeBalance(getStore(), id);
  const showMoney = can(session.user, "purchase.view") || can(session.user, "payment.view");

  return (
    <div>
      <PageHeader
        title={sr.requestRef ?? id}
        subtitle={`${vehicle?.stockRef ?? ""} · ${customer?.name ?? ""} · reported ${formatDate(sr.reportedDate)}`}
        actions={<StatusBadge status={sr.status} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <h2 className="mb-2 font-semibold">Complaint</h2>
          <p className="whitespace-pre-line text-sm">{sr.complaint}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Priority</dt><dd>{sr.priority}</dd>
            <dt className="text-slate-500">Odometer</dt><dd>{sr.odometerKm} km</dd>
            <dt className="text-slate-500">Coverage decision</dt>
            <dd>{sr.coverageDecision}{sr.coverageReason ? ` — ${sr.coverageReason}` : ""}</dd>
            <dt className="text-slate-500">Diagnosis</dt><dd>{sr.diagnosis || "—"}</dd>
            <dt className="text-slate-500">Appointment</dt><dd>{sr.appointmentAt || "—"}</dd>
            <dt className="text-slate-500">Next follow-up</dt><dd>{formatDate(sr.nextFollowUpDate)}</dd>
            <dt className="text-slate-500">Customer acknowledged</dt><dd>{sr.customerAcknowledged === "TRUE" ? "Yes" : "No"}</dd>
          </dl>

          <h3 className="mt-4 font-semibold">Service jobs ({jobs.length})</h3>
          <ul className="text-sm">
            {jobs.map((j) => (
              <li key={j.id} className="mt-1">
                {formatDate(j.date)} — {j.workDone} · parts {formatINR(Number(j.partsPaise ?? 0))} + labour {formatINR(Number(j.labourPaise ?? 0))} = <strong>{formatINR(Number(j.totalPaise ?? 0))}</strong>
              </li>
            ))}
            {jobs.length === 0 ? <li className="text-slate-500">None yet.</li> : null}
          </ul>
        </div>

        <div className="space-y-4">
          {can(session.user, "aftersale.manage") ? <ServiceRequestActions id={id} status={sr.status ?? ""} coverage={sr.coverageDecision ?? "Pending"} /> : null}

          {sr.coverageDecision === "Customer billable" ? (
            <div className="card p-4">
              <h3 className="font-semibold">Customer charges</h3>
              <p className="mt-1 text-sm">Approved charge: {formatINR(bal.chargeable)}</p>
              <p className="text-sm">Collected: {formatINR(bal.collected)}</p>
              <p className={`text-sm font-semibold ${bal.due > 0 ? "text-red-700" : "text-green-700"}`}>Due: {formatINR(bal.due)}</p>
              {showMoney && charges.length > 0 ? (
                <ul className="mt-2 text-xs text-slate-600">
                  {charges.map((c) => <li key={c.id}>{c.chargeRef} · {formatINR(Number(c.amountPaise ?? 0))} · {c.method}</li>)}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Vehicle: {vehicle ? <Link className="text-brand-700" href={`/inventory/${vehicle.id}?tab=aftersale`}>{vehicle.stockRef}</Link> : "—"} · After-sale work never changes inventory state.
      </p>
    </div>
  );
}
