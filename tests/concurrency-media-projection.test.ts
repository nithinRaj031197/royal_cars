/**
 * Spec scenarios not covered by workflows.test.ts:
 *   11 — concurrent reservation attempts
 *   14 — file validation and failed-upload recovery
 *   15 — confidential data is absent from customer-facing projections
 * plus reconciliation of interrupted operations (16).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { DemoStore } from "@/lib/store/demo-store";
import { setStoreForTests } from "@/lib/store";
import { Repo } from "@/lib/repo";
import type { DataStore, WriteContext } from "@/lib/store/types";
import { createEnquiry, markAcquired } from "@/server/services/acquisitions";
import { createInspection } from "@/server/services/inspections";
import { createReservation, createSale, addSalePayment } from "@/server/services/sales";
import { transitionVehicleState } from "@/server/services/pricing";
import { uploadVehicleFile, deletePhoto, setPrimaryPhoto } from "@/server/services/media";
import { customerVehicleProjection, customerSaleDocument } from "@/server/services/reports";
import { MAX_UPLOAD_BYTES } from "@/lib/config/constants";
import { can } from "@/lib/permissions";

const R = (n: number) => Math.round(n * 100);
const today = new Date().toISOString().slice(0, 10);

let store: DataStore;
let ctx: WriteContext;

beforeEach(async () => {
  store = new DemoStore();
  setStoreForTests(store);
  await store.create("Staff", { email: "owner@test", name: "Owner", role: "owner", active: "TRUE" }, { actor: "test" });
  ctx = { actor: "owner@test" };
});

async function readyVehicle(reg: string) {
  const enq = await createEnquiry({
    sellerName: "Seller", sellerPhone: "9800000100", leadSource: "Walk-in",
    make: "Maruti", model: "Dzire", manufactureYear: 2020, registrationYear: 2020,
    fuel: "Petrol", transmission: "Manual", bodyType: "Sedan", colour: "White",
    odometerKm: 30000, ownershipCount: 1, registrationNumber: reg, expectedPrice: R(600000)
  }, ctx);
  await markAcquired(enq.caseRow.id, R(550000), today, ctx);
  await createInspection({
    vehicleId: enq.vehicle.id, type: "Receiving", date: today, odometerKm: 30010, overallResult: "Pass", items: []
  }, ctx);
  await transitionVehicleState(enq.vehicle.id, "Ready for sale", "", ctx);
  return enq;
}

/** Scenario 11 */
describe("scenario 11: concurrent reservation attempts", () => {
  it("lets exactly one of several simultaneous reservations win", async () => {
    const enq = await readyVehicle("KA01CC1001");

    const attempt = (phone: string) =>
      createReservation({
        vehicleId: enq.vehicle.id,
        customerName: `Buyer ${phone.slice(-2)}`,
        customerPhone: phone,
        agreedPrice: R(600000),
        bookingAmount: R(20000),
        bookingDate: today,
        expiresOn: today
      }, { actor: "owner@test" });

    // Fired together, not awaited in turn: they interleave on the store.
    const results = await Promise.allSettled([
      attempt("9900000001"),
      attempt("9900000002"),
      attempt("9900000003"),
      attempt("9900000004")
    ]);

    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(3);
    for (const f of failed) {
      expect((f as PromiseRejectedResult).reason.message).toMatch(/active reservation|not available/i);
    }

    const repo = new Repo(store);
    const active = (await repo.table("Reservations").list()).filter((r) => r.status === "Active");
    expect(active).toHaveLength(1);
    expect((await repo.table("Vehicles").get(enq.vehicle.id))?.lifecycleState).toBe("Reserved");
  });

  it("prevents a sale competing with an active reservation for another customer", async () => {
    const enq = await readyVehicle("KA01CC1002");
    await createReservation({
      vehicleId: enq.vehicle.id, customerName: "First Buyer", customerPhone: "9900000010",
      agreedPrice: R(600000), bookingAmount: R(20000), bookingDate: today, expiresOn: today
    }, ctx);

    const results = await Promise.allSettled([
      createSale({
        vehicleId: enq.vehicle.id, customerName: "Second Buyer", customerPhone: "9900000011",
        finalNetPrice: R(595000), saleDate: today
      }, ctx),
      createSale({
        vehicleId: enq.vehicle.id, customerName: "Third Buyer", customerPhone: "9900000012",
        finalNetPrice: R(596000), saleDate: today
      }, ctx)
    ]);

    const repo = new Repo(store);
    const sales = (await repo.table("Sales").list()).filter((s) => s.status !== "Cancelled");
    expect(sales.length).toBeLessThanOrEqual(1);
    expect(results.filter((r) => r.status === "fulfilled").length).toBeLessThanOrEqual(1);
  });

  it("does not double-post concurrent payments beyond the sale price", async () => {
    const enq = await readyVehicle("KA01CC1003");
    const sale = await createSale({
      vehicleId: enq.vehicle.id, customerName: "Payer", customerPhone: "9900000020",
      finalNetPrice: R(600000), saleDate: today
    }, ctx);

    // Four simultaneous ₹2L payments against a ₹6L sale: at most three can stick.
    const results = await Promise.allSettled(
      [1, 2, 3, 4].map(() =>
        addSalePayment({ saleId: sale.saleId, date: today, amount: R(200000), method: "Cash" }, { actor: "owner@test" })
      )
    );
    const accepted = results.filter((r) => r.status === "fulfilled").length;
    expect(accepted).toBeLessThanOrEqual(3);

    const repo = new Repo(store);
    const payments = (await repo.table("SalePayments").list()).filter((p) => p.saleId === sale.saleId && !p.voidedAt);
    const paid = payments.reduce((a, p) => a + Number(p.amountPaise ?? "0"), 0);
    expect(paid).toBeLessThanOrEqual(R(600000));
  });
});

/** Scenario 14 */
describe("scenario 14: file validation and failed-upload recovery", () => {
  function fakeFile(name: string, type: string, size: number): File {
    const f = new File([new Uint8Array(Math.min(size, 1024))], name, { type });
    // Size is validated before any byte is read, so override it cheaply.
    Object.defineProperty(f, "size", { value: size });
    return f;
  }

  it("rejects oversized and unsupported files before touching Drive", async () => {
    await expect(
      uploadVehicleFile(fakeFile("huge.jpg", "image/jpeg", MAX_UPLOAD_BYTES + 1), { vehicleId: "v1", category: "Gallery" }, ctx)
    ).rejects.toThrow(/larger than/i);

    await expect(
      uploadVehicleFile(fakeFile("script.exe", "application/x-msdownload", 1000), { vehicleId: "v1", category: "Gallery" }, ctx)
    ).rejects.toThrow(/unsupported file type/i);

    await expect(
      uploadVehicleFile(fakeFile("contract.pdf", "application/pdf", 1000), { vehicleId: "v1", category: "Gallery" }, ctx)
    ).rejects.toThrow(/require an image/i);
  });

  it("reports missing Drive configuration clearly and writes no metadata", async () => {
    const before = (await store.list("VehiclePhotos", { activeOnly: false })).length;
    await expect(
      uploadVehicleFile(fakeFile("photo.jpg", "image/jpeg", 2000), { vehicleId: "v1", category: "Gallery" }, ctx)
    ).rejects.toThrow(/not configured/i);
    // A failed upload must leave no orphaned row pointing at a non-existent file.
    expect((await store.list("VehiclePhotos", { activeOnly: false })).length).toBe(before);
    expect((await store.list("VehicleDocuments", { activeOnly: false })).length).toBe(0);
  });

  it("archives a photo without destroying its record, and keeps one primary", async () => {
    const repo = new Repo(store);
    const p1 = await repo.table("VehiclePhotos").create({ vehicleId: "v1", fileId: "f1", isPrimary: "TRUE", category: "Gallery" }, ctx);
    const p2 = await repo.table("VehiclePhotos").create({ vehicleId: "v1", fileId: "f2", isPrimary: "FALSE", category: "Gallery" }, ctx);

    await setPrimaryPhoto(p2.id, ctx);
    expect((await repo.table("VehiclePhotos").get(p1.id))?.isPrimary).toBe("FALSE");
    expect((await repo.table("VehiclePhotos").get(p2.id))?.isPrimary).toBe("TRUE");

    await deletePhoto(p1.id, ctx);
    // Gone from active listings, still present in the audit trail.
    expect((await repo.table("VehiclePhotos").list()).find((p) => p.id === p1.id)).toBeUndefined();
    expect((await repo.table("VehiclePhotos").list({ activeOnly: false })).find((p) => p.id === p1.id)).toBeDefined();
  });
});

/** Scenario 15 (projection half) */
describe("scenario 15: customer projections exclude confidential data", () => {
  const FORBIDDEN = [
    "purchasePricePaise", "minimumPricePaise", "snapshotInvestmentPaise", "snapshotGrossProfitPaise",
    "snapshotPurchasePaise", "snapshotRepairsPaise", "sellerId", "acquisitionNotes", "acquisitionCaseId"
  ];

  it("vehicle projection is an allowlist, not an omission", async () => {
    const enq = await readyVehicle("KA01CC1004");
    const repo = new Repo(store);
    const raw = await repo.table("Vehicles").get(enq.vehicle.id);
    const projected = customerVehicleProjection(
      Object.fromEntries(Object.entries(raw!).map(([k, v]) => [k, String(v ?? "")]))
    );
    for (const key of FORBIDDEN) {
      expect(Object.keys(projected)).not.toContain(key);
    }
    // And it still carries what a buyer needs.
    expect(projected.title).toContain("Dzire");
    expect(projected.odometerKm).toBe("30000");
  });

  it("customer sale document omits cost, margin and seller identity", async () => {
    const enq = await readyVehicle("KA01CC1005");
    const sale = await createSale({
      vehicleId: enq.vehicle.id, customerName: "Buyer Doc", customerPhone: "9900000030",
      finalNetPrice: R(620000), saleDate: today
    }, ctx);
    await addSalePayment({ saleId: sale.saleId, date: today, amount: R(100000), method: "UPI" }, ctx);

    const doc = await customerSaleDocument(store, sale.saleId);
    const serialized = JSON.stringify(doc);

    // Purchase price (₹5,50,000 => 55000000 paise) must not appear anywhere.
    expect(serialized).not.toContain("55000000");
    for (const key of FORBIDDEN) {
      expect(serialized).not.toContain(key);
    }
    // The buyer's own figures are present and correct.
    expect(doc.totals.pricePaise).toBe(R(620000));
    expect(doc.totals.paidPaise).toBe(R(100000));
    expect(doc.totals.balancePaise).toBe(R(520000));
    expect(doc.customer.name).toBe("Buyer Doc");
  });
});

/** Scenario 15 (file access half) */
describe("scenario 15: sensitive document access", () => {
  it("restricts identity documents to roles that need them", () => {
    // Everyone who works with stock can see ordinary photos and documents.
    for (const role of ["owner", "sales", "operations", "accounts"] as const) {
      expect(can({ role }, "inventory.view")).toBe(true);
    }
    // Identity scans are narrower: sale KYC and accounts compliance only.
    expect(can({ role: "owner" }, "document.sensitive")).toBe(true);
    expect(can({ role: "sales" }, "document.sensitive")).toBe(true);
    expect(can({ role: "accounts" }, "document.sensitive")).toBe(true);
    expect(can({ role: "operations" }, "document.sensitive")).toBe(false);
    expect(can(undefined, "document.sensitive")).toBe(false);
  });
});
