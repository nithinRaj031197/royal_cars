import { z } from "zod";
import { getRepo } from "@/lib/repo";
import { WriteContext } from "@/lib/store/types";
import { priceChangeInputSchema } from "@/lib/form-schemas";
import type { PriceChangeInput } from "@/lib/form-schemas";

// Schemas live in @/lib/form-schemas so forms and routes validate identically.
export { priceChangeInputSchema };
export type { PriceChangeInput };

const COLUMN_FOR_KIND: Record<string, string> = {
  "Asking": "askingPricePaise",
  "Current asking": "currentAskingPaise",
  "Minimum": "minimumPricePaise"
};

export async function changePrice(input: PriceChangeInput, ctx: WriteContext) {
  const repo = getRepo();
  const v = await repo.table("Vehicles").get(input.vehicleId);
  if (!v) throw Object.assign(new Error("Vehicle not found"), { status: 404 });

  const column: string = COLUMN_FOR_KIND[input.kind] ?? "currentAskingPaise";
  const previous = Number(v[column] ?? "0");
  const patch: Record<string, string> = { [column]: String(input.amount) };
  // Setting the initial asking price also establishes the current asking price:
  // the car is listed at that figure until someone explicitly changes it. Only
  // seed it while unset, so correcting the initial figure later cannot silently
  // undo a real current-asking change.
  if (input.kind === "Asking" && Number(v.currentAskingPaise ?? "0") === 0) {
    patch.currentAskingPaise = String(input.amount);
  }
  const updated = await repo.table("Vehicles").update(v.id, patch, v.version, ctx);

  await repo.table("PriceHistory").create(
    {
      vehicleId: v.id,
      date: input.date,
      kind: input.kind,
      amountPaise: String(input.amount),
      previousPaise: String(previous ?? 0),
      reason: input.reason,
      setBy: ctx.actor
    },
    ctx
  );

  await repo.logActivity(ctx, "price.change", "Vehicles", v.id,
    `${input.kind} price for ${v.stockRef} set to ₹${(input.amount / 100).toLocaleString("en-IN")}: ${input.reason}`);
  return { vehicle: updated, previous };
}

/** ---------- Vehicle lifecycle state machine ---------- */

export type VehicleState =
  | "In acquisition pipeline"
  | "In preparation"
  | "Ready for sale"
  | "Reserved"
  | "Sold"
  | "Delivered"
  | "Archived";

export const stateTransitionInputSchema = z.object({
  vehicleId: z.string().min(1),
  to: z.enum(["In preparation", "Ready for sale", "Archived"]),
  reason: z.string().optional().default("")
});

/**
 * Controlled lifecycle transitions with prerequisites.
 * Reservation/Sold/Delivered states are set by their own services.
 */
export async function transitionVehicleState(
  vehicleId: string,
  to: "In preparation" | "Ready for sale" | "Archived",
  reason: string,
  ctx: WriteContext
) {
  const repo = getRepo();
  const v = await repo.table("Vehicles").get(vehicleId);
  if (!v) throw Object.assign(new Error("Vehicle not found"), { status: 404 });
  const from = v.lifecycleState ?? "";

  if (to === "Ready for sale") {
    // Prerequisite: at least one completed receiving/pre-delivery inspection.
    const inspections = (await repo.table("Inspections").list()).filter((i) => i.vehicleId === vehicleId);
    const hasReceivingOrPreDelivery = inspections.some((i) => i.type === "Receiving" || i.type === "Pre-delivery");
    if (!hasReceivingOrPreDelivery) {
      throw Object.assign(
        new Error("A receiving or pre-delivery inspection is required before marking Ready for sale."),
        { status: 400 }
      );
    }
    // Mandatory work orders must be completed or cancelled.
    const openWork = (await repo.table("WorkOrders").list()).filter(
      (w) => w.vehicleId === vehicleId &&
        ["Draft", "Approved", "In progress"].includes(w.status ?? "") &&
        w.payer === "Showroom" &&
        ["Pre-purchase", "Inventory preparation", "Pre-delivery"].includes(w.stage ?? "")
    );
    if (openWork.length > 0) {
      throw Object.assign(
        new Error(`Cannot mark Ready for sale: ${openWork.length} work order(s) still open. Complete or cancel them first.`),
        { status: 400 }
      );
    }
  }

  if (to === "Archived" && !reason) {
    throw Object.assign(new Error("A reason is required to archive a vehicle."), { status: 400 });
  }

  await repo.table("Vehicles").update(vehicleId, { lifecycleState: to }, v.version, ctx);
  await repo.logStatusChange(ctx, "Vehicles", vehicleId, from, to, reason);
  await repo.logActivity(ctx, "vehicle.state", "Vehicles", vehicleId, `${v.stockRef}: ${from} → ${to}`);
}
