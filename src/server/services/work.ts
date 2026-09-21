import { getRepo, repoFor } from "@/lib/repo";
import { DataStore, RecordRow, WriteContext } from "@/lib/store/types";

import { newOperationId } from "@/lib/ids";
import { sumPaise } from "@/lib/money";
import { accessoryInputSchema, expenseInputSchema, workOrderInputSchema } from "@/lib/form-schemas";
import type { AccessoryInput, ExpenseInput, WorkOrderInput } from "@/lib/form-schemas";

// Schemas live in @/lib/form-schemas so forms and routes validate identically.
export { accessoryInputSchema, expenseInputSchema, workOrderInputSchema };
export type { AccessoryInput, ExpenseInput, WorkOrderInput };

/** ---------- Work orders ---------- */

function woRef(): string {
  return `WO-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
}

export async function createWorkOrder(input: WorkOrderInput, ctx: WriteContext): Promise<RecordRow> {
  const repo = getRepo();
  const wctx: WriteContext = { actor: ctx.actor, operationId: ctx.operationId ?? newOperationId() };
  const vehicle = await repo.table("Vehicles").get(input.vehicleId);
  if (!vehicle) throw Object.assign(new Error("Vehicle not found"), { status: 404 });

  const wo = await repo.table("WorkOrders").create(
    {
      workOrderRef: woRef(),
      vehicleId: vehicle.id,
      acquisitionCaseId: input.acquisitionCaseId || vehicle.acquisitionCaseId || "",
      saleId: input.saleId ?? "",
      stage: input.stage,
      issue: input.issue ?? "",
      requiredWork: input.requiredWork ?? "",
      category: input.category || "General",
      vendorId: input.vendorId ?? "",
      assignedTo: input.assignedTo || ctx.actor,
      estimatedPaise: String(input.estimated ?? 0),
      actualPaise: "0",
      partsPaise: "0",
      labourPaise: "0",
      otherPaise: "0",
      taxPaise: "0",
      discountPaise: "0",
      startDate: input.startDate ?? "",
      expectedCompletionDate: input.expectedCompletionDate ?? "",
      completedOn: "",
      odometerKm: String(input.odometerKm ?? 0),
      status: "Draft",
      payer: input.payer ?? "Showroom",
      approvedBy: "",
      approvalNotes: "",
      completionNotes: "",
      invoiceNumber: "",
      invoiceAmountPaise: "0",
      invoiceDocumentId: "",
      linkedWorkOrderRef: input.linkedWorkOrderRef ?? ""
    },
    wctx
  );
  await repo.logActivity(wctx, "work.create", "WorkOrders", wo.id,
    `Work order created for ${vehicle.stockRef}: ${input.issue}`);
  return wo;
}

export async function approveWorkOrder(woId: string, notes: string, ctx: WriteContext) {
  const repo = getRepo();
  const wo = await repo.table("WorkOrders").get(woId);
  if (!wo) throw Object.assign(new Error("Work order not found"), { status: 404 });
  if (wo.status !== "Draft") throw Object.assign(new Error("Only draft work orders can be approved."), { status: 400 });
  const updated = await repo.table("WorkOrders").update(
    woId,
    { status: "Approved", approvedBy: ctx.actor, approvalNotes: notes ?? "" },
    wo.version,
    ctx
  );
  await repo.logStatusChange(ctx, "WorkOrders", woId, "Draft", "Approved", notes);
  return updated;
}

export async function startWorkOrder(woId: string, ctx: WriteContext) {
  const repo = getRepo();
  const wo = await repo.table("WorkOrders").get(woId);
  if (!wo) throw Object.assign(new Error("Work order not found"), { status: 404 });
  if (!["Draft", "Approved"].includes(wo.status ?? "")) {
    throw Object.assign(new Error("Only approved work can be started."), { status: 400 });
  }
  const updated = await repo.table("WorkOrders").update(
    woId,
    { status: "In progress", startDate: wo.startDate || new Date().toISOString().slice(0, 10) },
    wo.version,
    ctx
  );
  await repo.logStatusChange(ctx, "WorkOrders", woId, wo.status ?? "", "In progress");
  return updated;
}

/** Completes a work order. Actual costs are posted from the invoice breakdown; estimate stays separate. */
export async function completeWorkOrder(
  woId: string,
  // An old invoice may only give a total, so each component is optional and
  // treated as zero when absent.
  input: {
    parts?: number;
    labour?: number;
    other?: number;
    tax?: number;
    discount?: number;
    invoiceNumber?: string;
    completionNotes?: string;
    completedOn: string;
  },
  ctx: WriteContext
) {
  const repo = getRepo();
  const wo = await repo.table("WorkOrders").get(woId);
  if (!wo) throw Object.assign(new Error("Work order not found"), { status: 404 });
  if (wo.status === "Cancelled") throw Object.assign(new Error("Cancelled work cannot be completed."), { status: 400 });
  // A component that was never recorded contributes nothing.
  const parts = input.parts ?? 0;
  const labour = input.labour ?? 0;
  const other = input.other ?? 0;
  const tax = input.tax ?? 0;
  const discount = input.discount ?? 0;
  const actual = parts + labour + other + tax - discount;
  if (actual < 0) throw Object.assign(new Error("Actual cost cannot be negative."), { status: 400 });
  const updated = await repo.table("WorkOrders").update(
    woId,
    {
      status: "Completed",
      actualPaise: String(actual),
      partsPaise: String(parts),
      labourPaise: String(labour),
      otherPaise: String(other),
      taxPaise: String(tax),
      discountPaise: String(discount),
      invoiceNumber: input.invoiceNumber ?? "",
      // The invoice total is informational only; actualPaise (line breakdown) is canonical.
      invoiceAmountPaise: String(actual),
      completionNotes: input.completionNotes ?? "",
      completedOn: input.completedOn
    },
    wo.version,
    ctx
  );
  await repo.logStatusChange(ctx, "WorkOrders", woId, wo.status ?? "", "Completed");
  await repo.logActivity(ctx, "work.complete", "WorkOrders", woId,
    `Work order ${wo.workOrderRef} completed; actual cost ₹${(actual / 100).toLocaleString("en-IN")}`);
  return updated;
}

export async function cancelWorkOrder(woId: string, reason: string, ctx: WriteContext) {
  const repo = getRepo();
  const wo = await repo.table("WorkOrders").get(woId);
  if (!wo) throw Object.assign(new Error("Work order not found"), { status: 404 });
  if (wo.status === "Completed") {
    throw Object.assign(new Error("Completed work cannot be cancelled; post a reversal expense instead."), { status: 400 });
  }
  const updated = await repo.table("WorkOrders").update(
    woId,
    { status: "Cancelled", completionNotes: reason ?? "" },
    wo.version,
    ctx
  );
  await repo.logStatusChange(ctx, "WorkOrders", woId, wo.status ?? "", "Cancelled", reason);
  return updated;
}

/** ---------- Accessories ---------- */

export async function addAccessory(input: AccessoryInput, ctx: WriteContext) {
  const repo = getRepo();
  const wctx: WriteContext = { actor: ctx.actor, operationId: ctx.operationId ?? newOperationId() };
  const vehicle = await repo.table("Vehicles").get(input.vehicleId);
  if (!vehicle) throw Object.assign(new Error("Vehicle not found"), { status: 404 });
  const quantity = input.quantity ?? 1;
  const total = input.unitCost * quantity;
  const acc = await repo.table("Accessories").create(
    {
      vehicleId: vehicle.id,
      acquisitionCaseId: vehicle.acquisitionCaseId || "",
      item: input.item ?? "",
      quantity: String(quantity),
      unitCostPaise: String(input.unitCost),
      totalPaise: String(total),
      vendorId: input.vendorId ?? "",
      installedOn: input.installedOn ?? "",
      required: input.required ? "TRUE" : "FALSE",
      workOrderId: input.workOrderId ?? "",
      documentFileId: "",
      notes: input.notes ?? "",
      payer: input.payer ?? "Showroom"
    },
    wctx
  );
  await repo.logActivity(wctx, "accessory.create", "Accessories", acc.id,
    `Accessory added to ${vehicle.stockRef}: ${input.item}${input.workOrderId ? " (billed in work order)" : ""}`);
  return acc;
}

/** ---------- Expenses ---------- */

export async function addExpense(input: ExpenseInput, ctx: WriteContext) {
  const repo = getRepo();
  const wctx: WriteContext = { actor: ctx.actor, operationId: ctx.operationId ?? newOperationId() };
  const vehicle = await repo.table("Vehicles").get(input.vehicleId);
  if (!vehicle) throw Object.assign(new Error("Vehicle not found"), { status: 404 });
  const exp = await repo.table("Expenses").create(
    {
      expenseRef: `EXP-${Date.now().toString(36).toUpperCase()}`,
      vehicleId: vehicle.id,
      acquisitionCaseId: vehicle.acquisitionCaseId || "",
      saleId: input.saleId ?? "",
      serviceJobId: input.serviceJobId ?? "",
      category: input.category,
      date: input.date,
      amountPaise: String(input.amount),
      payer: input.payer ?? "Showroom",
      vendorId: input.vendorId ?? "",
      reference: input.reference ?? "",
      notes: input.notes ?? "",
      documentFileId: "",
      recordedBy: ctx.actor
    },
    wctx
  );
  await repo.logActivity(wctx, "expense.create", "Expenses", exp.id,
    `Expense ${input.category} on ${vehicle.stockRef}`);
  return exp;
}

/** ---------- Financial projections ---------- */

export interface InvestmentBreakdown {
  purchase: number;
  repairs: number;
  accessories: number;
  other: number;
  total: number;
}

/**
 * Canonical pre-sale investment rule:
 *  - purchase price from the vehicle record
 *  - completed, showroom-paid pre-sale work orders → actualPaise (canonical posted cost)
 *  - accessories NOT linked to a work order (linked ones live inside the WO actual)
 *  - other showroom-paid expenses excluding Repair/Accessories categories
 */
export async function investmentBreakdown(store: DataStore, vehicleId: string): Promise<InvestmentBreakdown> {
  const repo = repoFor(store);
  const v = await repo.table("Vehicles").get(vehicleId);
  if (!v) throw Object.assign(new Error("Vehicle not found"), { status: 404 });

  const workOrders = (await repo.table("WorkOrders").list()).filter(
    (w) => w.vehicleId === vehicleId && w.status === "Completed" && w.payer === "Showroom" &&
      ["Pre-purchase", "Inventory preparation"].includes(w.stage ?? "")
  );
  const accessories = (await repo.table("Accessories").list()).filter(
    (a) => a.vehicleId === vehicleId && a.payer === "Showroom" && !a.workOrderId
  );
  const expenses = (await repo.table("Expenses").list()).filter(
    (e) => e.vehicleId === vehicleId && e.payer === "Showroom" && !e.saleId &&
      !["Repair", "Accessories"].includes(e.category ?? "")
  );

  const purchase = Number(v.purchasePricePaise ?? "0");
  const repairs = sumPaise(workOrders.map((w) => Number(w.actualPaise ?? "0")));
  const acc = sumPaise(accessories.map((a) => Number(a.totalPaise ?? "0")));
  const other = sumPaise(expenses.map((e) => Number(e.amountPaise ?? "0")));
  return { purchase, repairs, accessories: acc, other, total: purchase + repairs + acc + other };
}

/** Showroom-funded after-sale costs (after-sale work orders + showroom-paid service jobs). */
export async function afterSaleCosts(store: DataStore, vehicleId: string) {
  const repo = repoFor(store);
  const workOrders = (await repo.table("WorkOrders").list()).filter(
    (w) => w.vehicleId === vehicleId && w.status === "Completed" && w.payer === "Showroom" && w.stage === "After-sale"
  );
  // ServiceJobs carries no payer of its own — who pays is decided on the parent
  // ServiceRequest. Filtering on j.payer silently matched nothing, so showroom-
  // funded after-sale work was reported as zero.
  const requests = await repo.table("ServiceRequests").list();
  const showroomFunded = new Set(
    requests.filter((r) => r.vehicleId === vehicleId && (r.payer ?? "Showroom") === "Showroom").map((r) => r.id)
  );
  const jobs = (await repo.table("ServiceJobs").list()).filter(
    (j) => j.vehicleId === vehicleId && showroomFunded.has(j.serviceRequestId ?? "")
  );
  const woTotal = sumPaise(workOrders.map((w) => Number(w.actualPaise ?? "0")));
  const jobTotal = sumPaise(jobs.map((j) => Number(j.totalPaise ?? "0")));
  return { workOrders: woTotal, serviceJobs: jobTotal, total: woTotal + jobTotal };
}
