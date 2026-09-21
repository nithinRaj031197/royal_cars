import Link from "next/link";
import { requireSession } from "@/server/auth";
import { getStore } from "@/lib/store";
import { customerSaleDocument } from "@/server/services/reports";
import { formatINR } from "@/lib/money";
import { formatDate, todayDateOnly } from "@/lib/dates";
import { PrintLink } from "@/app/(app)/sales/[id]/print-link";

export const dynamic = "force-dynamic";

/**
 * Customer copy of a sale: what the buyer receives.
 * Rendered entirely from customerSaleDocument()'s allowlist — confidential
 * figures are never fetched into this page, so they cannot leak through markup.
 */
export default async function CustomerSaleCopy({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const doc = await customerSaleDocument(getStore(), id);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 no-print">
        <Link className="btn-secondary" href="/customer">← Customer view</Link>
        <div className="flex gap-2">
          <Link className="btn-secondary" href={`/sales/${id}`}>Open internal sale</Link>
          <PrintLink />
        </div>
      </div>

      <article className="card p-6 print:border-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{doc.showroom.name}</h1>
            <p className="text-sm text-slate-500">
              {[doc.showroom.address, doc.showroom.phone, doc.showroom.email].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">Sale {doc.sale.saleRef}</p>
            <p className="text-sm text-slate-500">{formatDate(doc.sale.saleDate)}</p>
          </div>
        </header>

        <section className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Buyer</h2>
            <p className="mt-1 font-medium text-slate-900">{doc.customer.name || "—"}</p>
            <p className="text-sm text-slate-600">{doc.customer.phone}</p>
            {doc.customer.email ? <p className="text-sm text-slate-600">{doc.customer.email}</p> : null}
            {doc.customer.address ? <p className="text-sm text-slate-600">{doc.customer.address}</p> : null}
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vehicle</h2>
            {doc.vehicle ? (
              <>
                <p className="mt-1 font-medium text-slate-900">
                  {doc.vehicle.manufactureYear} {doc.vehicle.title}
                </p>
                <p className="text-sm text-slate-600">
                  {doc.vehicle.fuel} · {doc.vehicle.transmission} · {doc.vehicle.colour} · {doc.vehicle.odometerKm} km
                </p>
                <p className="text-sm text-slate-600">
                  Reg {doc.vehicleExtras?.registrationNumber || "—"}
                  {doc.vehicleExtras?.vin ? ` · VIN ${doc.vehicleExtras.vin}` : ""}
                </p>
                <p className="text-sm text-slate-600">Owners before you: {doc.vehicle.ownershipCount || "—"}</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-slate-500">—</p>
            )}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payments received</h2>
          <div className="table-scroll -mx-6 px-6">
          <table className="table-base table-sticky-first mt-2">
            <thead>
              <tr><th>Date</th><th>Type</th><th>Method</th><th>Reference</th><th className="text-right">Amount</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {doc.payments.length === 0 ? (
                <tr><td colSpan={5} className="text-slate-500">No payments recorded yet.</td></tr>
              ) : (
                doc.payments.map((p, i) => (
                  <tr key={i} className={p.voided ? "text-slate-400 line-through" : ""}>
                    <td>{formatDate(p.date)}</td>
                    <td>{p.kind}</td>
                    <td>{p.method}</td>
                    <td>{p.reference || "—"}</td>
                    <td className="tabular text-right">{formatINR(p.amountPaise)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>

          <dl className="mt-3 ml-auto grid max-w-xs grid-cols-2 gap-1 text-sm">
            <dt className="text-slate-500">Agreed price</dt>
            <dd className="text-right font-medium">{formatINR(doc.totals.pricePaise)}</dd>
            <dt className="text-slate-500">Paid</dt>
            <dd className="text-right font-medium">{formatINR(doc.totals.paidPaise)}</dd>
            <dt className="font-semibold text-slate-900">Balance due</dt>
            <dd className={`text-right font-semibold ${doc.totals.balancePaise > 0 ? "text-red-700" : "text-green-700"}`}>
              {formatINR(doc.totals.balancePaise)}
            </dd>
          </dl>
        </section>

        {doc.delivery ? (
          <section className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delivery</h2>
            <p className="mt-1 text-sm text-slate-700">
              Delivered {formatDate(doc.delivery.deliveryDate)} at {doc.delivery.odometerKm} km.
            </p>
            {doc.delivery.instructions ? (
              <p className="mt-1 text-sm text-slate-700">{doc.delivery.instructions}</p>
            ) : null}
          </section>
        ) : null}

        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">What we committed to</h2>
          {doc.commitments.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600">
              No service commitment or warranty was agreed for this sale.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {doc.commitments.map((c, i) => (
                <li key={i} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="font-medium text-slate-900">{c.kind}</p>
                  <p className="text-slate-700">{c.coverage}</p>
                  {c.exclusions ? <p className="text-slate-500">Not covered: {c.exclusions}</p> : null}
                  <p className="text-slate-500">
                    {[
                      c.startDate ? `From ${formatDate(c.startDate)}` : "",
                      c.endDate ? `to ${formatDate(c.endDate)}` : "",
                      c.odometerLimit ? `· up to ${c.odometerLimit} km` : "",
                      c.eligibleServices ? `· ${c.servicesUsed || 0}/${c.eligibleServices} services used` : ""
                    ].filter(Boolean).join(" ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {doc.serviceHistory.length > 0 ? (
          <section className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">After-sale service</h2>
            <div className="table-scroll -mx-6 px-6">
            <table className="table-base table-sticky-first mt-2">
              <thead>
                <tr><th>Ref</th><th>Reported</th><th>Complaint</th><th>Coverage</th><th>Status</th><th className="text-right">Your charge</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {doc.serviceHistory.map((r, i) => (
                  <tr key={i}>
                    <td>{r.requestRef}</td>
                    <td>{formatDate(r.reportedDate)}</td>
                    <td className="cell-wrap">{r.complaint}</td>
                    <td>{r.coverageDecision}</td>
                    <td>{r.status}</td>
                    <td className="tabular text-right">{formatINR(r.customerChargePaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </section>
        ) : null}

        <footer className="mt-6 border-t border-slate-200 pt-3 text-xs text-slate-500">
          Customer copy generated {formatDate(todayDateOnly())}. Amounts in INR.
          Please retain this with your vehicle documents.
        </footer>
      </article>
    </div>
  );
}
