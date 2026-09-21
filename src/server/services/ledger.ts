import { DataStore } from "@/lib/store/types";
import { repoFor } from "@/lib/repo";
import { sumPaise } from "@/lib/money";
import { investmentBreakdown, afterSaleCosts } from "./work";
import { saleBalances } from "./sales";

/**
 * One car's complete money trail: seller → showroom → customer → after-sale.
 *
 * Every other view answers a slice of this (what we paid the seller, what the
 * refurb cost, what the customer still owes). This assembles the whole chain for
 * a single vehicle so the owner can follow the money end to end in one place,
 * which is the question the showroom actually asks about a car.
 *
 * Amounts are integer paise. Nothing here is derived twice: each figure comes
 * from the same canonical source the rest of the app uses.
 */
export interface MoneyTrail {
  vehicle: { id: string; stockRef: string; title: string; registration: string; state: string; askingPaise: number };
  seller: { name: string; phone: string } | null;
  /** Seller → showroom. */
  purchase: {
    agreedPaise: number;
    paidPaise: number;
    outstandingPaise: number;
    payments: Array<{ date: string; amountPaise: number; method: string; reference: string }>;
  };
  /** Money spent while we own the car. */
  preparation: {
    repairsPaise: number;
    accessoriesPaise: number;
    otherPaise: number;
    totalPaise: number;
    workOrders: Array<{ ref: string; issue: string; stage: string; status: string; actualPaise: number }>;
    accessories: Array<{ item: string; totalPaise: number; inWorkOrder: boolean }>;
    expenses: Array<{ category: string; date: string; amountPaise: number; payer: string; counted: boolean }>;
  };
  /** Total the car has cost the showroom before it is sold. */
  investmentPaise: number;
  /** Showroom → customer. */
  sale: {
    saleRef: string;
    date: string;
    status: string;
    customer: { name: string; phone: string } | null;
    askingPaise: number;
    pricePaise: number;
    receivedPaise: number;
    outstandingPaise: number;
    payments: Array<{ date: string; amountPaise: number; method: string; kind: string; voided: boolean }>;
  } | null;
  afterSale: {
    showroomCostPaise: number;
    customerChargedPaise: number;
    customerPaidPaise: number;
    customerOutstandingPaise: number;
  };
  result: {
    /** Sale price − investment. Zero until the car is sold. */
    grossProfitPaise: number;
    /** Gross profit less showroom-funded after-sale work. */
    contributionPaise: number;
    sold: boolean;
  };
}

export async function carMoneyTrail(store: DataStore, vehicleId: string): Promise<MoneyTrail> {
  const repo = repoFor(store);
  const v = await repo.table("Vehicles").get(vehicleId);
  if (!v) throw Object.assign(new Error("Vehicle not found"), { status: 404 });

  const [seller, allPurchasePayments, workOrders, accessories, expenses, sales, investment, after] = await Promise.all([
    v.sellerId ? repo.table("Sellers").get(v.sellerId) : Promise.resolve(null),
    repo.table("PurchasePayments").list({ where: (r) => r.vehicleId === vehicleId }),
    repo.table("WorkOrders").list({ where: (r) => r.vehicleId === vehicleId }),
    repo.table("Accessories").list({ where: (r) => r.vehicleId === vehicleId }),
    repo.table("Expenses").list({ where: (r) => r.vehicleId === vehicleId }),
    repo.table("Sales").list({ where: (r) => r.vehicleId === vehicleId }),
    investmentBreakdown(store, vehicleId),
    afterSaleCosts(store, vehicleId)
  ]);

  const agreed = Number(v.purchasePricePaise ?? "0");
  const paidToSeller = sumPaise(allPurchasePayments.map((p) => Number(p.amountPaise ?? "0")));

  // The live sale for this car: the most recent one that was not cancelled.
  const liveSale = sales
    .filter((s) => s.status !== "Cancelled")
    .sort((a, b) => (b.saleDate ?? "").localeCompare(a.saleDate ?? ""))[0];

  let saleBlock: MoneyTrail["sale"] = null;
  if (liveSale) {
    const balances = await saleBalances(store, liveSale.id);
    const customer = liveSale.customerId ? await repo.table("Customers").get(liveSale.customerId) : null;
    const payments = await repo.table("SalePayments").list({ where: (r) => r.saleId === liveSale.id });
    saleBlock = {
      saleRef: liveSale.saleRef ?? "",
      date: liveSale.saleDate ?? "",
      status: liveSale.status ?? "",
      customer: customer ? { name: customer.name ?? "", phone: customer.phone ?? "" } : null,
      askingPaise: Number(v.currentAskingPaise ?? "0"),
      pricePaise: balances.price,
      receivedPaise: balances.paid,
      outstandingPaise: balances.balance,
      payments: payments
        .slice()
        .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
        .map((p) => ({
          date: p.date ?? "",
          amountPaise: Number(p.amountPaise ?? "0"),
          method: p.method ?? "",
          kind: p.kind ?? "",
          voided: Boolean(p.voidedAt)
        }))
    };
  }

  // Customer-billable after-sale money is tracked separately from the car sale.
  const requests = await repo.table("ServiceRequests").list({ where: (r) => r.vehicleId === vehicleId });
  const charges = await repo.table("ServiceCharges").list({ where: (r) => r.vehicleId === vehicleId });
  const customerCharged = sumPaise(requests.map((r) => Number(r.customerChargePaise ?? "0")));
  const customerPaid = sumPaise(charges.filter((c) => !c.voidedAt).map((c) => Number(c.amountPaise ?? "0")));

  const sold = Boolean(saleBlock);
  const grossProfit = sold ? saleBlock!.pricePaise - investment.total : 0;

  return {
    vehicle: {
      id: v.id,
      stockRef: v.stockRef ?? "",
      title: `${v.manufactureYear ?? ""} ${v.make ?? ""} ${v.model ?? ""} ${v.variant ?? ""}`.trim(),
      registration: v.registrationNumber ?? "",
      state: v.lifecycleState ?? "",
      askingPaise: Number(v.currentAskingPaise ?? "0")
    },
    seller: seller ? { name: seller.name ?? "", phone: seller.phone ?? "" } : null,
    purchase: {
      agreedPaise: agreed,
      paidPaise: paidToSeller,
      outstandingPaise: agreed - paidToSeller,
      payments: allPurchasePayments
        .slice()
        .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
        .map((p) => ({
          date: p.date ?? "",
          amountPaise: Number(p.amountPaise ?? "0"),
          method: p.method ?? "",
          reference: p.reference ?? ""
        }))
    },
    preparation: {
      repairsPaise: investment.repairs,
      accessoriesPaise: investment.accessories,
      otherPaise: investment.other,
      totalPaise: investment.repairs + investment.accessories + investment.other,
      workOrders: workOrders.map((w) => ({
        ref: w.workOrderRef ?? "",
        issue: w.issue ?? "",
        stage: w.stage ?? "",
        status: w.status ?? "",
        actualPaise: Number(w.actualPaise ?? "0")
      })),
      accessories: accessories.map((a) => ({
        item: a.item ?? "",
        totalPaise: Number(a.totalPaise ?? "0"),
        // Flagged so the page can show why an amount is not added again.
        inWorkOrder: Boolean(a.workOrderId)
      })),
      expenses: expenses.map((e) => ({
        category: e.category ?? "",
        date: e.date ?? "",
        amountPaise: Number(e.amountPaise ?? "0"),
        payer: e.payer ?? "",
        counted:
          (e.payer ?? "") === "Showroom" &&
          !e.saleId &&
          !["Repair", "Accessories"].includes(e.category ?? "")
      }))
    },
    investmentPaise: investment.total,
    sale: saleBlock,
    afterSale: {
      showroomCostPaise: after.total,
      customerChargedPaise: customerCharged,
      customerPaidPaise: customerPaid,
      customerOutstandingPaise: customerCharged - customerPaid
    },
    result: {
      grossProfitPaise: grossProfit,
      contributionPaise: grossProfit - after.total,
      sold
    }
  };
}

/** Money trail for every owned car, newest first. Used by the ledger index. */
export async function allMoneyTrails(store: DataStore): Promise<MoneyTrail[]> {
  const repo = repoFor(store);
  const vehicles = (await repo.table("Vehicles").list()).filter(
    (v) => v.lifecycleState !== "In acquisition pipeline"
  );
  const trails = await Promise.all(vehicles.map((v) => carMoneyTrail(store, v.id)));
  return trails.sort((a, b) => a.vehicle.stockRef.localeCompare(b.vehicle.stockRef));
}
