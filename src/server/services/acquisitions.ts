import { z } from "zod";
import { getRepo, Repo } from "@/lib/repo";
import { WriteContext } from "@/lib/store/types";
import { EnquiryInput, enquiryInputSchema } from "@/lib/form-schemas";
import { makeRef, newOperationId, REF_PREFIXES } from "@/lib/ids";
import { todayDateOnly } from "@/lib/dates";

export { enquiryInputSchema };
export type { EnquiryInput };
void z;

/** Next sequential reference for a table, stored in Settings to survive restarts. */
export async function nextRef(repo: Repo, prefixKey: keyof typeof REF_PREFIXES): Promise<string> {
  const prefix = REF_PREFIXES[prefixKey];
  const counterKey = `ref:${prefix}`;
  const raw = await repo.getSetting(counterKey);
  const n = Number(raw ?? "0") + 1;
  await repo.setSetting(counterKey, String(n), { actor: "system" });
  return makeRef(prefix, n);
}

export async function createEnquiry(input: EnquiryInput, ctx: WriteContext) {
  const repo = getRepo();
  const opId = ctx.operationId ?? newOperationId();
  const wctx: WriteContext = { actor: ctx.actor, operationId: opId };

  const seller = await repo.table("Sellers").create(
    {
      name: input.sellerName ?? "",
      phone: input.sellerPhone ?? "",
      altPhone: input.sellerAltPhone ?? "",
      email: input.sellerEmail ?? "",
      address: input.sellerAddress ?? "",
      leadSource: input.leadSource ?? "Walk-in",
      notes: ""
    },
    wctx
  );

  const vehicle = await repo.table("Vehicles").create(
    {
      stockRef: "PENDING",
      registrationNumber: input.registrationNumber ?? "",
      vin: input.vin ?? "",
      engineNumber: input.engineNumber ?? "",
      make: input.make ?? "",
      model: input.model ?? "",
      variant: input.variant ?? "",
      manufactureYear: input.manufactureYear === undefined ? "" : String(input.manufactureYear),
      registrationYear: input.registrationYear === undefined ? "" : String(input.registrationYear),
      fuel: input.fuel ?? "",
      transmission: input.transmission ?? "",
      bodyType: input.bodyType ?? "",
      colour: input.colour ?? "",
      ownershipCount: input.ownershipCount === undefined ? "" : String(input.ownershipCount),
      odometerKm: input.odometerKm === undefined ? "" : String(input.odometerKm),
      registrationLocation: input.registrationLocation ?? "",
      showroomLocation: "",
      sellerId: seller.id,
      acquisitionCaseId: "",
      purchaseDate: "",
      purchasePricePaise: "0",
      receivingDate: "",
      lifecycleState: "In acquisition pipeline",
      publicationState: "Not published",
      acquisitionNotes: input.negotiationNotes ?? "",
      askingPricePaise: "0",
      currentAskingPaise: "0",
      minimumPricePaise: "0",
      finalSalePricePaise: "0",
      publicSlug: "",
      publicTitle: "",
      publicDescription: "",
      publicFeatures: "",
      seoTitle: "",
      seoDescription: "",
      publishedAt: ""
    },
    wctx
  );

  const stockRef = await nextRef(repo, "vehicle");
  await repo.table("Vehicles").update(
    vehicle.id,
    { stockRef },
    vehicle.version,
    wctx
  );

  const caseRow = await repo.table("AcquisitionCases").create(
    {
      caseRef: await nextRef(repo, "acquisition"),
      vehicleId: vehicle.id,
      sellerId: seller.id,
      status: "New enquiry",
      leadSource: input.leadSource ?? "Walk-in",
      expectedPricePaise: String(input.expectedPrice ?? 0),
      offeredPricePaise: "0",
      agreedPricePaise: "0",
      assignedTo: ctx.actor,
      followUpDate: input.followUpDate ?? "",
      negotiationNotes: input.negotiationNotes ?? "",
      inspectionAppointmentAt: input.inspectionAppointmentAt ?? "",
      closeReason: "",
      closedAt: ""
    },
    wctx
  );

  await repo.table("Vehicles").update(
    vehicle.id,
    { acquisitionCaseId: caseRow.id },
    vehicle.version + 1, // version was bumped by the stockRef update
    wctx
  );

  await repo.logActivity(wctx, "enquiry.create", "AcquisitionCases", caseRow.id,
    `New enquiry for ${input.make} ${input.model} from ${input.sellerName}`);
  await repo.logStatusChange(wctx, "AcquisitionCases", caseRow.id, "", "New enquiry");

  return { seller, vehicle, caseRow };
}

export async function updateCaseStatus(
  caseId: string,
  to: string,
  opts: { reason?: string; agreedPrice?: number; offeredPrice?: number; assignedTo?: string; followUpDate?: string; negotiationNotes?: string },
  ctx: WriteContext
) {
  const repo = getRepo();
  const c = await repo.table("AcquisitionCases").get(caseId);
  if (!c) throw Object.assign(new Error("Acquisition case not found"), { status: 404 });
  const data: Record<string, string> = {
    status: to,
    negotiationNotes: opts.negotiationNotes ?? c.negotiationNotes ?? "",
    followUpDate: opts.followUpDate ?? c.followUpDate ?? ""
  };
  if (opts.agreedPrice !== undefined) data.agreedPricePaise = String(opts.agreedPrice);
  if (opts.offeredPrice !== undefined) data.offeredPricePaise = String(opts.offeredPrice);
  if (opts.assignedTo) data.assignedTo = opts.assignedTo;
  if (to === "Rejected" || to === "Cancelled") {
    data.closeReason = opts.reason ?? "";
    data.closedAt = new Date().toISOString();
  }
  if (to === "Acquired") data.closedAt = c.closedAt ?? "";
  const updated = await repo.table("AcquisitionCases").update(caseId, data, c.version, ctx);
  await repo.logStatusChange(ctx, "AcquisitionCases", caseId, c.status ?? "", to, opts.reason);
  await repo.logActivity(ctx, "acquisition.status", "AcquisitionCases", caseId,
    `Acquisition case ${c.caseRef} → ${to}${opts.reason ? `: ${opts.reason}` : ""}`);
  return updated;
}

/** Moves a vehicle into owned inventory after acquisition; assigns the stock ref if pending. */
export async function markAcquired(caseId: string, purchasePricePaise: number, purchaseDate: string, ctx: WriteContext) {
  const repo = getRepo();
  const c = await repo.table("AcquisitionCases").get(caseId);
  if (!c) throw Object.assign(new Error("Acquisition case not found"), { status: 404 });
  const v = await repo.table("Vehicles").get(c.vehicleId ?? "");
  if (!v) throw Object.assign(new Error("Vehicle not found"), { status: 404 });

  const data: Record<string, string> = {
    lifecycleState: "In preparation",
    purchasePricePaise: String(purchasePricePaise),
    purchaseDate,
    acquisitionCaseId: caseId
  };
  if (!v.stockRef || v.stockRef === "PENDING") data.stockRef = await nextRef(repo, "vehicle");
  if (!v.receivingDate) data.receivingDate = todayDateOnly();

  await repo.table("Vehicles").update(v.id, data, v.version, ctx);
  await updateCaseStatus(caseId, "Acquired", {}, ctx);
  await repo.logActivity(ctx, "acquisition.acquire", "Vehicles", v.id,
    `${v.stockRef ?? "Vehicle"} acquired for ₹${(purchasePricePaise / 100).toLocaleString("en-IN")}`);
}

export async function rejectCase(caseId: string, reason: string, ctx: WriteContext) {
  return updateCaseStatus(caseId, "Rejected", { reason }, ctx);
}
