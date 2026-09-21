import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/server/auth";
import { getRepo } from "@/lib/repo";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { saleBalances } from "@/server/services/sales";
import { getStore } from "@/lib/store";
import { PageHeader, StatusBadge } from "@/components/ui";
import { PaymentForm, DeliveryPanel, CancelSaleButton } from "./sale-actions";
import { PrintLink } from "./print-link";

export const dynamic = "force-dynamic";

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const repo = getRepo();
  const s = await repo.table("Sales").get(id);
  if (!s) notFound();

  const [vehicle, customer, payments, checklist] = await Promise.all([
    s.vehicleId ? repo.table("Vehicles").get(s.vehicleId) : Promise.resolve(null),
    s.customerId ? repo.table("Customers").get(s.customerId) : Promise.resolve(null),
    repo.table("SalePayments").list({ where: (r) => r.saleId === id }),
    s.deliveryChecklistId ? repo.table("DeliveryChecklists").get(s.deliveryChecklistId) : Promise.resolve(null)
  ]);
  const bal = await saleBalances(getStore(), id);
  const showSnapshot = can(session.user, "profit.view");

  return (
    <div>
      <PageHeader
        title={s.saleRef ?? id}
        subtitle={`${vehicle?.stockRef ?? ""} · ${vehicle?.make ?? ""} ${vehicle?.model ?? ""} · ${customer?.name ?? ""}`}
        actions={<div className="flex items-center gap-2"><StatusBadge status={s.status} /><PrintButton /></div>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card min-w-0 p-4 lg:col-span-2">
          <h2 className="mb-2 font-semibold">Sale</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Final net price</dt><dd className="font-semibold">{formatINR(Number(s.finalNetPricePaise ?? 0))}</dd>
            <dt className="text-slate-500">Sale date</dt><dd>{formatDate(s.saleDate)}</dd>
            <dt className="text-slate-500">Salesperson</dt><dd>{s.salespersonId}</dd>
            <dt className="text-slate-500">Payment terms</dt><dd className="whitespace-pre-line">{s.paymentTerms || "—"}</dd>
            <dt className="text-slate-500">Vehicle</dt>
            <dd>{vehicle ? <Link className="text-brand-700" href={`/inventory/${vehicle.id}`}>{vehicle.stockRef}</Link> : "—"}</dd>
            <dt className="text-slate-500">Customer</dt><dd>{customer?.name} · {customer?.phone}</dd>
          </dl>

          <h3 className="mt-4 font-semibold">Payments ({payments.length})</h3>
          <div className="table-scroll -mx-4 px-4">
          <table className="table-base table-sticky-first mt-1">
            <thead><tr><th>Ref</th><th>Date</th><th>Kind</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.paymentRef}</td>
                  <td>{formatDate(p.date)}</td>
                  <td>{p.kind}</td>
                  <td className={String(p.amountPaise ?? "0").startsWith("-") ? "text-red-700" : ""}>{formatINR(Number(p.amountPaise ?? 0))}</td>
                  <td>{p.method}</td>
                  <td>{p.voidedAt ? <span className="badge bg-red-100 text-red-800">Voided</span> : <span className="badge bg-green-100 text-green-800">Valid</span>}</td>
                </tr>
              ))}
              {payments.length === 0 ? <tr><td colSpan={6} className="text-slate-500">No payments yet.</td></tr> : null}
            </tbody>
          </table>
          </div>
          <p className="mt-2 text-sm">Collected: <span className="font-semibold">{formatINR(bal.paid)}</span> · Balance: <span className={`font-semibold ${bal.balance > 0 ? "text-red-700" : "text-green-700"}`}>{formatINR(bal.balance)}</span></p>

          {showSnapshot && Number(s.snapshotInvestmentPaise ?? "0") > 0 ? (
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-medium">Financial snapshot at sale time</p>
              <p>Investment: {formatINR(Number(s.snapshotInvestmentPaise))} (purchase {formatINR(Number(s.snapshotPurchasePaise))} + repairs {formatINR(Number(s.snapshotRepairsPaise))} + accessories {formatINR(Number(s.snapshotAccessoriesPaise))} + other {formatINR(Number(s.snapshotOtherPaise))})</p>
              <p>Gross vehicle profit: <span className="font-semibold">{formatINR(Number(s.snapshotGrossProfitPaise))}</span> <span className="text-xs text-slate-500">(vehicle-level, excludes overhead)</span></p>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          {can(session.user, "payment.manage") && !["Cancelled", "Completed"].includes(s.status ?? "") ? (
            <PaymentForm saleId={id} balance={bal.balance} />
          ) : null}
          {can(session.user, "delivery.manage") && !checklist && s.status !== "Cancelled" ? (
            <DeliveryPanel saleId={id} balance={bal.balance} vehicleId={s.vehicleId ?? ""} />
          ) : null}
          {checklist ? (
            <div className="card p-4">
              <h3 className="mb-2 font-semibold">Delivery checklist</h3>
              <p className="text-sm">Status: <StatusBadge status={checklist.status} /></p>
              <p className="text-sm">Date: {formatDate(checklist.deliveryDate)}</p>
              <p className="text-sm">Odometer: {checklist.odometerKm} km</p>
              {checklist.exceptionReason ? (
                <p className="mt-1 text-sm text-amber-700">Exception: {checklist.exceptionReason} (approved by {checklist.exceptionApprovedBy})</p>
              ) : null}
            </div>
          ) : null}
          {can(session.user, "sales.manage") && !["Cancelled", "Delivered", "Completed"].includes(s.status ?? "") ? (
            <CancelSaleButton saleId={id} balance={bal.balance} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PrintButton() {
  return <PrintLink />;
}
