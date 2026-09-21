import { getRepo } from "@/lib/repo";
import { WriteContext } from "@/lib/store/types";

import { newOperationId } from "@/lib/ids";
import { CriticalAction } from "@/lib/store/actions";
import { saleBalances } from "./sales";
import { completeDeliveryInputSchema } from "@/lib/form-schemas";
import type { CompleteDeliveryInput } from "@/lib/form-schemas";

// Schemas live in @/lib/form-schemas so forms and routes validate identically.
export { completeDeliveryInputSchema };
export type { CompleteDeliveryInput };

export interface DeliveryItem {
  kind: string;
  label: string;
  mandatory: boolean;
  done: boolean;
  note: string;
}

/** Configurable default checklist template (overridable in Settings). */
export function defaultChecklistTemplate(): DeliveryItem[] {
  return [
    { kind: "Final inspection", label: "Final inspection (pre-delivery inspection completed)", mandatory: true, done: false, note: "" },
    { kind: "Promised repairs", label: "All promised repairs completed", mandatory: true, done: false, note: "" },
    { kind: "Cleaning & preparation", label: "Vehicle cleaned and detailed", mandatory: true, done: false, note: "" },
    { kind: "Keys & accessories", label: "Both keys and accessories handed over", mandatory: true, done: false, note: "" },
    { kind: "Required documents", label: "RC, insurance, and sale documents given", mandatory: true, done: false, note: "" },
    { kind: "Payment review", label: "Payment review — balance settled or approved exception", mandatory: true, done: false, note: "" },
    { kind: "Handover acknowledgement", label: "Customer acknowledgement recorded", mandatory: true, done: false, note: "" }
  ] as DeliveryItem[];
}

export async function completeDelivery(input: CompleteDeliveryInput, ctx: WriteContext) {
  const repo = getRepo();
  const wctx: WriteContext = { actor: ctx.actor, operationId: ctx.operationId ?? newOperationId() };

  const sale = await repo.table("Sales").get(input.saleId);
  if (!sale) throw Object.assign(new Error("Sale not found"), { status: 404 });
  if (sale.status === "Cancelled") throw Object.assign(new Error("Sale was cancelled."), { status: 400 });

  const balances = await saleBalances(repo.store, input.saleId);
  const outstanding = balances.balance;
  const hasException = outstanding > 0;

  if (hasException && !input.allowOutstandingBalance) {
    throw Object.assign(
      new Error(`Balance of ₹${(outstanding / 100).toLocaleString("en-IN")} is outstanding. Settle it or record an approved exception.`),
      { status: 400 }
    );
  }
  if (hasException && input.allowOutstandingBalance && !input.exceptionReason) {
    throw Object.assign(new Error("An exception reason is required when delivering with outstanding balance."), { status: 400 });
  }

  const mandatoryPending = input.items.filter((i) => i.mandatory && !i.done);
  if (mandatoryPending.length > 0 && !hasException) {
    throw Object.assign(new Error(`Mandatory checklist items incomplete: ${mandatoryPending.map((i) => i.label).join(", ")}`), { status: 400 });
  }

  // With an approved exception, mandatory payment review must be explicitly done/annotated.
  const mandatoryStillPending = mandatoryPending.filter((i) => i.kind !== "Payment review");
  if (hasException && mandatoryStillPending.length > 0) {
    throw Object.assign(new Error(`Mandatory items still incomplete: ${mandatoryStillPending.map((i) => i.label).join(", ")}`), { status: 400 });
  }

  // Delivery flips the sale to Delivered and the vehicle to Delivered together.
  // Both run under the serialization lock so a delivery cannot interleave with a
  // competing reservation/sale write on the same vehicle, and a retry of the same
  // operationId cannot deliver twice.
  const vehicleBefore = await repo.table("Vehicles").get(sale.vehicleId ?? "");
  const actions: CriticalAction[] = [
    {
      type: "assert-field",
      table: "Sales",
      id: input.saleId,
      field: "status",
      notEquals: "Delivered",
      message: "This sale has already been delivered.",
      status: 409
    },
    {
      type: "create",
      table: "DeliveryChecklists",
      as: "checklist",
      data: {
        checklistRef: `DLV-${Date.now().toString(36).toUpperCase()}`,
        saleId: input.saleId,
        vehicleId: sale.vehicleId ?? "",
        deliveryDate: input.deliveryDate,
        odometerKm: String(input.odometerKm),
        itemsJson: JSON.stringify(input.items),
        allMandatoryDone: mandatoryPending.length === 0 ? "TRUE" : "FALSE",
        balanceOutstandingPaise: String(outstanding),
        exceptionApprovedBy: hasException ? ctx.actor : "",
        exceptionReason: input.exceptionReason ?? "",
        acknowledgedBy: ctx.actor,
        acknowledgedAt: new Date().toISOString(),
        instructions: input.instructions ?? "",
        status: "Completed"
      }
    },
    {
      type: "update",
      table: "Sales",
      id: input.saleId,
      expectedVersion: sale.version,
      data: {
        status: "Delivered",
        deliveryDate: input.deliveryDate,
        deliveryChecklistId: "$ref:checklist"
      }
    }
  ];
  if (vehicleBefore && vehicleBefore.lifecycleState !== "Delivered") {
    actions.push({
      type: "update",
      table: "Vehicles",
      id: vehicleBefore.id,
      expectedVersion: vehicleBefore.version,
      data: { lifecycleState: "Delivered" }
    });
  }

  const result = await repo.store.runCritical(
    { operationId: wctx.operationId!, kind: "delivery.complete", entityType: "Sales", entityId: input.saleId, actor: ctx.actor },
    actions
  );

  const checklistId = result.refIds.checklist ?? "";
  const checklist = await repo.table("DeliveryChecklists").get(checklistId);
  if (!checklist) throw Object.assign(new Error("Delivery checklist not found after creation"), { status: 500 });

  if (vehicleBefore && vehicleBefore.lifecycleState !== "Delivered") {
    await repo.logStatusChange(wctx, "Vehicles", vehicleBefore.id, vehicleBefore.lifecycleState ?? "", "Delivered", "Delivery completed");
  }

  await repo.logActivity(wctx, "delivery.complete", "DeliveryChecklists", checklist.id,
    `Delivery completed for ${sale.saleRef}${hasException ? " with approved balance exception" : ""}`);

  // Return the sale as it now stands, not the pre-update snapshot.
  const updatedSale = await repo.table("Sales").get(input.saleId);
  return { checklist, sale: updatedSale ?? sale };
}
