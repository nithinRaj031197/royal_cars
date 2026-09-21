import { getRepo, repoFor } from "@/lib/repo";
import { DataStore, WriteContext } from "@/lib/store/types";
import { parseCsv, toCsv } from "@/lib/csv";
import { looksLikeFormula, newOperationId } from "@/lib/ids";

export type ImportEntity = "Vehicles" | "Customers" | "Vendors" | "Expenses";

const FUEL_TYPES = ["Petrol", "Diesel", "CNG", "Electric", "Hybrid"] as const;
const TRANSMISSIONS = ["Manual", "Automatic"] as const;

export interface ImportTemplate {
  entity: ImportEntity;
  columns: string[];
  sample: string[];
  required: string[];
}

export const IMPORT_TEMPLATES: Record<ImportEntity, ImportTemplate> = {
  Vehicles: {
    entity: "Vehicles",
    columns: ["make", "model", "variant", "manufactureYear", "registrationYear", "fuel", "transmission", "bodyType", "colour", "ownershipCount", "odometerKm", "registrationNumber", "vin", "purchasePrice", "currentAskingPrice", "receivingDate"],
    sample: ["Maruti Suzuki", "Swift", "VXi", "2019", "2019", "Petrol", "Manual", "Hatchback", "White", "1", "42500", "KA01AB1234", "", "350000", "425000", "2024-05-10"],
    required: ["make", "model", "registrationNumber"]
  },
  Customers: {
    entity: "Customers",
    columns: ["name", "phone", "email", "address"],
    sample: ["Ramesh Kumar", "9876543210", "ramesh@example.com", "Indiranagar, Bengaluru"],
    required: ["name", "phone"]
  },
  Vendors: {
    entity: "Vendors",
    columns: ["name", "category", "phone", "email", "address", "gst"],
    sample: ["Sharma Motors", "Workshop", "9123456780", "work@example.com", "Peenya, Bengaluru", ""],
    required: ["name"]
  },
  Expenses: {
    entity: "Expenses",
    columns: ["stockRef", "category", "date", "amount", "payer", "reference", "notes"],
    sample: ["STK-00001", "Transportation", "2024-05-12", "4500", "Showroom", "LR-99120", ""],
    required: ["stockRef", "category", "date", "amount"]
  }
};

export function templateCsv(entity: ImportEntity): string {
  const t = IMPORT_TEMPLATES[entity];
  return toCsv([t.columns, t.sample]);
}

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportResult {
  batchId: string;
  totalRows: number;
  created: number;
  updated: number;
  errors: ImportRowError[];
}

/**
 * Imports a CSV with validation, duplicate detection by natural key
 * (registrationNumber for Vehicles, phone for Customers, name for Vendors),
 * and batch history for safe retry.
 */
export async function importCsv(
  entity: ImportEntity,
  csvText: string,
  mode: "create-only" | "upsert",
  ctx: WriteContext
): Promise<ImportResult> {
  const repo = getRepo();
  const store = repo.store;
  const operationId = ctx.operationId ?? newOperationId();
  const template = IMPORT_TEMPLATES[entity];
  const errors: ImportRowError[] = [];
  let created = 0;
  let updated = 0;

  // Retry safety: an already-completed batch with the same operation is skipped.
  const existingOps = await store.list("Operations", { activeOnly: false });
  const prior = existingOps.find((o) => o.id === operationId && o.status === "completed");
  if (prior) {
    const priorBatch = (await store.list("ImportBatches", { activeOnly: false })).find((b) => b.operationId === operationId);
    if (priorBatch) {
      return {
        batchId: priorBatch.id,
        totalRows: Number(priorBatch.totalRows ?? "0"),
        created: Number(priorBatch.createdCount ?? "0"),
        updated: Number(priorBatch.updatedCount ?? "0"),
        errors: JSON.parse(priorBatch.errorsJson || "[]")
      };
    }
  }

  const rows = parseCsv(csvText);
  if (rows.length < 2) throw Object.assign(new Error("CSV needs a header row and at least one data row."), { status: 400 });
  const header = rows[0] as string[];
  const missing = template.required.filter((c) => !header.includes(c));
  if (missing.length) throw Object.assign(new Error(`Missing required columns: ${missing.join(", ")}`), { status: 400 });

  const dataRows = rows.slice(1);

  for (let i = 0; i < dataRows.length; i++) {
    const raw = dataRows[i] as string[];
    const rowMap: Record<string, string> = {};
    header.forEach((h, j) => { rowMap[h] = (raw[j] ?? "").trim(); });
    const rowNum = i + 2;

    try {
      // A row with the wrong number of cells silently shifts every later value
      // into the wrong column, so reject it rather than importing bad data.
      if (raw.length !== header.length) {
        throw new Error(
          `Row has ${raw.length} value(s) but the header has ${header.length} column(s). ` +
          `Check for a missing or extra comma.`
        );
      }
      if (entity === "Vehicles") {
        const r = await importVehicleRow(store, rowMap, mode, ctx, operationId);
        if (r === "created") created++;
        if (r === "updated") updated++;
      } else if (entity === "Customers") {
        const r = await importCustomerRow(store, rowMap, mode, ctx, operationId);
        if (r === "created") created++;
        if (r === "updated") updated++;
      } else if (entity === "Vendors") {
        const r = await importVendorRow(store, rowMap, mode, ctx, operationId);
        if (r === "created") created++;
        if (r === "updated") updated++;
      } else if (entity === "Expenses") {
        const r = await importExpenseRow(store, rowMap, mode, ctx, operationId);
        if (r === "created") created++;
        if (r === "updated") updated++;
      } else {
        created++;
      }
    } catch (err) {
      errors.push({ row: rowNum, message: (err as Error).message });
    }
  }

  const batch = await repo.table("ImportBatches").create(
    {
      batchRef: `IMP-${Date.now().toString(36).toUpperCase()}`,
      entityType: entity,
      fileName: "",
      mode,
      totalRows: String(dataRows.length),
      createdCount: String(created),
      updatedCount: String(updated),
      errorCount: String(errors.length),
      errorsJson: JSON.stringify(errors),
      importedBy: ctx.actor,
      operationId
    },
    ctx
  );

  return { batchId: batch.id, totalRows: dataRows.length, created, updated, errors };
}

type RowOutcome = "created" | "updated" | "skipped";

async function importVehicleRow(
  store: DataStore, rowMap: Record<string, string>, mode: "create-only" | "upsert", ctx: WriteContext, operationId: string
): Promise<RowOutcome> {
  const repo = repoFor(store);
  const reg = rowMap.registrationNumber ?? "";
  if (!reg) throw new Error("registrationNumber is required");
  if (looksLikeFormula(reg)) throw new Error("Values starting with = + - @ are not allowed");
  const existing = (await repo.table("Vehicles").list()).find(
    (v) => (v.registrationNumber ?? "").toLowerCase() === reg.toLowerCase() && !v.archived
  );
  if (existing && mode === "create-only") {
    throw new Error(`Vehicle with registration ${reg} already exists (stock ${existing.stockRef})`);
  }
  const oneOf = (k: string, allowed: readonly string[], fallback: string): string => {
    const v = rowMap[k] ?? "";
    if (!v) return fallback;
    const match = allowed.find((a) => a.toLowerCase() === v.toLowerCase());
    if (!match) throw new Error(`${k} must be one of: ${allowed.join(", ")}`);
    return match;
  };
  const whole = (k: string, fallback: string, max: number): string => {
    const v = rowMap[k] ?? "";
    if (!v) return fallback;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > max) throw new Error(`${k} is not a valid whole number`);
    return String(n);
  };
  const money = (k: string): string => {
    const v = rowMap[k] ?? "";
    if (!v) return "0";
    const n = Number(v.replace(/[₹,\s]/g, ""));
    if (!Number.isFinite(n)) throw new Error(`${k} is not a valid amount`);
    return String(Math.round(n * 100));
  };
  const data: Record<string, string> = {
    make: rowMap.make ?? "",
    model: rowMap.model ?? "",
    variant: rowMap.variant ?? "",
    manufactureYear: whole("manufactureYear", "", new Date().getFullYear() + 1),
    registrationYear: whole("registrationYear", "", new Date().getFullYear() + 1),
    fuel: oneOf("fuel", FUEL_TYPES, "Petrol"),
    transmission: oneOf("transmission", TRANSMISSIONS, "Manual"),
    bodyType: rowMap.bodyType ?? "",
    colour: rowMap.colour ?? "",
    ownershipCount: whole("ownershipCount", "1", 20),
    odometerKm: whole("odometerKm", "0", 1_000_000),
    registrationNumber: reg,
    vin: rowMap.vin ?? "",
    purchasePricePaise: money("purchasePrice"),
    currentAskingPaise: money("currentAskingPrice"),
    receivingDate: rowMap.receivingDate ?? "",
    lifecycleState: "In preparation",
    publicationState: "Not published",
    showroomLocation: "Main"
  };
  if (existing) {
    await repo.table("Vehicles").update(existing.id, data, existing.version, { actor: ctx.actor, operationId });
    return "updated";
  }
  const { nextRef } = await import("./acquisitions");
  const stockRef = await nextRef(repo, "vehicle");
  await repo.table("Vehicles").create(
    { ...data, stockRef, purchaseDate: "", askingPricePaise: money("currentAskingPrice"), minimumPricePaise: "0", finalSalePricePaise: "0", sellerId: "", acquisitionCaseId: "", acquisitionNotes: "", publicSlug: "", publicTitle: "", publicDescription: "", publicFeatures: "", seoTitle: "", seoDescription: "", publishedAt: "" },
    { actor: ctx.actor, operationId }
  );
  return "created";
}

async function importCustomerRow(
  store: DataStore, rowMap: Record<string, string>, mode: "create-only" | "upsert", ctx: WriteContext, operationId: string
): Promise<RowOutcome> {
  const repo = repoFor(store);
  const phoneVal = rowMap.phone ?? "";
  if (!/^[+0-9][0-9\s-]{5,17}$/.test(phoneVal)) throw new Error("A valid phone is required");
  const existing = (await repo.table("Customers").list()).find((c) => c.phone === phoneVal && !c.archived);
  const data = { name: rowMap.name ?? "", phone: phoneVal, email: rowMap.email ?? "", address: rowMap.address ?? "", altPhone: "", idType: "", idNumberMasked: "", dob: "", anniversary: "", notes: "" };
  if (existing) {
    if (mode === "create-only") throw new Error(`Customer with phone ${phoneVal} already exists`);
    await repo.table("Customers").update(existing.id, data, existing.version, { actor: ctx.actor, operationId });
    return "updated";
  }
  await repo.table("Customers").create(data, { actor: ctx.actor, operationId });
  return "created";
}

async function importVendorRow(
  store: DataStore, rowMap: Record<string, string>, mode: "create-only" | "upsert", ctx: WriteContext, operationId: string
): Promise<RowOutcome> {
  const repo = repoFor(store);
  const name = rowMap.name ?? "";
  if (!name) throw new Error("name is required");
  const existing = (await repo.table("Vendors").list()).find((v) => (v.name ?? "").toLowerCase() === name.toLowerCase() && !v.archived);
  const data = { name, category: rowMap.category ?? "Other", phone: rowMap.phone ?? "", email: rowMap.email ?? "", address: rowMap.address ?? "", gst: rowMap.gst ?? "", notes: "", preferred: "FALSE" };
  if (existing) {
    if (mode === "create-only") throw new Error(`Vendor ${name} already exists`);
    await repo.table("Vendors").update(existing.id, data, existing.version, { actor: ctx.actor, operationId });
    return "updated";
  }
  await repo.table("Vendors").create(data, { actor: ctx.actor, operationId });
  return "created";
}

async function importExpenseRow(
  store: DataStore, rowMap: Record<string, string>, mode: "create-only" | "upsert", ctx: WriteContext, operationId: string
): Promise<RowOutcome> {
  const repo = repoFor(store);
  const stockRef = rowMap.stockRef ?? "";
  const vehicle = (await repo.table("Vehicles").list()).find((v) => v.stockRef === stockRef && !v.archived);
  if (!vehicle) throw new Error(`No vehicle with stock ref ${stockRef}`);
  const amountStr = rowMap.amount ?? "";
  const n = Number(amountStr.replace(/[₹,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) throw new Error("amount must be a positive number");
  const data = {
    vehicleId: vehicle.id,
    acquisitionCaseId: vehicle.acquisitionCaseId ?? "",
    saleId: "",
    serviceJobId: "",
    category: rowMap.category ?? "Miscellaneous",
    date: rowMap.date ?? "",
    amountPaise: String(Math.round(n * 100)),
    payer: rowMap.payer || "Showroom",
    vendorId: "",
    reference: rowMap.reference ?? "",
    notes: rowMap.notes ?? "",
    documentFileId: "",
    recordedBy: ctx.actor
  };
  // Duplicate detection: same vehicle/category/date/amount/reference.
  const dup = (await repo.table("Expenses").list()).find(
    (e) => e.vehicleId === data.vehicleId && e.category === data.category && e.date === data.date && e.amountPaise === data.amountPaise && (e.reference ?? "") === data.reference
  );
  if (dup && mode === "create-only") throw new Error("Identical expense row already imported");
  if (dup) return "skipped"; // idempotent upsert
  await repo.table("Expenses").create(
    { ...data, expenseRef: `EXP-${Date.now().toString(36).toUpperCase()}` },
    { actor: ctx.actor, operationId }
  );
  return "created";
}
