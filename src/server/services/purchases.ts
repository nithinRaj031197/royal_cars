import { getRepo, repoFor } from "@/lib/repo";
import { DataStore, WriteContext } from "@/lib/store/types";

import { newOperationId } from "@/lib/ids";
import { sumPaise } from "@/lib/money";
import { CriticalAction } from "@/lib/store/actions";
import { purchasePaymentInputSchema } from "@/lib/form-schemas";
import type { PurchasePaymentInput } from "@/lib/form-schemas";

// Schemas live in @/lib/form-schemas so forms and routes validate identically.
export { purchasePaymentInputSchema };
export type { PurchasePaymentInput };

/** Records a payment to the seller. Serialized + idempotent via the Operations tab. */
export async function addPurchasePayment(input: PurchasePaymentInput, ctx: WriteContext) {
  const repo = getRepo();
  const store = repo.store;
  const operationId = ctx.operationId ?? newOperationId();

  // Idempotency: an already-completed operation is not applied twice.
  const ops = await store.list("Operations", { activeOnly: false });
  if (ops.some((o) => o.id === operationId && o.status === "completed")) {
    throw Object.assign(new Error("This payment was already recorded."), { status: 409 });
  }

  const acq = await repo.table("AcquisitionCases").get(input.acquisitionCaseId);
  if (!acq) throw Object.assign(new Error("Acquisition case not found"), { status: 404 });
  const vehicle = await repo.table("Vehicles").get(acq.vehicleId ?? "");
  if (!vehicle) throw Object.assign(new Error("Vehicle not found"), { status: 404 });

  const payments = (await repo.table("PurchasePayments").list()).filter((p) => p.acquisitionCaseId === input.acquisitionCaseId);
  const paid = sumPaise(payments.map((p) => Number(p.amountPaise ?? "0")));
  const purchasePrice = Number(vehicle.purchasePricePaise ?? "0");
  if (paid + input.amount > purchasePrice) {
    throw Object.assign(
      new Error(`Payment exceeds the agreed purchase price (₹${((purchasePrice - paid) / 100).toLocaleString("en-IN")} outstanding).`),
      { status: 400 }
    );
  }

  const paymentRef = `PP-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
  const actions: CriticalAction[] = [
    // Re-checked under the lock: see the note in sales.addSalePayment.
    {
      type: "assert-sum",
      table: "PurchasePayments",
      field: "amountPaise",
      where: [{ field: "acquisitionCaseId", equals: input.acquisitionCaseId }],
      plus: input.amount,
      notGreaterThan: purchasePrice,
      message: "Payment exceeds the agreed purchase price for this vehicle.",
      status: 400
    },
    {
      type: "create",
      table: "PurchasePayments",
      data: {
        paymentRef,
        acquisitionCaseId: input.acquisitionCaseId,
        vehicleId: vehicle.id,
        sellerId: vehicle.sellerId ?? "",
        date: input.date,
        amountPaise: String(input.amount),
        method: input.method,
        reference: input.reference ?? "",
        notes: input.notes ?? "",
        documentFileId: input.documentFileId ?? "",
        recordedBy: ctx.actor
      }
    }
  ];

  await store.runCritical(
    { operationId, kind: "purchase.payment", entityType: "PurchasePayments", entityId: input.acquisitionCaseId, actor: ctx.actor, payload: input },
    actions
  );

  await repo.logActivity({ actor: ctx.actor, operationId }, "purchase.payment", "PurchasePayments", input.acquisitionCaseId,
    `Seller payment ₹${(input.amount / 100).toLocaleString("en-IN")} (${input.method}) for ${vehicle.stockRef}`);
  return { paymentRef, paid: paid + input.amount, outstanding: purchasePrice - paid - input.amount };
}

/** Seller balance for an acquisition case, derived from payment history. */
export async function sellerBalance(store: DataStore, acquisitionCaseId: string) {
  const repo = repoFor(store);
  const acq = await repo.table("AcquisitionCases").get(acquisitionCaseId);
  if (!acq) throw Object.assign(new Error("Acquisition case not found"), { status: 404 });
  const vehicle = await repo.table("Vehicles").get(acq.vehicleId ?? "");
  const purchasePrice = Number(vehicle?.purchasePricePaise ?? "0");
  const payments = (await repo.table("PurchasePayments").list()).filter((p) => p.acquisitionCaseId === acquisitionCaseId);
  const paid = sumPaise(payments.map((p) => Number(p.amountPaise ?? "0")));
  return { purchasePrice, paid, outstanding: purchasePrice - paid, payments };
}

/**
 * Records/updates the agreed purchase price at approval time and marks the
 * case Approved. The vehicle record carries the canonical purchase price.
 */
export async function approveAcquisition(
  caseId: string,
  agreedPricePaise: number,
  ctx: WriteContext
) {
  const repo = getRepo();
  const acq = await repo.table("AcquisitionCases").get(caseId);
  if (!acq) throw Object.assign(new Error("Acquisition case not found"), { status: 404 });
  await repo.table("AcquisitionCases").update(
    caseId,
    { status: "Approved", agreedPricePaise: String(agreedPricePaise), offeredPricePaise: acq.offeredPricePaise || String(agreedPricePaise) },
    acq.version,
    ctx
  );
  const vehicle = await repo.table("Vehicles").get(acq.vehicleId ?? "");
  if (vehicle) {
    await repo.table("Vehicles").update(vehicle.id, { purchasePricePaise: String(agreedPricePaise) }, vehicle.version, ctx);
  }
  await repo.logActivity(ctx, "acquisition.approve", "AcquisitionCases", caseId,
    `Acquisition approved at ₹${(agreedPricePaise / 100).toLocaleString("en-IN")}`);
}
