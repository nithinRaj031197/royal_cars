import Link from "next/link";
import { requireSession } from "@/server/auth";
import { getStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { carMoneyTrail } from "@/server/services/ledger";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

function Row({ label, value, muted, strong, tone }: { label: string; value: string; muted?: boolean; strong?: boolean; tone?: "good" | "bad" }) {
  const toneClass = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : "text-slate-900";
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className={`text-sm ${muted ? "text-slate-500" : "text-slate-600"}`}>{label}</span>
      <span className={`tabular text-sm ${strong ? "font-semibold" : ""} ${muted ? "text-slate-500" : toneClass}`}>{value}</span>
    </div>
  );
}

/** One step in the car's journey. */
function Stage({ step, title, caption, children, total, totalLabel }: {
  step: string; title: string; caption?: string; children: React.ReactNode; total?: string; totalLabel?: string;
}) {
  return (
    <section className="relative pl-10 sm:pl-12">
      <span className="absolute left-0 top-0 grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white ring-4 ring-white">
        {step}
      </span>
      <span className="absolute left-4 top-9 -ml-px h-[calc(100%-1.25rem)] w-0.5 bg-slate-200 last:hidden" aria-hidden />
      <div className="pb-8">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {caption ? <p className="mb-2 text-sm text-slate-500">{caption}</p> : null}
        <div className="card mt-2 p-4">
          {children}
          {total ? (
            <div className="mt-3 flex items-baseline justify-between border-t border-slate-200 pt-3">
              <span className="text-sm font-medium text-slate-700">{totalLabel}</span>
              <span className="tabular text-lg font-semibold text-slate-900">{total}</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default async function MoneyTrailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const user = session.user;
  const { id } = await params;

  if (!can(user, "purchase.view")) {
    return (
      <div>
        <PageHeader title="Car money trail" />
        <EmptyState title="Not available for your role" hint="This view shows purchase cost and margin." />
      </div>
    );
  }

  const showProfit = can(user, "profit.view");
  const t = await carMoneyTrail(getStore(), id);

  return (
    <div>
      <PageHeader
        title={t.vehicle.title || t.vehicle.stockRef}
        subtitle={`${t.vehicle.stockRef} · ${t.vehicle.registration} — every rupee, seller to customer`}
        actions={
          <>
            <Link className="btn-secondary" href="/ledger">← All cars</Link>
            <Link className="btn-secondary" href={`/inventory/${t.vehicle.id}`}>Open workspace</Link>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge status={t.vehicle.state} />
        {/* The sale's own status only adds information when it differs. */}
        {t.sale && t.sale.status !== t.vehicle.state ? <StatusBadge status={t.sale.status} /> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <Stage
            step="1"
            title="Seller → Showroom"
            caption={t.seller ? `Bought from ${t.seller.name}${t.seller.phone ? ` · ${t.seller.phone}` : ""}` : "Purchase"}
            total={formatINR(t.purchase.agreedPaise)}
            totalLabel="Agreed purchase price"
          >
            {t.purchase.payments.length === 0 ? (
              <p className="text-sm text-slate-500">No payments recorded to the seller yet.</p>
            ) : (
              t.purchase.payments.map((p, i) => (
                <Row
                  key={i}
                  label={`${formatDate(p.date)} · ${p.method}${p.reference ? ` · ${p.reference}` : ""}`}
                  value={formatINR(p.amountPaise)}
                />
              ))
            )}
            <div className="mt-2 border-t border-slate-100 pt-2">
              <Row label="Paid so far" value={formatINR(t.purchase.paidPaise)} />
              <Row
                label="Still owed to seller"
                value={formatINR(t.purchase.outstandingPaise)}
                tone={t.purchase.outstandingPaise > 0 ? "bad" : "good"}
                strong
              />
            </div>
          </Stage>

          <Stage
            step="2"
            title="In the showroom"
            caption="Repairs, accessories and other costs while we owned it"
            total={formatINR(t.preparation.totalPaise)}
            totalLabel="Spent preparing it"
          >
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Work orders</p>
            {t.preparation.workOrders.length === 0 ? (
              <p className="pb-2 text-sm text-slate-500">No work orders.</p>
            ) : (
              t.preparation.workOrders.map((w, i) => {
                const counted = w.status === "Completed";
                return (
                  <Row
                    key={i}
                    label={`${w.ref} · ${w.issue || w.stage}${counted ? "" : ` (${w.status} — not counted)`}`}
                    value={formatINR(w.actualPaise)}
                    muted={!counted}
                  />
                );
              })
            )}

            <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Accessories</p>
            {t.preparation.accessories.length === 0 ? (
              <p className="pb-2 text-sm text-slate-500">None.</p>
            ) : (
              t.preparation.accessories.map((a, i) => (
                <Row
                  key={i}
                  label={`${a.item}${a.inWorkOrder ? " (billed inside a work order — not counted again)" : ""}`}
                  value={formatINR(a.totalPaise)}
                  muted={a.inWorkOrder}
                />
              ))
            )}

            <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Other expenses</p>
            {t.preparation.expenses.length === 0 ? (
              <p className="text-sm text-slate-500">None.</p>
            ) : (
              t.preparation.expenses.map((e, i) => (
                <Row
                  key={i}
                  label={`${formatDate(e.date)} · ${e.category}${e.counted ? "" : ` (paid by ${e.payer} — not a showroom cost)`}`}
                  value={formatINR(e.amountPaise)}
                  muted={!e.counted}
                />
              ))
            )}
          </Stage>

          <Stage
            step="3"
            title="Showroom → Customer"
            caption={t.sale?.customer ? `Sold to ${t.sale.customer.name} · ${t.sale.customer.phone}` : "Not sold yet"}
            total={t.sale ? formatINR(t.sale.pricePaise) : undefined}
            totalLabel="Final sale price"
          >
            {!t.sale ? (
              <p className="text-sm text-slate-500">
                Not sold yet. Current asking price {formatINR(t.vehicle.askingPaise)}.
              </p>
            ) : (
              <>
                <Row label={`Sale ${t.sale.saleRef} · ${formatDate(t.sale.date)}`} value={formatINR(t.sale.pricePaise)} />
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Customer payments</p>
                  {t.sale.payments.length === 0 ? (
                    <p className="text-sm text-slate-500">Nothing received yet.</p>
                  ) : (
                    t.sale.payments.map((p, i) => (
                      <Row
                        key={i}
                        label={`${formatDate(p.date)} · ${p.kind} · ${p.method}${p.voided ? " (voided)" : ""}`}
                        value={formatINR(p.amountPaise)}
                        muted={p.voided}
                      />
                    ))
                  )}
                  <Row label="Received" value={formatINR(t.sale.receivedPaise)} />
                  <Row
                    label="Still owed by customer"
                    value={formatINR(t.sale.outstandingPaise)}
                    tone={t.sale.outstandingPaise > 0 ? "bad" : "good"}
                    strong
                  />
                </div>
              </>
            )}
          </Stage>

          <Stage step="4" title="After the sale" caption="Service we funded, and anything the customer was billed">
            <Row label="Showroom-funded service work" value={formatINR(t.afterSale.showroomCostPaise)} />
            <Row label="Charged to the customer" value={formatINR(t.afterSale.customerChargedPaise)} muted />
            <Row label="Collected from the customer" value={formatINR(t.afterSale.customerPaidPaise)} muted />
            <Row
              label="Service balance owed by customer"
              value={formatINR(t.afterSale.customerOutstandingPaise)}
              tone={t.afterSale.customerOutstandingPaise > 0 ? "bad" : undefined}
            />
            <p className="mt-2 text-xs text-slate-500">
              Service money is tracked separately from the car sale — it never changes the sale balance.
            </p>
          </Stage>
        </div>

        {/* Summary rail */}
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-slate-900">Where the money went</h2>
            <div className="mt-3 space-y-0.5">
              <Row label="Paid for the car" value={formatINR(t.purchase.agreedPaise)} />
              <Row label="Repairs" value={formatINR(t.preparation.repairsPaise)} />
              <Row label="Accessories" value={formatINR(t.preparation.accessoriesPaise)} />
              <Row label="Other costs" value={formatINR(t.preparation.otherPaise)} />
              <div className="my-2 border-t border-slate-200" />
              <Row label="Total invested" value={formatINR(t.investmentPaise)} strong />
              <div className="my-2 border-t border-slate-200" />
              <Row label="Sold for" value={t.sale ? formatINR(t.sale.pricePaise) : "—"} />
              {showProfit ? (
                <>
                  <Row
                    label="Gross vehicle profit"
                    value={t.result.sold ? formatINR(t.result.grossProfitPaise) : "—"}
                    tone={t.result.sold ? (t.result.grossProfitPaise >= 0 ? "good" : "bad") : undefined}
                  />
                  <Row label="Less after-sale work" value={`−${formatINR(t.afterSale.showroomCostPaise)}`} muted />
                  <Row
                    label="Contribution"
                    value={t.result.sold ? formatINR(t.result.contributionPaise) : "—"}
                    tone={t.result.sold ? (t.result.contributionPaise >= 0 ? "good" : "bad") : undefined}
                    strong
                  />
                </>
              ) : null}
            </div>
            {showProfit ? (
              <p className="mt-3 border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-500">
                Per-car figure. It excludes rent, salaries and other general overhead, so it is not the
                business&rsquo;s net profit.
              </p>
            ) : null}
          </div>

          <div className="card mt-4 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Outstanding both ways</h2>
            <div className="mt-2">
              <Row
                label="We owe the seller"
                value={formatINR(t.purchase.outstandingPaise)}
                tone={t.purchase.outstandingPaise > 0 ? "bad" : "good"}
              />
              <Row
                label="Customer owes us"
                value={t.sale ? formatINR(t.sale.outstandingPaise) : "—"}
                tone={(t.sale?.outstandingPaise ?? 0) > 0 ? "bad" : "good"}
              />
              <Row
                label="Customer owes for service"
                value={formatINR(t.afterSale.customerOutstandingPaise)}
                tone={t.afterSale.customerOutstandingPaise > 0 ? "bad" : "good"}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
