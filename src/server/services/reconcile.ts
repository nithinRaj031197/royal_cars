import { DataStore } from "@/lib/store/types";
import type { TableName } from "@/lib/store/tables";

export interface ReconcileIssue {
  severity: "error" | "warning";
  entity: string;
  id?: string;
  problem: string;
}

/**
 * Read-only consistency report. Manual spreadsheet edits bypass application
 * validation, so run this after any direct edits to find damage early.
 */
export async function reconcile(store: DataStore): Promise<ReconcileIssue[]> {
  const issues: ReconcileIssue[] = [];
  const idsOf = (table: TableName) => store.list(table, { activeOnly: false }).then((rows) => new Set(rows.map((r) => r.id)));

  const [vehicles, cases, sellers, customers, vendors, sales, reservations, work, purchasePayments, salePayments, expenses, ops] =
    await Promise.all([
      store.list("Vehicles", { activeOnly: false }),
      store.list("AcquisitionCases", { activeOnly: false }),
      store.list("Sellers", { activeOnly: false }),
      store.list("Customers", { activeOnly: false }),
      store.list("Vendors", { activeOnly: false }),
      store.list("Sales", { activeOnly: false }),
      store.list("Reservations", { activeOnly: false }),
      store.list("WorkOrders", { activeOnly: false }),
      store.list("PurchasePayments", { activeOnly: false }),
      store.list("SalePayments", { activeOnly: false }),
      store.list("Expenses", { activeOnly: false }),
      store.list("Operations", { activeOnly: false })
    ]);
  const vehicleIds = new Set(vehicles.map((r) => r.id));
  void idsOf;

  // Duplicate IDs (possible after manual row duplication).
  for (const [name, rows] of Object.entries({ Vehicles: vehicles, Sales: sales, AcquisitionCases: cases, Customers: customers })) {
    const seen = new Map<string, number>();
    for (const r of rows) seen.set(r.id, (seen.get(r.id) ?? 0) + 1);
    for (const [id, n] of seen) if (n > 1) issues.push({ severity: "error", entity: name, id, problem: `ID appears ${n} times (duplicate row?)` });
  }

  // Broken references.
  for (const c of cases) {
    if (c.vehicleId && !vehicleIds.has(c.vehicleId)) issues.push({ severity: "error", entity: "AcquisitionCases", id: c.id, problem: "vehicleId does not exist" });
    if (c.sellerId && !sellers.some((s) => s.id === c.sellerId)) issues.push({ severity: "error", entity: "AcquisitionCases", id: c.id, problem: "sellerId does not exist" });
  }
  for (const v of vehicles) {
    if (v.sellerId && !sellers.some((s) => s.id === v.sellerId)) issues.push({ severity: "warning", entity: "Vehicles", id: v.id, problem: "sellerId does not exist" });
  }
  for (const w of work) {
    if (w.vehicleId && !vehicleIds.has(w.vehicleId)) issues.push({ severity: "error", entity: "WorkOrders", id: w.id, problem: "vehicleId does not exist" });
    if (w.vendorId && !vendors.some((x) => x.id === w.vendorId)) issues.push({ severity: "warning", entity: "WorkOrders", id: w.id, problem: "vendorId does not exist" });
  }
  for (const s of sales) {
    if (s.vehicleId && !vehicleIds.has(s.vehicleId)) issues.push({ severity: "error", entity: "Sales", id: s.id, problem: "vehicleId does not exist" });
    if (s.customerId && !customers.some((x) => x.id === s.customerId)) issues.push({ severity: "error", entity: "Sales", id: s.id, problem: "customerId does not exist" });
  }

  // Invalid amounts.
  const checkAmount = (entity: string, id: string, field: string, raw?: string, allowNegative = false) => {
    if (raw === undefined || raw === "") return;
    const n = Number(raw);
    if (!Number.isFinite(n) || (!allowNegative && n < 0)) {
      issues.push({ severity: "error", entity, id, problem: `${field} is not a valid ${allowNegative ? "signed " : ""}amount: "${raw}"` });
    }
  };
  for (const p of purchasePayments) checkAmount("PurchasePayments", p.id, "amountPaise", p.amountPaise);
  for (const p of salePayments) checkAmount("SalePayments", p.id, "amountPaise", p.amountPaise, true);
  for (const e of expenses) checkAmount("Expenses", e.id, "amountPaise", e.amountPaise);

  // Competing active reservations/sales on one vehicle.
  const byVehicle = new Map<string, number>();
  for (const r of reservations) {
    if (r.status !== "Active") continue;
    const key = r.vehicleId ?? "";
    byVehicle.set(key, (byVehicle.get(key) ?? 0) + 1);
  }
  for (const [vehicleId, n] of byVehicle) {
    if (n > 1) issues.push({ severity: "error", entity: "Reservations", id: vehicleId, problem: `${n} active reservations on one vehicle` });
  }

  // Incomplete operations (pending for > 1 day).
  const dayAgo = Date.now() - 86_400_000;
  for (const o of ops) {
    if (o.status === "pending" && o.createdAt && new Date(o.createdAt).getTime() < dayAgo) {
      issues.push({ severity: "warning", entity: "Operations", id: o.id, problem: `Operation ${o.kind} stuck pending (attempted ${o.attempts} times)` });
    }
  }

  return issues;
}
