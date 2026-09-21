import { getRepo } from "@/lib/repo";
import { WriteContext } from "@/lib/store/types";

import { newOperationId } from "@/lib/ids";
import { checklistItemSchema, inspectionInputSchema } from "@/lib/form-schemas";
import type { InspectionInput } from "@/lib/form-schemas";

// Schemas live in @/lib/form-schemas so forms and routes validate identically.
export { checklistItemSchema, inspectionInputSchema };
export type { InspectionInput };

function woRef(): string {
  return `WO-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
}

export async function createInspection(input: InspectionInput, ctx: WriteContext) {
  const repo = getRepo();
  const wctx: WriteContext = { actor: ctx.actor, operationId: ctx.operationId ?? newOperationId() };

  const vehicle = await repo.table("Vehicles").get(input.vehicleId);
  if (!vehicle) throw Object.assign(new Error("Vehicle not found"), { status: 404 });

  const inspection = await repo.table("Inspections").create(
    {
      inspectionRef: `INS-${Date.now().toString(36).toUpperCase()}`,
      vehicleId: vehicle.id,
      acquisitionCaseId: input.acquisitionCaseId || vehicle.acquisitionCaseId || "",
      type: input.type,
      inspectedBy: ctx.actor,
      date: input.date,
      odometerKm: String(input.odometerKm),
      overallResult: input.overallResult,
      estimatedRepairPaise: String(input.estimatedRepair ?? 0),
      recommendedWork: input.recommendedWork ?? "",
      notes: input.notes ?? "",
      accidentHistory: input.accidentHistory ?? "Unknown",
      floodHistory: input.floodHistory ?? "Unknown"
    },
    wctx
  );

  for (const item of input.items ?? []) {
    const itemRow = await repo.table("InspectionItems").create(
      {
        inspectionId: inspection.id,
        area: item.area,
        condition: item.condition,
        finding: item.finding ?? "",
        workOrderRef: "",
        estimatedCostPaise: String(item.estimatedCost ?? 0)
      },
      wctx
    );

    if (item.createWorkOrder && (item.estimatedCost ?? 0) > 0) {
      const wo = await repo.table("WorkOrders").create(
        {
          workOrderRef: woRef(),
          vehicleId: vehicle.id,
          acquisitionCaseId: inspection.acquisitionCaseId ?? "",
          saleId: "",
          stage: input.acquisitionCaseId ? "Pre-purchase" : "Inventory preparation",
          issue: `${item.area}: ${item.finding ?? "Finding"}`.trim(),
          requiredWork: item.workCategory || item.area,
          category: item.workCategory || item.area,
          vendorId: "",
          assignedTo: ctx.actor,
          estimatedPaise: String(item.estimatedCost),
          actualPaise: "0",
          partsPaise: "0",
          labourPaise: "0",
          otherPaise: "0",
          taxPaise: "0",
          discountPaise: "0",
          startDate: "",
          expectedCompletionDate: "",
          completedOn: "",
          odometerKm: String(input.odometerKm),
          status: "Draft",
          payer: "Showroom",
          approvedBy: "",
          approvalNotes: "",
          completionNotes: "",
          invoiceNumber: "",
          invoiceAmountPaise: "0",
          invoiceDocumentId: "",
          linkedWorkOrderRef: ""
        },
        wctx
      );
      await repo.table("InspectionItems").update(
        itemRow.id,
        { workOrderRef: String(wo.workOrderRef ?? "") },
        itemRow.version,
        wctx
      );
    }
  }

  // A receiving inspection confirms the vehicle is physically with the showroom.
  if (input.type === "Receiving" && vehicle.lifecycleState === "In acquisition pipeline") {
    await repo.table("Vehicles").update(
      vehicle.id,
      { lifecycleState: "In preparation", receivingDate: input.date },
      vehicle.version,
      wctx
    );
    await repo.logStatusChange(wctx, "Vehicles", vehicle.id, "In acquisition pipeline", "In preparation", "Receiving inspection recorded");
  }

  await repo.logActivity(wctx, "inspection.create", "Inspections", inspection.id,
    `${input.type} inspection for ${vehicle.stockRef}: ${input.overallResult}`);

  return { inspection };
}
