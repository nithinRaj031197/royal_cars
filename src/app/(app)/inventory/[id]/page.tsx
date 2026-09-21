import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/server/auth";
import { getRepo } from "@/lib/repo";
import { can } from "@/lib/permissions";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { Money, PageHeader, StatusBadge } from "@/components/ui";
import { investmentBreakdown } from "@/server/services/work";
import { getStore } from "@/lib/store";
import { AfterSaleTab, MediaTab, PricingTab, SaleTab, TimelineTab } from "./tabs";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "acquisition", label: "Acquisition" },
  { key: "inspections", label: "Inspections" },
  { key: "work", label: "Work & Costs" },
  { key: "media", label: "Media & Documents" },
  { key: "pricing", label: "Pricing" },
  { key: "sale", label: "Sale & Delivery" },
  { key: "aftersale", label: "After-Sale" },
  { key: "timeline", label: "Timeline" }
];

export default async function VehiclePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireSession();
  const user = session.user;
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  const repo = getRepo();
  const v = await repo.table("Vehicles").get(id);
  if (!v) notFound();

  const showCosts = can(user, "purchase.view");
  const showProfit = can(user, "profit.view");

  // Only what this page itself renders. Each tab fetches its own data when it is
  // the selected one, so listing those tables here was seven full-tab reads per
  // page view whose results were thrown away.
  const [seller, caseRow] = await Promise.all([
    v.sellerId ? repo.table("Sellers").get(v.sellerId) : Promise.resolve(null),
    v.acquisitionCaseId ? repo.table("AcquisitionCases").get(v.acquisitionCaseId) : Promise.resolve(null)
  ]);

  let investment = null;
  if (showCosts) {
    investment = await investmentBreakdown(getStore(), id);
  }

  return (
    <div>
      <PageHeader
        title={`${v.manufactureYear} ${v.make} ${v.model} ${v.variant ?? ""}`.trimEnd()}
        subtitle={`${v.stockRef} · ${v.registrationNumber} · ${v.colour} · ${v.fuel} · ${v.transmission} · ${v.odometerKm} km`}
        actions={<StatusBadge status={v.lifecycleState} />}
      />

      <nav aria-label="Vehicle sections" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <a
            key={t.key}
            href={`/inventory/${id}?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={`whitespace-nowrap px-3 py-2 text-sm font-medium ${
              tab === t.key ? "border-b-2 border-brand-600 text-brand-700" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.label}
          </a>
        ))}
      </nav>

      {tab === "overview" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4">
            <h2 className="mb-2 font-semibold">Specification</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-500">Stock</dt><dd>{v.stockRef}</dd>
              <dt className="text-slate-500">Registration</dt><dd>{v.registrationNumber}</dd>
              <dt className="text-slate-500">VIN/chassis</dt><dd>{v.vin || "—"}</dd>
              <dt className="text-slate-500">Engine</dt><dd>{v.engineNumber || "—"}</dd>
              <dt className="text-slate-500">Manufactured</dt><dd>{v.manufactureYear}</dd>
              <dt className="text-slate-500">Registered</dt><dd>{v.registrationYear} at {v.registrationLocation || "—"}</dd>
              <dt className="text-slate-500">Owners</dt><dd>{v.ownershipCount}</dd>
              <dt className="text-slate-500">Odometer</dt><dd>{v.odometerKm} km</dd>
              <dt className="text-slate-500">Body</dt><dd>{v.bodyType}</dd>
              <dt className="text-slate-500">Showroom location</dt><dd>{v.showroomLocation || "—"}</dd>
              <dt className="text-slate-500">Receiving date</dt><dd>{formatDate(v.receivingDate)}</dd>
              <dt className="text-slate-500">Publication</dt><dd><StatusBadge status={v.publicationState} /></dd>
            </dl>
          </div>
          <div className="card p-4">
            <h2 className="mb-2 font-semibold">Money summary</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-500">Purchase price</dt>
              <dd>{showCosts ? <Money paise={v.purchasePricePaise} /> : "—"}</dd>
              <dt className="text-slate-500">Pre-sale investment</dt>
              <dd>{investment ? formatINR(investment.total) : "—"}</dd>
              <dt className="text-slate-500">Current asking</dt>
              <dd>{can(user, "sales.view") ? <Money paise={v.currentAskingPaise} /> : "—"}</dd>
              <dt className="text-slate-500">Final sale price</dt>
              <dd>{can(user, "sales.view") ? <Money paise={v.finalSalePricePaise} /> : "—"}</dd>
              <dt className="text-slate-500">Acquisition notes</dt>
              <dd className="col-span-2 whitespace-pre-line">{v.acquisitionNotes || "—"}</dd>
            </dl>
          </div>
        </div>
      ) : null}

      {tab === "acquisition" ? (
        <div className="space-y-4">
          {caseRow ? (
            <div className="card p-4">
              <h2 className="mb-2 font-semibold">Acquisition case <Link className="text-brand-700" href={`/acquisitions/${caseRow.id}`}>{caseRow.caseRef}</Link></h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-slate-500">Status</dt><dd><StatusBadge status={caseRow.status} /></dd>
                <dt className="text-slate-500">Seller</dt><dd>{seller?.name ?? "—"} {seller ? `· ${seller.phone}` : ""}</dd>
                <dt className="text-slate-500">Expected price</dt><dd>{showCosts ? <Money paise={caseRow.expectedPricePaise} /> : "—"}</dd>
                <dt className="text-slate-500">Agreed price</dt><dd>{showCosts ? <Money paise={caseRow.agreedPricePaise} /> : "—"}</dd>
                <dt className="text-slate-500">Purchase date</dt><dd>{formatDate(v.purchaseDate)}</dd>
                <dt className="text-slate-500">Purchase price</dt><dd>{showCosts ? <Money paise={v.purchasePricePaise} /> : "—"}</dd>
                <dt className="text-slate-500">Negotiation notes</dt><dd className="whitespace-pre-line">{caseRow.negotiationNotes || "—"}</dd>
                {caseRow.closeReason ? (<><dt className="text-slate-500">Close reason</dt><dd>{caseRow.closeReason}</dd></>) : null}
              </dl>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No acquisition case linked (imported stock?).</p>
          )}
        </div>
      ) : null}

      {tab === "inspections" ? (
        <InspectionsTab vehicleId={id} showCosts={showCosts} />
      ) : null}
      {tab === "work" ? (
        <WorkTab vehicleId={id} showCosts={showCosts} showProfit={showProfit} />
      ) : null}
      {tab === "media" ? (
        <MediaTab vehicleId={id} />
      ) : null}
      {tab === "pricing" ? (
        <PricingTab vehicleId={id} />
      ) : null}
      {tab === "sale" ? (
        <SaleTab vehicleId={id} />
      ) : null}
      {tab === "aftersale" ? (
        <AfterSaleTab vehicleId={id} showCosts={showCosts} />
      ) : null}
      {tab === "timeline" ? (
        <TimelineTab vehicleId={id} />
      ) : null}
    </div>
  );
}

async function InspectionsTab({ vehicleId, showCosts }: { vehicleId: string; showCosts: boolean }) {
  const repo = getRepo();
  const inspections = await repo.table("Inspections").list({ where: (r) => r.vehicleId === vehicleId });
  return (
    <div className="space-y-3">
      <NewInspectionLink vehicleId={vehicleId} />
      {inspections.length === 0 ? (
        <p className="text-sm text-slate-500">No inspections yet.</p>
      ) : (
        inspections.map((i) => (
          <div key={i.id} className="card p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{i.type} · {i.inspectionRef}</p>
              <StatusBadge status={i.overallResult} />
            </div>
            <p className="text-sm text-slate-600">{formatDate(i.date)} · {i.odometerKm} km · by {i.inspectedBy}</p>
            <p className="mt-1 text-sm">Accident history: {i.accidentHistory} · Flood history: {i.floodHistory}</p>
            <p className="text-sm text-slate-600">Est. repair: {showCosts ? formatINR(Number(i.estimatedRepairPaise ?? 0)) : "—"}</p>
            {i.recommendedWork ? <p className="mt-1 text-sm"><span className="font-medium">Recommended:</span> {i.recommendedWork}</p> : null}
          </div>
        ))
      )}
    </div>
  );
}

function NewInspectionLink({ vehicleId }: { vehicleId: string }) {
  return <a className="btn-primary no-print" href={`/inspections/new?vehicleId=${vehicleId}`}>+ Record inspection</a>;
}

async function WorkTab({ vehicleId, showCosts, showProfit }: { vehicleId: string; showCosts: boolean; showProfit: boolean }) {
  const repo = getRepo();
  const [work, accessories, expenses] = await Promise.all([
    repo.table("WorkOrders").list({ where: (r) => r.vehicleId === vehicleId }),
    repo.table("Accessories").list({ where: (r) => r.vehicleId === vehicleId }),
    repo.table("Expenses").list({ where: (r) => r.vehicleId === vehicleId })
  ]);
  const showCosts2 = showCosts || showProfit;
  return (
    <div className="space-y-4">
      <div className="no-print flex gap-2">
        <a className="btn-primary" href={`/work/new?vehicleId=${vehicleId}`}>+ Work order</a>
        <a className="btn-secondary" href={`/work/new?type=accessory&vehicleId=${vehicleId}`}>+ Accessory</a>
        <a className="btn-secondary" href={`/work/new?type=expense&vehicleId=${vehicleId}`}>+ Expense</a>
      </div>
      {work.map((w) => (
        <div key={w.id} className="card p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">{w.workOrderRef} · {w.stage}</p>
            <StatusBadge status={w.status} />
          </div>
          <p className="text-sm">{w.issue}</p>
          <p className="text-sm text-slate-600">{w.category} · vendor {w.vendorId || "—"} · payer {w.payer}</p>
          <p className="text-sm text-slate-600">
            Est: {showCosts2 ? formatINR(Number(w.estimatedPaise ?? 0)) : "—"} ·
            Actual: {showCosts2 ? formatINR(Number(w.actualPaise ?? 0)) : "—"}
          </p>
        </div>
      ))}
      {accessories.length > 0 ? (
        <div className="card p-4">
          <h3 className="mb-2 font-semibold">Accessories</h3>
          <ul className="text-sm">
            {accessories.map((a) => (
              <li key={a.id}>{a.item} × {a.quantity} — {showCosts2 ? formatINR(Number(a.totalPaise ?? 0)) : "—"} {a.workOrderId ? "(in work order invoice)" : ""}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {expenses.length > 0 ? (
        <div className="card p-4">
          <h3 className="mb-2 font-semibold">Other expenses</h3>
          <ul className="text-sm">
            {expenses.map((e) => (
              <li key={e.id}>{formatDate(e.date)} · {e.category} — {showCosts2 ? formatINR(Number(e.amountPaise ?? 0)) : "—"} ({e.payer})</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
