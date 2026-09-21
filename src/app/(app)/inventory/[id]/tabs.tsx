import { getRepo } from "@/lib/repo";
import { formatDate, formatDateTime, todayDateOnly } from "@/lib/dates";
import { Money, StatusBadge } from "@/components/ui";
import { saleBalances } from "@/server/services/sales";
import { getStore } from "@/lib/store";
import { afterSaleCosts } from "@/server/services/work";
import { formatINR } from "@/lib/money";
import Link from "next/link";

export async function MediaTab({ vehicleId }: { vehicleId: string }) {
  const repo = getRepo();
  const [photos, docs] = await Promise.all([
    repo.table("VehiclePhotos").list({ where: (r) => r.vehicleId === vehicleId }),
    repo.table("VehicleDocuments").list({ where: (r) => r.vehicleId === vehicleId })
  ]);
  return (
    <div className="space-y-4">
      <UploadForm vehicleId={vehicleId} />
      <div className="card p-4">
        <h3 className="mb-2 font-semibold">Photos ({photos.length})</h3>
        {photos.length === 0 ? (
          <p className="text-sm text-slate-500">No photos uploaded yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {photos.map((p) => (
              <li key={p.id} className="text-xs">
                <a href={p.url} className="text-brand-700 hover:underline">{p.category}{p.isPrimary === "TRUE" ? " · primary" : ""}</a>
                <p className="text-slate-500">{p.mimeType}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="card p-4">
        <h3 className="mb-2 font-semibold">Documents ({docs.length})</h3>
        {docs.length === 0 ? (
          <p className="text-sm text-slate-500">No documents uploaded yet.</p>
        ) : (
          <ul className="text-sm">
            {docs.map((d) => (
              <li key={d.id}>
                <a href={d.url} className="text-brand-700 hover:underline">{d.title}</a> · {d.type}{d.sensitive === "TRUE" ? " · sensitive" : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function UploadForm({ vehicleId }: { vehicleId: string }) {
  return (
    <form className="card p-4" action={`/api/media/upload?vehicleId=${vehicleId}`} method="post" encType="multipart/form-data">
      <h3 className="mb-2 font-semibold">Upload photo or document</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        <input className="input" type="file" name="file" accept="image/*,.pdf,.doc,.docx" required />
        <select className="input" name="category" aria-label="Category" defaultValue="Gallery">
          {["Gallery", "Inspection", "Document", "Invoice", "Identity"].map((c) => <option key={c}>{c}</option>)}
        </select>
        <button className="btn-primary">Upload</button>
      </div>
      <p className="mt-2 text-xs text-slate-500">Max 15 MB. Photos: JPEG/PNG/WebP/HEIC. Documents: PDF/DOCX. Files stay private in Google Drive; access is via the app.</p>
    </form>
  );
}

export async function PricingTab({ vehicleId }: { vehicleId: string }) {
  const repo = getRepo();
  const v = await repo.table("Vehicles").get(vehicleId);
  const history = await repo.table("PriceHistory").list({ where: (r) => r.vehicleId === vehicleId });
  if (!v) return null;
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h3 className="mb-2 font-semibold">Current prices</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">Initial asking</dt><dd><Money paise={v.askingPricePaise} /></dd>
          <dt className="text-slate-500">Current asking</dt><dd><Money paise={v.currentAskingPaise} /></dd>
          <dt className="text-slate-500">Minimum acceptable</dt><dd><Money paise={v.minimumPricePaise} /></dd>
          <dt className="text-slate-500">Final sale price</dt><dd><Money paise={v.finalSalePricePaise} /></dd>
        </dl>
      </div>
      <PriceChangeForm vehicleId={vehicleId} />
      <div className="card p-4">
        <h3 className="mb-2 font-semibold">Price history (append-only)</h3>
        {history.length === 0 ? <p className="text-sm text-slate-500">No changes recorded.</p> : (
          <ul className="text-sm">
            {history.map((h) => (
              <li key={h.id}>
                {formatDate(h.date)} · {h.kind}: <Money paise={h.previousPaise} /> → <Money paise={h.amountPaise} /> — {h.reason} ({h.setBy})
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PriceChangeForm({ vehicleId }: { vehicleId: string }) {
  return (
    <form className="card space-y-2 p-4" action={`/api/vehicles/${vehicleId}/price`} method="post">
      <h3 className="font-semibold">Record price change</h3>
      <div className="grid gap-2 sm:grid-cols-4">
        <select className="input" name="kind" aria-label="Price kind" defaultValue="Current asking">
          <option>Asking</option><option>Current asking</option><option>Minimum</option>
        </select>
        <input className="input" name="amount" inputMode="decimal" placeholder="₹ amount" aria-label="New amount" required />
        <input className="input" name="date" type="date" aria-label="Date" defaultValue={todayDateOnly()} />
        <input className="input" name="reason" placeholder="Reason" aria-label="Reason" required />
      </div>
      <button className="btn-primary">Save change</button>
    </form>
  );
}

export async function SaleTab({ vehicleId }: { vehicleId: string }) {
  const repo = getRepo();
  const sales = await repo.table("Sales").list({ where: (r) => r.vehicleId === vehicleId });
  const reservations = await repo.table("Reservations").list({ where: (r) => r.vehicleId === vehicleId });
  return (
    <div className="space-y-4">
      {reservations.length > 0 ? (
        <div className="card p-4">
          <h3 className="mb-2 font-semibold">Reservations</h3>
          <ul className="text-sm">
            {reservations.map((r) => (
              <li key={r.id}>{r.reservationRef} · <StatusBadge status={r.status} /> · booking <Money paise={r.bookingAmountPaise} /></li>
            ))}
          </ul>
        </div>
      ) : null}
      {sales.length === 0 ? (
        <p className="text-sm text-slate-500">No sale recorded.</p>
      ) : (
        sales.map((s) => (
          <SaleBlock key={s.id} saleId={s.id} />
        ))
      )}
    </div>
  );
}

async function SaleBlock({ saleId }: { saleId: string }) {
  const repo = getRepo();
  const s = await repo.table("Sales").get(saleId);
  if (!s) return null;
  const customer = s.customerId ? await repo.table("Customers").get(s.customerId) : null;
  const bal = await saleBalances(getStore(), saleId);
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <Link className="font-semibold text-brand-700" href={`/sales/${saleId}`}>{s.saleRef}</Link>
        <StatusBadge status={s.status} />
      </div>
      <p className="text-sm text-slate-600">Customer: {customer?.name ?? "—"}</p>
      <p className="text-sm text-slate-600">Sale date: {formatDate(s.saleDate)} · Delivery: {formatDate(s.deliveryDate)}</p>
      <p className="text-sm">Final net price: <Money paise={s.finalNetPricePaise} /></p>
      <p className="text-sm">Collected: {formatINR(bal.paid)} · Balance: {formatINR(bal.balance)}</p>
    </div>
  );
}

export async function AfterSaleTab({ vehicleId, showCosts }: { vehicleId: string; showCosts: boolean }) {
  const repo = getRepo();
  const [commitments, requests, costs] = await Promise.all([
    repo.table("ServiceCommitments").list({ where: (r) => r.vehicleId === vehicleId }),
    repo.table("ServiceRequests").list({ where: (r) => r.vehicleId === vehicleId }),
    afterSaleCosts(getStore(), vehicleId)
  ]);
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h3 className="mb-2 font-semibold">Service commitments</h3>
        {commitments.length === 0 ? <p className="text-sm text-slate-500">None recorded.</p> : (
          <ul className="text-sm">
            {commitments.map((c) => (
              <li key={c.id}>{c.commitmentRef} · {c.kind} · {c.coverage} · <StatusBadge status={c.status} /></li>
            ))}
          </ul>
        )}
      </div>
      <div className="card p-4">
        <h3 className="mb-2 font-semibold">Service requests</h3>
        {requests.length === 0 ? <p className="text-sm text-slate-500">None recorded.</p> : (
          <ul className="text-sm">
            {requests.map((r) => (
              <li key={r.id}><Link className="text-brand-700" href={`/aftersale/${r.id}`}>{r.requestRef}</Link> · {(r.complaint ?? "").slice(0, 60)} · <StatusBadge status={r.status} /></li>
            ))}
          </ul>
        )}
      </div>
      {showCosts ? (
        <div className="card p-4">
          <h3 className="mb-2 font-semibold">Showroom-funded after-sale costs</h3>
          <p className="text-sm">Work orders: {formatINR(costs.workOrders)}</p>
          <p className="text-sm">Service jobs: {formatINR(costs.serviceJobs)}</p>
          <p className="text-sm font-semibold">Total: {formatINR(costs.total)}</p>
        </div>
      ) : null}
    </div>
  );
}

export async function TimelineTab({ vehicleId }: { vehicleId: string }) {
  const repo = getRepo();
  const [status, activity, inspections] = await Promise.all([
    repo.table("StatusHistory").list({ where: (r) => r.entityId === vehicleId }),
    repo.table("ActivityLogs").list({ where: (r) => r.entityId === vehicleId }),
    repo.table("Inspections").list({ where: (r) => r.vehicleId === vehicleId })
  ]);
  const events = [
    ...status.map((s) => ({ at: s.at ?? "", text: `${s.fromState || "—"} → ${s.toState}${s.reason ? ` (${s.reason})` : ""}`, kind: "Status" })),
    ...activity.map((a) => ({ at: a.createdAt ?? "", text: a.summary ?? "", kind: "Activity" })),
    ...inspections.map((i) => ({ at: i.createdAt ?? "", text: `${i.type} inspection ${i.overallResult}`, kind: "Inspection" }))
  ].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <ol className="space-y-2">
      {events.map((e, idx) => (
        <li key={idx} className="card flex items-baseline gap-3 p-3 text-sm">
          <span className="badge bg-slate-100 text-slate-600">{e.kind}</span>
          <span className="text-slate-500">{formatDateTime(e.at)}</span>
          <span>{e.text}</span>
        </li>
      ))}
      {events.length === 0 ? <p className="text-sm text-slate-500">No history yet.</p> : null}
    </ol>
  );
}
