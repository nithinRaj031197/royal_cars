import { describe, it, expect, beforeEach } from "vitest";
import { DemoStore } from "@/lib/store/demo-store";
import { setStoreForTests } from "@/lib/store";
import { Repo } from "@/lib/repo";
import type { DataStore, WriteContext } from "@/lib/store/types";
import { createEnquiry, markAcquired, rejectCase } from "@/server/services/acquisitions";
import { enquiryInputSchema } from "@/lib/form-schemas";
import { createInspection } from "@/server/services/inspections";
import { createWorkOrder, completeWorkOrder, addAccessory, addExpense, investmentBreakdown, afterSaleCosts } from "@/server/services/work";
import { addPurchasePayment } from "@/server/services/purchases";
import { createReservation, createSale, addSalePayment, cancelReservation, saleBalances } from "@/server/services/sales";
import { completeDelivery } from "@/server/services/delivery";
import { createServiceRequest, decideCoverage, addServiceJob, addServiceCharge, serviceChargeBalance, resolveServiceRequest, closeServiceRequest } from "@/server/services/aftersale";
import { changePrice, transitionVehicleState } from "@/server/services/pricing";
import { importCsv, IMPORT_TEMPLATES } from "@/server/services/imports";
import { upsertCustomer, createLead, createFollowUp, overdueFollowUps } from "@/server/services/crm";
import { can } from "@/lib/permissions";
import { reconcile } from "@/server/services/reconcile";
import { carMoneyTrail } from "@/server/services/ledger";

const R = (n: number) => Math.round(n * 100);
const today = new Date().toISOString().slice(0, 10);

let store: DataStore;
let ctx: WriteContext;

beforeEach(async () => {
  store = new DemoStore();
  setStoreForTests(store);
  // Seed staff allowlist
  await store.create("Staff", { email: "owner@test", name: "Owner", role: "owner", active: "TRUE" }, { actor: "test" });
  ctx = { actor: "owner@test" };
});

/** Scenario 1: enquiry → inspection → rejected */
describe("scenario 1: rejected acquisition", () => {
  it("keeps rejected enquiries searchable and out of inventory", async () => {
    const enq = await createEnquiry({
      sellerName: "Mohan Rao", sellerPhone: "9812345670", leadSource: "Referral",
      make: "Honda", model: "City", manufactureYear: 2015, registrationYear: 2015,
      fuel: "Petrol", transmission: "Manual", bodyType: "Sedan", colour: "Silver",
      odometerKm: 88000, ownershipCount: 1, registrationNumber: "KA05MV9911",
      expectedPrice: R(525000)
    }, ctx);
    const repo = new Repo(store);
    await createInspection({
      vehicleId: enq.vehicle.id, type: "Pre-purchase", date: today, odometerKm: 88000,
      overallResult: "Pass with findings", accidentHistory: "Reported", floodHistory: "Unknown",
      items: []
    }, ctx);
    await rejectCase(enq.caseRow.id, "Price gap too wide", ctx);

    const vehicle = await repo.table("Vehicles").get(enq.vehicle.id);
    expect(vehicle?.lifecycleState).toBe("In acquisition pipeline");
    const c = await repo.table("AcquisitionCases").get(enq.caseRow.id);
    expect(c?.status).toBe("Rejected");
    expect(c?.closeReason).toContain("Price gap");
    // Not in owned inventory
    const inventory = (await repo.table("Vehicles").list()).filter((v) => v.lifecycleState !== "In acquisition pipeline");
    expect(inventory.find((v) => v.id === enq.vehicle.id)).toBeUndefined();
    // Still searchable
    const all = await repo.table("Vehicles").list({ activeOnly: false });
    expect(all.find((v) => v.id === enq.vehicle.id)).toBeDefined();
  });
});

/** Scenario 2: enquiry → acquisition → seller payments */
describe("scenario 2: acquisition with seller payments", () => {
  it("computes seller balance from payment history", async () => {
    const enq = await createEnquiry({
      sellerName: "Lakshmi", sellerPhone: "9845012345", leadSource: "Walk-in",
      make: "Maruti Suzuki", model: "Swift", manufactureYear: 2019, registrationYear: 2019,
      fuel: "Petrol", transmission: "Manual", bodyType: "Hatchback", colour: "White",
      odometerKm: 42000, ownershipCount: 1, registrationNumber: "KA03MJ8842",
      expectedPrice: R(450000)
    }, ctx);
    await markAcquired(enq.caseRow.id, R(430000), today, ctx);
    const r1 = await addPurchasePayment({ acquisitionCaseId: enq.caseRow.id, date: today, amount: R(380000), method: "NEFT/RTGS" }, ctx);
    expect(r1.outstanding).toBe(R(50000));
    const r2 = await addPurchasePayment({ acquisitionCaseId: enq.caseRow.id, date: today, amount: R(50000), method: "Cash" }, ctx);
    expect(r2.outstanding).toBe(0);
    // Overpayment rejected
    await expect(addPurchasePayment({ acquisitionCaseId: enq.caseRow.id, date: today, amount: R(1000), method: "Cash" }, ctx)).rejects.toThrow(/exceeds/i);
  });
});

/** Scenario 3: inspection → work orders → accessories → expenses → ready for sale */
describe("scenario 3: preparation and ready-for-sale gate", () => {
  async function acquiredVehicle() {
    const enq = await createEnquiry({
      sellerName: "S", sellerPhone: "9800000001", leadSource: "Walk-in",
      make: "Hyundai", model: "i20", manufactureYear: 2021, registrationYear: 2021,
      fuel: "Diesel", transmission: "Manual", bodyType: "Hatchback", colour: "Grey",
      odometerKm: 30000, ownershipCount: 1, registrationNumber: "KA01MR7712", expectedPrice: R(700000)
    }, ctx);
    await markAcquired(enq.caseRow.id, R(650000), today, ctx);
    return enq;
  }

  it("counts only completed showroom work in investment and gates Ready for sale", async () => {
    const enq = await acquiredVehicle();
    // Draft work order: NOT counted
    const wo = await createWorkOrder({ vehicleId: enq.vehicle.id, stage: "Inventory preparation", issue: "Tyres worn", estimated: R(20000) }, ctx);
    let inv = await investmentBreakdown(store, enq.vehicle.id);
    expect(inv.total).toBe(R(650000)); // purchase only, draft not posted
    await completeWorkOrder(wo.id, { parts: R(15000), labour: R(2000), other: 0, tax: R(1000), discount: 0, invoiceNumber: "INV-1", completionNotes: "", completedOn: today }, ctx);
    inv = await investmentBreakdown(store, enq.vehicle.id);
    expect(inv.repairs).toBe(R(18000));
    expect(inv.total).toBe(R(668000));

    // Accessory linked to WO is not double counted
    await addAccessory({ vehicleId: enq.vehicle.id, item: "Seat covers", quantity: 1, unitCost: R(5000), workOrderId: wo.id }, ctx);
    inv = await investmentBreakdown(store, enq.vehicle.id);
    expect(inv.accessories).toBe(0);
    // Standalone accessory counts
    await addAccessory({ vehicleId: enq.vehicle.id, item: "Dashcam", quantity: 1, unitCost: R(6000) }, ctx);
    inv = await investmentBreakdown(store, enq.vehicle.id);
    expect(inv.accessories).toBe(R(6000));

    // Customer-paid expense does not affect showroom investment
    await addExpense({ vehicleId: enq.vehicle.id, category: "Insurance", date: today, amount: R(9000), payer: "Customer" }, ctx);
    inv = await investmentBreakdown(store, enq.vehicle.id);
    expect(inv.other).toBe(0);
    // Showroom expense counts
    await addExpense({ vehicleId: enq.vehicle.id, category: "Transportation", date: today, amount: R(2500), payer: "Showroom" }, ctx);
    inv = await investmentBreakdown(store, enq.vehicle.id);
    expect(inv.other).toBe(R(2500));

    // Ready for sale requires a receiving/pre-delivery inspection
    await expect(transitionVehicleState(enq.vehicle.id, "Ready for sale", "", ctx)).rejects.toThrow(/inspection/i);
    await createInspection({ vehicleId: enq.vehicle.id, type: "Receiving", date: today, odometerKm: 30050, overallResult: "Pass", items: [] }, ctx);
    await transitionVehicleState(enq.vehicle.id, "Ready for sale", "", ctx);
    const repo = new Repo(store);
    const v = await repo.table("Vehicles").get(enq.vehicle.id);
    expect(v?.lifecycleState).toBe("Ready for sale");
  });
});

/** Scenario 4: price change with preserved history */
describe("scenario 4: price history", () => {
  it("appends history without overwriting", async () => {
    const enq = await createEnquiry({
      sellerName: "S", sellerPhone: "9800000002", leadSource: "Phone",
      make: "Honda", model: "Amaze", manufactureYear: 2018, registrationYear: 2018,
      fuel: "Petrol", transmission: "Automatic", bodyType: "Sedan", colour: "Blue",
      odometerKm: 55000, ownershipCount: 1, registrationNumber: "KA05AB1111", expectedPrice: R(500000)
    }, ctx);
    await markAcquired(enq.caseRow.id, R(420000), today, ctx);
    await changePrice({ vehicleId: enq.vehicle.id, kind: "Asking", amount: R(499000), reason: "Initial listing", date: today }, ctx);
    await changePrice({ vehicleId: enq.vehicle.id, kind: "Current asking", amount: R(489000), reason: "Market feedback", date: today }, ctx);
    const repo = new Repo(store);
    const hist = (await repo.table("PriceHistory").list()).filter((h) => h.vehicleId === enq.vehicle.id);
    expect(hist.length).toBe(2);
    expect(hist.find((h) => h.kind === "Current asking")?.previousPaise).toBe(String(R(499000)));
  });
});

/** Scenario 5: reservation → sale → partial payments → delivery */
describe("scenario 5: reservation to delivery", () => {
  it("transfers booking amount, tracks balance, and completes delivery", async () => {
    const enq = await createEnquiry({
      sellerName: "S", sellerPhone: "9800000003", leadSource: "Website",
      make: "Maruti", model: "Baleno", manufactureYear: 2020, registrationYear: 2020,
      fuel: "Petrol", transmission: "Automatic", bodyType: "Hatchback", colour: "Red",
      odometerKm: 28000, ownershipCount: 1, registrationNumber: "KA01AB2222", expectedPrice: R(700000)
    }, ctx);
    await markAcquired(enq.caseRow.id, R(600000), today, ctx);
    await createInspection({ vehicleId: enq.vehicle.id, type: "Receiving", date: today, odometerKm: 28010, overallResult: "Pass", items: [] }, ctx);
    await transitionVehicleState(enq.vehicle.id, "Ready for sale", "", ctx);

    const res = await createReservation({
      vehicleId: enq.vehicle.id, customerName: "Rahul Verma", customerPhone: "9900112233",
      agreedPrice: R(680000), bookingAmount: R(25000), bookingDate: today, expiresOn: today
    }, ctx);
    const repo = new Repo(store);
    const v1 = await repo.table("Vehicles").get(enq.vehicle.id);
    expect(v1?.lifecycleState).toBe("Reserved");

    // Competing reservation must fail (scenario 11)
    await expect(createReservation({
      vehicleId: enq.vehicle.id, customerName: "Other Buyer", customerPhone: "9900112244",
      agreedPrice: R(680000), bookingAmount: R(10000), bookingDate: today, expiresOn: today
    }, ctx)).rejects.toThrow(/active reservation/i);

    const sale = await createSale({
      vehicleId: enq.vehicle.id, customerName: "Rahul Verma", customerPhone: "9900112233",
      reservationId: res.reservation.id, finalNetPrice: R(675000), saleDate: today
    }, ctx);
    // Booking payment transferred into sale balance
    let bal = await saleBalances(store, sale.sale.id);
    expect(bal.paid).toBe(R(25000));
    expect(bal.balance).toBe(R(650000));

    await addSalePayment({ saleId: sale.sale.id, date: today, amount: R(200000), method: "NEFT/RTGS" }, ctx);
    bal = await saleBalances(store, sale.sale.id);
    expect(bal.balance).toBe(R(450000));
    // Overpayment rejected
    await expect(addSalePayment({ saleId: sale.sale.id, date: today, amount: R(500000), method: "Cash" }, ctx)).rejects.toThrow(/exceeds/i);

    // Delivery blocked while balance outstanding without exception
    const items = [
      { kind: "Final inspection", label: "Final inspection", mandatory: true, done: true, note: "" },
      { kind: "Promised repairs", label: "Repairs done", mandatory: true, done: true, note: "" },
      { kind: "Cleaning & preparation", label: "Cleaned", mandatory: true, done: true, note: "" },
      { kind: "Keys & accessories", label: "Keys", mandatory: true, done: true, note: "" },
      { kind: "Required documents", label: "Docs", mandatory: true, done: true, note: "" },
      { kind: "Payment review", label: "Payment review", mandatory: true, done: true, note: "" },
      { kind: "Handover acknowledgement", label: "Acknowledged", mandatory: true, done: true, note: "" }
    ];
    await expect(completeDelivery({ saleId: sale.sale.id, deliveryDate: today, odometerKm: 28100, items }, ctx)).rejects.toThrow(/outstanding/i);
    // With approval + reason: allowed and recorded
    const done = await completeDelivery({ saleId: sale.sale.id, deliveryDate: today, odometerKm: 28100, items, allowOutstandingBalance: true, exceptionReason: "Owner approved balance on credit" }, ctx);
    expect(done.sale.status).toBe("Delivered");
    expect(done.checklist.exceptionApprovedBy).toBe("owner@test");
    const v2 = await repo.table("Vehicles").get(enq.vehicle.id);
    expect(v2?.lifecycleState).toBe("Delivered");
  });
});

/** Scenario 6: cancellation and refund without lost history */
describe("scenario 6: cancellation preserves history", () => {
  it("cancels a reservation, records refund, releases vehicle", async () => {
    const enq = await createEnquiry({
      sellerName: "S", sellerPhone: "9800000004", leadSource: "Walk-in",
      make: "Toyota", model: "Etios", manufactureYear: 2017, registrationYear: 2017,
      fuel: "Diesel", transmission: "Manual", bodyType: "Sedan", colour: "White",
      odometerKm: 90000, ownershipCount: 2, registrationNumber: "KA02AB3333", expectedPrice: R(500000)
    }, ctx);
    await markAcquired(enq.caseRow.id, R(450000), today, ctx);
    const res = await createReservation({
      vehicleId: enq.vehicle.id, customerName: "Buyer X", customerPhone: "9900112255",
      agreedPrice: R(520000), bookingAmount: R(20000), bookingDate: today, expiresOn: today
    }, ctx);
    const updated = await cancelReservation(res.reservation.id, "Buyer backed out", R(20000), "UPI", ctx);
    expect(updated.status).toBe("Cancelled");
    expect(updated.refundAmountPaise).toBe(String(R(20000)));
    // Refund above booking rejected
    const res2 = await createReservation({
      vehicleId: enq.vehicle.id, customerName: "Buyer Y", customerPhone: "9900112266",
      agreedPrice: R(520000), bookingAmount: R(20000), bookingDate: today, expiresOn: today
    }, ctx);
    await expect(cancelReservation(res2.reservation.id, "Test", R(30000), "UPI", ctx)).rejects.toThrow(/exceed/i);
  });
});

/** Scenario 7 + 8: after-sale flows */
describe("scenarios 7-8: after-sale covered and customer-billable", () => {
  async function deliveredSale() {
    const enq = await createEnquiry({
      sellerName: "S", sellerPhone: "9800000005", leadSource: "Referral",
      make: "Ford", model: "Figo", manufactureYear: 2016, registrationYear: 2016,
      fuel: "Petrol", transmission: "Manual", bodyType: "Hatchback", colour: "Blue",
      odometerKm: 60000, ownershipCount: 1, registrationNumber: "KA03AB4444", expectedPrice: R(350000)
    }, ctx);
    await markAcquired(enq.caseRow.id, R(300000), today, ctx);
    await createInspection({ vehicleId: enq.vehicle.id, type: "Receiving", date: today, odometerKm: 60010, overallResult: "Pass", items: [] }, ctx);
    const sale = await createSale({
      vehicleId: enq.vehicle.id, customerName: "Buyer Z", customerPhone: "9900112777",
      finalNetPrice: R(380000), saleDate: today
    }, ctx);
    const items = [
      { kind: "Final inspection", label: "Final inspection", mandatory: true, done: true, note: "" },
      { kind: "Promised repairs", label: "Repairs done", mandatory: true, done: true, note: "" },
      { kind: "Cleaning & preparation", label: "Cleaned", mandatory: true, done: true, note: "" },
      { kind: "Keys & accessories", label: "Keys", mandatory: true, done: true, note: "" },
      { kind: "Required documents", label: "Docs", mandatory: true, done: true, note: "" },
      { kind: "Payment review", label: "Paid", mandatory: true, done: true, note: "" },
      { kind: "Handover acknowledgement", label: "Ack", mandatory: true, done: true, note: "" }
    ];
    await addSalePayment({ saleId: sale.sale.id, date: today, amount: R(380000), method: "Cash" }, ctx);
    await completeDelivery({ saleId: sale.sale.id, deliveryDate: today, odometerKm: 60100, items }, ctx);
    return { enq, sale };
  }

  it("covered repair is showroom-funded and closes cleanly", async () => {
    const { sale } = await deliveredSale();
    const sr = await createServiceRequest({ saleId: sale.sale.id, complaint: "AC not cooling", reportedDate: today, priority: "Normal" }, ctx);
    await decideCoverage(sr.id, "Covered", "Within free-service window", ctx);
    await addServiceJob({ serviceRequestId: sr.id, date: today, workDone: "AC gas top-up", parts: R(800), labour: R(700) }, ctx);
    const bal = await serviceChargeBalance(store, sr.id);
    expect(bal.chargeable).toBe(0);
    await resolveServiceRequest(sr.id, "Fixed under coverage", "", ctx);
    await closeServiceRequest(sr.id, ctx);
    const repo = new Repo(store);
    const closed = await repo.table("ServiceRequests").get(sr.id);
    expect(closed?.status).toBe("Closed");
    // Vehicle remains Delivered
    const saleRow = await repo.table("Sales").get(sale.sale.id);
    const v = await repo.table("Vehicles").get(saleRow!.vehicleId ?? "");
    expect(v?.lifecycleState).toBe("Delivered");
  });

  it("customer-billable service has a separate payment balance", async () => {
    const { sale } = await deliveredSale();
    const sr = await createServiceRequest({ saleId: sale.sale.id, complaint: "Upgraded infotainment install", reportedDate: today, priority: "Low" }, ctx);
    await decideCoverage(sr.id, "Customer billable", "Not a defect; customer request", ctx);
    const job = await addServiceJob({ serviceRequestId: sr.id, date: today, workDone: "Install Android unit", parts: R(9000), labour: R(1500) }, ctx);
    void job;
    let bal = await serviceChargeBalance(store, sr.id);
    expect(bal.chargeable).toBe(R(10500));
    expect(bal.due).toBe(R(10500));
    // Overcharge rejected
    await expect(addServiceCharge({ serviceRequestId: sr.id, date: today, kind: "Charge", amount: R(12000), method: "UPI" }, ctx)).rejects.toThrow(/exceeds/i);
    await addServiceCharge({ serviceRequestId: sr.id, date: today, kind: "Charge", amount: R(5000), method: "UPI" }, ctx);
    bal = await serviceChargeBalance(store, sr.id);
    expect(bal.due).toBe(R(5500));
    // Independent of sale balance
    const saleBal = await saleBalances(store, sale.sale.id);
    expect(saleBal.balance).toBe(0);
  });
});

/** Scenario 9: no duplicated invoice/accessory amounts (covered in scenario 3) + expense double-count guard */
describe("scenario 9: canonical cost sources", () => {
  it("excludes Repair/Accessories category expenses from investment 'other'", async () => {
    const enq = await createEnquiry({
      sellerName: "S", sellerPhone: "9800000006", leadSource: "Phone",
      make: "VW", model: "Polo", manufactureYear: 2019, registrationYear: 2019,
      fuel: "Petrol", transmission: "Manual", bodyType: "Hatchback", colour: "Red",
      odometerKm: 35000, ownershipCount: 1, registrationNumber: "KA05AB5555", expectedPrice: R(600000)
    }, ctx);
    await markAcquired(enq.caseRow.id, R(520000), today, ctx);
    // An expense recorded against a work-order invoice must not be added again
    await addExpense({ vehicleId: enq.vehicle.id, category: "Repair", date: today, amount: R(3000), payer: "Showroom" }, ctx);
    const inv = await investmentBreakdown(store, enq.vehicle.id);
    expect(inv.other).toBe(0); // Repair category excluded (counted via WO actuals)
  });
});

/** Scenario 10: retried payment submission does not double-post */
describe("scenario 10: idempotent payments", () => {
  it("rejects replayed operation ids", async () => {
    const enq = await createEnquiry({
      sellerName: "S", sellerPhone: "9800000007", leadSource: "Walk-in",
      make: "Renault", model: "Kwid", manufactureYear: 2019, registrationYear: 2019,
      fuel: "Petrol", transmission: "Manual", bodyType: "Hatchback", colour: "Silver",
      odometerKm: 22000, ownershipCount: 1, registrationNumber: "KA02AB6666", expectedPrice: R(300000)
    }, ctx);
    await markAcquired(enq.caseRow.id, R(280000), today, ctx);
    const opId = "op-test-payment-1";
    await addPurchasePayment({ acquisitionCaseId: enq.caseRow.id, date: today, amount: R(100000), method: "UPI" }, { actor: "owner@test", operationId: opId });
    // Simulate completed operation record then a retry with the same operationId
    await store.create("Operations", { id: opId, kind: "purchase.payment", entityType: "PurchasePayments", entityId: enq.caseRow.id, requestId: "owner@test", status: "completed", attempts: "1", lastError: "", payloadJson: "", completedAt: new Date().toISOString() }, ctx);
    await expect(addPurchasePayment({ acquisitionCaseId: enq.caseRow.id, date: today, amount: R(100000), method: "UPI" }, { actor: "owner@test", operationId: opId })).rejects.toThrow(/already recorded/i);
  });
});

/** Scenario 12: stale edit detection */
describe("scenario 12: stale-edit handling", () => {
  it("rejects writes with outdated versions", async () => {
    const repo = new Repo(store);
    const row = await repo.table("Customers").create({ name: "A", phone: "9800000008" }, ctx);
    await repo.table("Customers").update(row.id, { name: "B" }, row.version, ctx);
    await expect(repo.table("Customers").update(row.id, { name: "C" }, row.version, ctx)).rejects.toThrow(/changed by someone else/i);
  });
});

/** Scenario 13: CSV validation and repeat imports */
describe("scenario 13: CSV imports", () => {
  it("validates rows, detects duplicates, and is idempotent on repeat", async () => {
    const csv = `make,model,registrationNumber,fuel,transmission,odometerKm,purchasePrice,currentAskingPrice
Maruti Suzuki,Swift,KA01IM0001,Petrol,Manual,40000,350000,420000
Bad Row,Missing reg,Petrol,Manual,10000,1,1`;
    const r1 = await importCsv("Vehicles", csv, "upsert", ctx);
    expect(r1.created).toBe(1);
    expect(r1.errors.length).toBe(1);
    expect(r1.errors[0]?.row).toBe(3);
    expect(r1.errors[0]?.message).toMatch(/value\(s\) but the header has/i);
    // Repeat import: update path, no duplicate created
    const r2 = await importCsv("Vehicles", `make,model,registrationNumber,fuel,transmission,odometerKm,purchasePrice,currentAskingPrice
Maruti Suzuki,Swift,KA01IM0001,Petrol,Manual,40100,350000,420000`, "upsert", ctx);
    expect(r2.created).toBe(0);
    const repo = new Repo(store);
    const vehicles = (await repo.table("Vehicles").list()).filter((v) => v.registrationNumber === "KA01IM0001");
    expect(vehicles.length).toBe(1);
    expect(vehicles[0]?.odometerKm).toBe("40100");
    // create-only duplicate: reported as a row-level error, and nothing is written.
    // The batch as a whole still succeeds so one bad row cannot discard a large import.
    const r3 = await importCsv("Vehicles", `make,model,registrationNumber
X,Y,KA01IM0001`, "create-only", ctx);
    expect(r3.created).toBe(0);
    expect(r3.updated).toBe(0);
    expect(r3.errors[0]?.message).toMatch(/already exists/i);
    expect((await repo.table("Vehicles").list()).filter((v) => v.registrationNumber === "KA01IM0001").length).toBe(1);
    // Missing required columns
    await expect(importCsv("Customers", `name\nOnly Name`, "upsert", ctx)).rejects.toThrow(/Missing required columns/i);
    void IMPORT_TEMPLATES;
  });
});

/** Scenario 15: unauthorized access */
describe("scenario 15: role enforcement", () => {
  it("hides purchase/profit from sales role and blocks payment recording", () => {
    expect(can({ role: "sales" }, "purchase.view")).toBe(false);
    expect(can({ role: "sales" }, "profit.view")).toBe(false);
    expect(can({ role: "sales" }, "payment.manage")).toBe(false);
    expect(can({ role: "sales" }, "sales.manage")).toBe(true);
    expect(can({ role: "accounts" }, "payment.manage")).toBe(true);
    expect(can({ role: "accounts" }, "acquisition.manage")).toBe(false);
    expect(can({ role: "operations" }, "delivery.manage")).toBe(true);
    expect(can({ role: "owner" }, "staff.manage")).toBe(true);
    expect(can(undefined, "inventory.view")).toBe(false);
    expect(can({ role: "sales" }, "staff.manage")).toBe(false);
  });
});

/** Scenario 16: interrupted operation recovery (operation log records attempts) */
describe("scenario 16: operation records", () => {
  it("records failed operations for reconciliation", async () => {
    const opId = "op-fail-1";
    await expect(addSalePayment({ saleId: "missing", date: today, amount: R(100), method: "Cash" }, { actor: "owner@test", operationId: opId })).rejects.toThrow();
    await store.create("Operations", { id: opId, kind: "sale.payment", entityType: "SalePayments", requestId: "owner@test", status: "failed", attempts: "1", lastError: "Sale not found", payloadJson: "", completedAt: "" }, ctx);
    const issues = await reconcile(store);
    expect(issues.filter((i) => i.entity === "Operations").length).toBe(0); // fresh failure, not stuck pending
  });
});

/** CRM: overdue follow-ups (dashboard data) */
describe("crm follow-ups", () => {
  it("flags overdue follow-ups", async () => {
    const c = await upsertCustomer({ name: "Ravi", phone: "9800000009" }, ctx);
    const l = await createLead({ customerId: c.customer.id, source: "Walk-in" }, ctx);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await createFollowUp({ customerId: c.customer.id, leadId: l.id, dueDate: yesterday, note: "Call back" }, ctx);
    const overdue = await overdueFollowUps(store);
    expect(overdue.length).toBe(1);
  });
});

/** Reconciliation: broken reference detection */
describe("reconciliation", () => {
  it("detects broken references", async () => {
    const repo = new Repo(store);
    const v = await repo.table("Vehicles").create({ stockRef: "STK-X", make: "A", model: "B", lifecycleState: "In preparation" }, ctx);
    await repo.table("WorkOrders").create({ workOrderRef: "WO-X", vehicleId: "nonexistent", status: "Draft", payer: "Showroom" }, ctx);
    void v;
    const issues = await reconcile(store);
    expect(issues.some((i) => i.entity === "WorkOrders" && i.problem.includes("vehicleId"))).toBe(true);
  });
});

/** After-sale costs are funded per ServiceRequest, not per ServiceJob. */
describe("after-sale cost attribution", () => {
  it("counts showroom-funded service jobs and excludes customer-billable ones", async () => {
    const repo = new Repo(store);
    const v = await repo.table("Vehicles").create({ stockRef: "STK-AS", lifecycleState: "Delivered" }, ctx);

    const covered = await repo.table("ServiceRequests").create(
      { vehicleId: v.id, payer: "Showroom", coverageDecision: "Covered", status: "Resolved" }, ctx);
    await repo.table("ServiceJobs").create(
      { serviceRequestId: covered.id, vehicleId: v.id, totalPaise: String(R(1500)), status: "Completed" }, ctx);

    const billable = await repo.table("ServiceRequests").create(
      { vehicleId: v.id, payer: "Customer", coverageDecision: "Customer billable", status: "Resolved" }, ctx);
    await repo.table("ServiceJobs").create(
      { serviceRequestId: billable.id, vehicleId: v.id, totalPaise: String(R(9000)), status: "Completed" }, ctx);

    const costs = await afterSaleCosts(store, v.id);
    // Only the showroom-funded job is a cost to the business.
    expect(costs.serviceJobs).toBe(R(1500));
    expect(costs.total).toBe(R(1500));
  });
});

/** The money trail must agree with the figures each module reports separately. */
describe("car money trail", () => {
  it("follows one car's money from seller to customer without double counting", async () => {
    const enq = await createEnquiry({
      sellerName: "Trail Seller", sellerPhone: "9800001234", leadSource: "Walk-in",
      make: "Tata", model: "Nexon", manufactureYear: 2021, registrationYear: 2021,
      fuel: "Petrol", transmission: "Manual", bodyType: "SUV", colour: "Blue",
      odometerKm: 25000, ownershipCount: 1, registrationNumber: "KA09TR4321", expectedPrice: R(800000)
    }, ctx);
    await markAcquired(enq.caseRow.id, R(750000), today, ctx);
    await addPurchasePayment({ acquisitionCaseId: enq.caseRow.id, date: today, amount: R(600000), method: "NEFT/RTGS" }, ctx);

    // Refurbishment: one completed order, plus an accessory billed inside it.
    const wo = await createWorkOrder({ vehicleId: enq.vehicle.id, stage: "Inventory preparation", issue: "Service + tyres", estimated: R(30000) }, ctx);
    await completeWorkOrder(wo.id, { parts: R(20000), labour: R(5000), other: 0, tax: 0, discount: 0, invoiceNumber: "INV-T1", completionNotes: "", completedOn: today }, ctx);
    await addAccessory({ vehicleId: enq.vehicle.id, item: "Floor mats", quantity: 1, unitCost: R(2000), workOrderId: wo.id }, ctx);
    await addAccessory({ vehicleId: enq.vehicle.id, item: "Dashcam", quantity: 1, unitCost: R(6000) }, ctx);
    await addExpense({ vehicleId: enq.vehicle.id, category: "Transportation", date: today, amount: R(3000), payer: "Showroom" }, ctx);
    await addExpense({ vehicleId: enq.vehicle.id, category: "Insurance", date: today, amount: R(11000), payer: "Customer" }, ctx);

    await createInspection({ vehicleId: enq.vehicle.id, type: "Receiving", date: today, odometerKm: 25010, overallResult: "Pass", items: [] }, ctx);
    const sale = await createSale({
      vehicleId: enq.vehicle.id, customerName: "Trail Buyer", customerPhone: "9900004321",
      finalNetPrice: R(880000), saleDate: today
    }, ctx);
    await addSalePayment({ saleId: sale.saleId, date: today, amount: R(500000), method: "NEFT/RTGS" }, ctx);

    const t = await carMoneyTrail(store, enq.vehicle.id);

    // Seller side.
    expect(t.purchase.agreedPaise).toBe(R(750000));
    expect(t.purchase.paidPaise).toBe(R(600000));
    expect(t.purchase.outstandingPaise).toBe(R(150000));

    // Showroom side: WO 25,000 + standalone accessory 6,000 + transport 3,000.
    // Floor mats (inside the WO) and the customer-paid insurance are excluded.
    expect(t.preparation.repairsPaise).toBe(R(25000));
    expect(t.preparation.accessoriesPaise).toBe(R(6000));
    expect(t.preparation.otherPaise).toBe(R(3000));
    expect(t.investmentPaise).toBe(R(784000));

    // Those exclusions are shown, not silently dropped.
    expect(t.preparation.accessories.find((a) => a.item === "Floor mats")?.inWorkOrder).toBe(true);
    expect(t.preparation.expenses.find((e) => e.category === "Insurance")?.counted).toBe(false);

    // Customer side.
    expect(t.sale?.pricePaise).toBe(R(880000));
    expect(t.sale?.receivedPaise).toBe(R(500000));
    expect(t.sale?.outstandingPaise).toBe(R(380000));

    // Result: 880,000 − 784,000 = 96,000, and no after-sale work yet.
    expect(t.result.grossProfitPaise).toBe(R(96000));
    expect(t.result.contributionPaise).toBe(R(96000));

    // Collections are cash flow, not profit: paying less does not change margin.
    expect(t.result.grossProfitPaise).not.toBe(t.sale!.receivedPaise - t.investmentPaise);
  });
});

/**
 * The showroom is entering history it already holds, and that history is
 * incomplete. A partial record must save; only the minimum needed to keep it
 * findable and linked is enforced.
 */
describe("partial records from migrated history", () => {
  it("saves an enquiry with almost nothing filled in", async () => {
    const parsed = enquiryInputSchema.parse({ sellerName: "Walk-in seller", make: "Maruti" });
    const enq = await createEnquiry(parsed, ctx);

    const repo = new Repo(store);
    const v = await repo.table("Vehicles").get(enq.vehicle.id);
    expect(v?.make).toBe("Maruti");
    // Unknown values are stored blank, not as a misleading zero.
    expect(v?.odometerKm).toBe("");
    expect(v?.manufactureYear).toBe("");
    expect(v?.registrationNumber).toBe("");
    // It still gets a stock reference, so staff can find it and fill in later.
    expect(enq.caseRow.caseRef).toMatch(/^ACQ-/);
  });

  it("still requires enough to identify the seller and the car", () => {
    // Nothing at all about the seller.
    expect(enquiryInputSchema.safeParse({ make: "Maruti" }).success).toBe(false);
    // Nothing at all about the car.
    expect(enquiryInputSchema.safeParse({ sellerName: "A" }).success).toBe(false);
    // Either identifier alone is enough.
    expect(enquiryInputSchema.safeParse({ sellerPhone: "9845012345", model: "Swift" }).success).toBe(true);
    expect(enquiryInputSchema.safeParse({ sellerName: "A", registrationNumber: "KA01AB1234" }).success).toBe(true);
  });

  it("validates a value that IS supplied", () => {
    const bad = enquiryInputSchema.safeParse({ sellerName: "A", make: "X", manufactureYear: "1234567" });
    expect(bad.success).toBe(false);
  });

  it("does not merge separate customers that both have no phone", async () => {
    const a = await upsertCustomer({ name: "Cash Buyer One", phone: "" }, ctx);
    const b = await upsertCustomer({ name: "Cash Buyer Two", phone: "" }, ctx);
    expect(a.customer.id).not.toBe(b.customer.id);

    const repo = new Repo(store);
    const names = (await repo.table("Customers").list()).map((c) => c.name);
    expect(names).toContain("Cash Buyer One");
    expect(names).toContain("Cash Buyer Two");

    // A real phone still matches the same person rather than duplicating them.
    const c1 = await upsertCustomer({ name: "Repeat Buyer", phone: "9900001111" }, ctx);
    const c2 = await upsertCustomer({ name: "Repeat Buyer", phone: "9900001111" }, ctx);
    expect(c2.customer.id).toBe(c1.customer.id);
    expect(c2.created).toBe(false);
  });
});

/** Relaxed forms must not weaken the rules that keep money correct. */
describe("relaxed forms keep financial integrity", () => {
  it("still refuses a payment without an amount or a sale", async () => {
    const { salePaymentInputSchema, expenseInputSchema } = await import("@/lib/form-schemas");
    expect(salePaymentInputSchema.safeParse({ saleId: "s1", date: today, method: "Cash" }).success).toBe(false);
    expect(salePaymentInputSchema.safeParse({ date: today, amount: 100, method: "Cash" }).success).toBe(false);
    // An expense must still say which vehicle it belongs to.
    expect(expenseInputSchema.safeParse({ category: "Transportation", date: today, amount: 100 }).success).toBe(false);
  });

  it("treats unknown work-order cost components as zero, not as a refusal", async () => {
    const enq = await createEnquiry(
      enquiryInputSchema.parse({ sellerName: "S", make: "Honda", model: "Jazz" }),
      ctx
    );
    await markAcquired(enq.caseRow.id, R(300000), today, ctx);
    const wo = await createWorkOrder({ vehicleId: enq.vehicle.id, stage: "Inventory preparation" }, ctx);
    // Only the parts figure survives from the old invoice.
    await completeWorkOrder(wo.id, { parts: R(5000), labour: 0, other: 0, tax: 0, discount: 0, completedOn: today }, ctx);
    const inv = await investmentBreakdown(store, enq.vehicle.id);
    expect(inv.repairs).toBe(R(5000));
    expect(inv.total).toBe(R(305000));
  });
});
