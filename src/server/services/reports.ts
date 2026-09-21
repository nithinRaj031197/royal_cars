import { getRepo, repoFor } from "@/lib/repo";
import { DataStore } from "@/lib/store/types";
import { toCsv } from "@/lib/csv";
import { sumPaise } from "@/lib/money";
import { todayDateOnly } from "@/lib/dates";
import { investmentBreakdown } from "./work";
import { saleBalances } from "./sales";

export interface DashboardMetrics {
  enquiries: number;
  availableStock: number;
  inPreparation: number;
  reserved: number;
  sold: number;
  delivered: number;
  unsoldInvestmentPaise: number;
  salesValuePaise: number;
  grossProfitPaise: number;
  afterSaleCostsPaise: number;
  customerOutstandingPaise: number;
  sellerOutstandingPaise: number;
  overdueFollowUps: number;
  openServiceRequests: number;
  longHeldCount: number;
  awaitingApprovalWork: number;
  periodLabel: string;
}

export async function sellerOutstanding(repo: ReturnType<typeof getRepo>, vehicleId: string) {
  const v = await repo.table("Vehicles").get(vehicleId);
  if (!v) return 0;
  const caseId = v.acquisitionCaseId ?? "";
  const payments = (await repo.table("PurchasePayments").list()).filter(
    (p) => p.acquisitionCaseId === caseId && p.amountPaise && Number(p.amountPaise) > 0
  );
  const paid = sumPaise(payments.map((p) => Number(p.amountPaise ?? "0")));
  const price = Number(v.purchasePricePaise ?? "0");
  return { purchase: price, paid, outstanding: price - paid };
}

export async function customerOutstandingAll(store: DataStore): Promise<number> {
  const repo = repoFor(store);
  const sales = (await repo.table("Sales").list()).filter((s) => ["Booked", "Part paid", "Fully paid", "Delivered"].includes(s.status ?? ""));
  let total = 0;
  for (const s of sales) {
    const payments = (await repo.table("SalePayments").list()).filter((p) => p.saleId === s.id && !p.voidedAt);
    const paid = sumPaise(payments.map((p) => Number(p.amountPaise ?? "0")));
    total += Math.max(0, Number(s.finalNetPricePaise ?? "0") - paid);
  }
  return total;
}

export async function sellerOutstandingAll(store: DataStore): Promise<number> {
  const repo = repoFor(store);
  const vehicles = (await repo.table("Vehicles").list()).filter((v) => v.lifecycleState !== "In acquisition pipeline" && !v.archived);
  let total = 0;
  for (const v of vehicles) {
    const caseId = v.acquisitionCaseId ?? "";
    if (!caseId) continue;
    const payments = (await repo.table("PurchasePayments").list()).filter((p) => p.acquisitionCaseId === caseId);
    const paid = sumPaise(payments.map((p) => Number(p.amountPaise ?? "0")));
    total += Math.max(0, Number(v.purchasePricePaise ?? "0") - paid);
  }
  return total;
}

export async function dashboardMetrics(store: DataStore, fromDate: string, toDate: string): Promise<DashboardMetrics> {
  const repo = repoFor(store);
  const vehicles = await repo.table("Vehicles").list();
  const sales = await repo.table("Sales").list();
  const periodSales = sales.filter((s) => (s.saleDate ?? "") >= fromDate && (s.saleDate ?? "") <= toDate && s.status !== "Cancelled");

  let grossProfit = 0;
  let salesValue = 0;
  for (const s of periodSales) {
    salesValue += Number(s.finalNetPricePaise ?? "0");
    grossProfit += Number(s.finalNetPricePaise ?? "0") - Number(s.snapshotInvestmentPaise ?? "0") || 0;
  }

  const followUps = await repo.table("FollowUps").list();
  const today = todayDateOnly();
  const overdue = followUps.filter((f) => f.status === "Open" && f.dueDate && f.dueDate < today).length;

  const serviceRequests = await repo.table("ServiceRequests").list();
  const openSR = serviceRequests.filter((s) => !["Closed", "Cancelled"].includes(s.status ?? "")).length;

  const work = await repo.table("WorkOrders").list();
  const awaiting = work.filter((w) => w.status === "Draft" || w.status === "Approved").length;

  const unsold = vehicles.filter((v) => ["In preparation", "Ready for sale"].includes(v.lifecycleState ?? ""));
  let unsoldInvestment = 0;
  for (const v of unsold) {
    const inv = await investmentBreakdown(store, v.id);
    unsoldInvestment += inv.total;
  }

  const longHeld = unsold.filter((v) => {
    const d = v.receivingDate ?? "";
    if (!d) return false;
    return (Date.now() - new Date(`${d}T00:00:00Z`).getTime()) / 86_400_000 > 90;
  }).length;

  return {
    enquiries: vehicles.filter((v) => v.lifecycleState === "In acquisition pipeline").length,
    availableStock: vehicles.filter((v) => v.lifecycleState === "Ready for sale").length,
    inPreparation: vehicles.filter((v) => v.lifecycleState === "In preparation").length,
    reserved: vehicles.filter((v) => v.lifecycleState === "Reserved").length,
    sold: sales.filter((s) => ["Booked", "Part paid", "Fully paid"].includes(s.status ?? "")).length,
    delivered: vehicles.filter((v) => v.lifecycleState === "Delivered").length,
    unsoldInvestmentPaise: unsoldInvestment,
    salesValuePaise: salesValue,
    grossProfitPaise: grossProfit,
    afterSaleCostsPaise: 0,
    customerOutstandingPaise: await customerOutstandingAll(store),
    sellerOutstandingPaise: await sellerOutstandingAll(store),
    overdueFollowUps: overdue,
    openServiceRequests: openSR,
    longHeldCount: longHeld,
    awaitingApprovalWork: awaiting,
    periodLabel: `${fromDate} → ${toDate}`
  };
}

/** Stock ageing report. */
export async function stockAgeing(store: DataStore) {
  const repo = repoFor(store);
  const vehicles = (await repo.table("Vehicles").list()).filter(
    (v) => ["In preparation", "Ready for sale"].includes(v.lifecycleState ?? "")
  );
  return vehicles
    .map((v) => ({
      stockRef: v.stockRef ?? "",
      make: `${v.make ?? ""} ${v.model ?? ""}`.trim(),
      receivingDate: v.receivingDate ?? "",
      daysHeld: v.receivingDate ? Math.floor((Date.now() - new Date(`${v.receivingDate}T00:00:00Z`).getTime()) / 86_400_000) : 0,
      investmentPaise: 0,
      askingPaise: Number(v.currentAskingPaise ?? "0")
    }))
    .sort((a, b) => b.daysHeld - a.daysHeld);
}

/** Internal vehicle report: full confidential detail. */
export async function vehicleReportInternal(store: DataStore, vehicleId: string) {
  const repo = repoFor(store);
  const v = await repo.table("Vehicles").get(vehicleId);
  if (!v) throw Object.assign(new Error("Vehicle not found"), { status: 404 });
  const [seller, acqCase, inspections, work, photos, docs, priceHistory] = await Promise.all([
    v.sellerId ? repo.table("Sellers").get(v.sellerId) : Promise.resolve(null),
    v.acquisitionCaseId ? repo.table("AcquisitionCases").get(v.acquisitionCaseId) : Promise.resolve(null),
    repo.table("Inspections").list({ where: (r) => r.vehicleId === vehicleId }),
    repo.table("WorkOrders").list({ where: (r) => r.vehicleId === vehicleId }),
    repo.table("VehiclePhotos").list({ where: (r) => r.vehicleId === vehicleId }),
    repo.table("VehicleDocuments").list({ where: (r) => r.vehicleId === vehicleId }),
    repo.table("PriceHistory").list({ where: (r) => r.vehicleId === vehicleId })
  ]);
  const investment = await investmentBreakdown(store, vehicleId);
  return { vehicle: v, seller, acqCase, inspections, work, photos, docs, priceHistory, investment };
}

/**
 * Customer-facing projection: excludes purchase cost, seller identity,
 * minimum price, investment and profit. Explicit allowlist, not omission.
 */
export function customerVehicleProjection(v: Record<string, string>) {
  return {
    stockRef: v.stockRef ?? "",
    title: `${v.make ?? ""} ${v.model ?? ""} ${v.variant ?? ""}`.trim(),
    make: v.make ?? "",
    model: v.model ?? "",
    variant: v.variant ?? "",
    manufactureYear: v.manufactureYear ?? "",
    registrationYear: v.registrationYear ?? "",
    fuel: v.fuel ?? "",
    transmission: v.transmission ?? "",
    bodyType: v.bodyType ?? "",
    colour: v.colour ?? "",
    ownershipCount: v.ownershipCount ?? "",
    odometerKm: v.odometerKm ?? "",
    registrationLocation: v.registrationLocation ?? "",
    askingPricePaise: v.currentAskingPaise ?? "0",
    publicationState: v.publicationState ?? ""
  };
}

/**
 * Customer-facing sale document.
 *
 * Built from an explicit allowlist, exactly like customerVehicleProjection:
 * the customer copy carries what the buyer is entitled to see (their own
 * details, what they bought, what they paid, what was promised) and never the
 * purchase price, seller identity, minimum price, investment or margin.
 *
 * Payments are listed individually so the figures can be reconciled; voided
 * payments are excluded from the balance but shown as voided so a customer
 * copy cannot silently differ from the internal ledger.
 */
export async function customerSaleDocument(store: DataStore, saleId: string) {
  const repo = repoFor(store);
  const sale = await repo.table("Sales").get(saleId);
  if (!sale) throw Object.assign(new Error("Sale not found"), { status: 404 });

  const [vehicle, customer, payments, checklist, commitments, serviceRequests, settings] = await Promise.all([
    sale.vehicleId ? repo.table("Vehicles").get(sale.vehicleId) : Promise.resolve(null),
    sale.customerId ? repo.table("Customers").get(sale.customerId) : Promise.resolve(null),
    repo.table("SalePayments").list({ where: (r) => r.saleId === saleId }),
    sale.deliveryChecklistId ? repo.table("DeliveryChecklists").get(sale.deliveryChecklistId) : Promise.resolve(null),
    repo.table("ServiceCommitments").list({ where: (r) => r.saleId === saleId }),
    repo.table("ServiceRequests").list({ where: (r) => r.saleId === saleId }),
    repo.settings()
  ]);

  const balances = await saleBalances(store, saleId);

  return {
    showroom: {
      name: settings["showroom:showroomName"] ?? "Showroom",
      phone: settings["showroom:phone"] ?? "",
      email: settings["showroom:email"] ?? "",
      address: settings["showroom:address"] ?? ""
    },
    sale: {
      saleRef: sale.saleRef ?? "",
      saleDate: sale.saleDate ?? "",
      deliveryDate: sale.deliveryDate ?? "",
      status: sale.status ?? "",
      paymentTerms: sale.paymentTerms ?? "",
      finalNetPricePaise: Number(sale.finalNetPricePaise ?? "0")
    },
    customer: {
      name: customer?.name ?? "",
      phone: customer?.phone ?? "",
      email: customer?.email ?? "",
      address: customer?.address ?? ""
    },
    vehicle: vehicle ? customerVehicleProjection(asStrings(vehicle)) : null,
    vehicleExtras: vehicle
      ? { registrationNumber: vehicle.registrationNumber ?? "", vin: vehicle.vin ?? "" }
      : null,
    payments: payments
      .slice()
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
      .map((p) => ({
        date: p.date ?? "",
        kind: p.kind ?? "",
        method: p.method ?? "",
        reference: p.reference ?? "",
        amountPaise: Number(p.amountPaise ?? "0"),
        voided: Boolean(p.voidedAt)
      })),
    totals: { pricePaise: balances.price, paidPaise: balances.paid, balancePaise: balances.balance },
    delivery: checklist
      ? {
          deliveryDate: checklist.deliveryDate ?? "",
          odometerKm: checklist.odometerKm ?? "",
          instructions: checklist.instructions ?? "",
          acknowledgedAt: checklist.acknowledgedAt ?? ""
        }
      : null,
    commitments: commitments.map((c) => ({
      kind: c.kind ?? "",
      coverage: c.coverage ?? "",
      exclusions: c.exclusions ?? "",
      startDate: c.startDate ?? "",
      endDate: c.endDate ?? "",
      odometerLimit: c.odometerLimit ?? "",
      eligibleServices: c.eligibleServices ?? "",
      servicesUsed: c.servicesUsed ?? "",
      status: c.status ?? ""
    })),
    serviceHistory: serviceRequests.map((r) => ({
      requestRef: r.requestRef ?? "",
      reportedDate: r.reportedDate ?? "",
      complaint: r.complaint ?? "",
      coverageDecision: r.coverageDecision ?? "",
      status: r.status ?? "",
      // Only what the customer was charged - never the showroom's cost.
      customerChargePaise: Number(r.customerChargePaise ?? "0")
    }))
  };
}

function asStrings(row: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v ?? "")]));
}

/** Formula-safe CSV export builder for tabular reports. */
export function reportToCsv(rows: Array<Record<string, string | number>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0] as Record<string, string | number>);
  const matrix = rows.map((r) => headers.map((h) => String(r[h] ?? "")));
  return toCsv([headers, ...matrix]);
}
