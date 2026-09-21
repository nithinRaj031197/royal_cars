import { getRepo, repoFor } from "@/lib/repo";
import { CriticalAction } from "@/lib/store/actions";
import { WriteContext } from "@/lib/store/types";
import { optionalPhone } from "@/lib/schema";
import { newOperationId } from "@/lib/ids";
import { sumPaise } from "@/lib/money";
import { commitmentInputSchema, serviceChargeInputSchema, serviceJobInputSchema, serviceRequestInputSchema } from "@/lib/form-schemas";
import type { CommitmentInput, ServiceChargeInput, ServiceJobInput, ServiceRequestInput } from "@/lib/form-schemas";

// Schemas live in @/lib/form-schemas so forms and routes validate identically.
export { commitmentInputSchema, serviceChargeInputSchema, serviceJobInputSchema, serviceRequestInputSchema };
export type { CommitmentInput, ServiceChargeInput, ServiceJobInput, ServiceRequestInput };

/** ---------- Commitments made at the time of sale ---------- */

export async function createCommitment(input: CommitmentInput, ctx: WriteContext) {
  const repo = getRepo();
  const sale = await repo.table("Sales").get(input.saleId);
  if (!sale) throw Object.assign(new Error("Sale not found"), { status: 404 });
  const c = await repo.table("ServiceCommitments").create(
    {
      commitmentRef: `SC-${Date.now().toString(36).toUpperCase()}`,
      saleId: input.saleId,
      vehicleId: sale.vehicleId ?? "",
      customerId: sale.customerId ?? "",
      kind: input.kind,
      coverage: input.coverage,
      exclusions: input.exclusions ?? "",
      startDate: input.startDate,
      endDate: input.endDate ?? "",
      odometerLimit: String(input.odometerLimit ?? 0),
      eligibleServices: String(input.eligibleServices ?? 0),
      servicesUsed: "0",
      agreementDocumentId: "",
      approvalNotes: input.approvalNotes ?? "",
      status: "Active"
    },
    ctx
  );
  await repo.logActivity(ctx, "commitment.create", "ServiceCommitments", c.id,
    `Service commitment (${input.kind}) recorded for ${sale.saleRef}`);
  return c;
}

/** ---------- Service requests ---------- */

export async function createServiceRequest(input: ServiceRequestInput, ctx: WriteContext) {
  const repo = getRepo();
  const sale = await repo.table("Sales").get(input.saleId);
  if (!sale) throw Object.assign(new Error("Sale not found"), { status: 404 });
  const sr = await repo.table("ServiceRequests").create(
    {
      requestRef: `SR-${Date.now().toString(36).toUpperCase()}`,
      saleId: input.saleId,
      vehicleId: sale.vehicleId ?? "",
      customerId: sale.customerId ?? "",
      complaint: input.complaint,
      reportedDate: input.reportedDate,
      odometerKm: String(input.odometerKm ?? 0),
      priority: input.priority ?? "Normal",
      appointmentAt: input.appointmentAt ?? "",
      coverageDecision: "Pending",
      coverageReason: "",
      assignedTo: ctx.actor,
      vendorId: "",
      diagnosis: "",
      workOrderId: "",
      partsPaise: "0",
      labourPaise: "0",
      actualCostPaise: "0",
      payer: "Showroom",
      customerChargePaise: "0",
      completionNotes: "",
      customerAcknowledged: "FALSE",
      nextFollowUpDate: "",
      status: "Open",
      cancelledReason: "",
      reopenedFromId: ""
    },
    ctx
  );
  await repo.logActivity(ctx, "service.request", "ServiceRequests", sr.id,
    `Service request raised for ${sale.saleRef}: ${input.complaint.slice(0, 60)}`);
  return sr;
}

export async function decideCoverage(
  srId: string,
  decision: "Covered" | "Customer billable",
  reason: string,
  ctx: WriteContext
) {
  const repo = getRepo();
  const sr = await repo.table("ServiceRequests").get(srId);
  if (!sr) throw Object.assign(new Error("Service request not found"), { status: 404 });
  if (sr.coverageDecision === "Pending") {
    const updated = await repo.table("ServiceRequests").update(
      srId,
      { coverageDecision: decision, coverageReason: reason },
      sr.version,
      ctx
    );
    await repo.logActivity(ctx, "service.coverage", "ServiceRequests", srId, `Coverage ${decision}: ${reason}`);
    return updated;
  }
  return sr;
}

export async function scheduleServiceRequest(srId: string, appointmentAt: string, ctx: WriteContext) {
  const repo = getRepo();
  const sr = await repo.table("ServiceRequests").get(srId);
  if (!sr) throw Object.assign(new Error("Service request not found"), { status: 404 });
  return repo.table("ServiceRequests").update(
    srId,
    { status: "Scheduled", appointmentAt },
    sr.version,
    ctx
  );
}

export async function addServiceJob(input: ServiceJobInput, ctx: WriteContext) {
  const repo = getRepo();
  const wctx: WriteContext = { actor: ctx.actor, operationId: ctx.operationId ?? newOperationId() };
  const sr = await repo.table("ServiceRequests").get(input.serviceRequestId);
  if (!sr) throw Object.assign(new Error("Service request not found"), { status: 404 });

  const parts = input.parts ?? 0;
  const labour = input.labour ?? 0;
  const total = parts + labour;
  const payer = sr.coverageDecision === "Customer billable" ? "Customer" : "Showroom";

  const job = await repo.table("ServiceJobs").create(
    {
      jobRef: `SJ-${Date.now().toString(36).toUpperCase()}`,
      serviceRequestId: input.serviceRequestId,
      vehicleId: sr.vehicleId ?? "",
      date: input.date,
      odometerKm: String(input.odometerKm ?? 0),
      workDone: input.workDone,
      partsPaise: String(parts),
      labourPaise: String(labour),
      totalPaise: String(total),
      vendorId: input.vendorId ?? "",
      staffId: input.staffId || ctx.actor,
      chargesPaymentId: "",
      status: "Completed"
    },
    wctx
  );

  await repo.table("ServiceRequests").update(
    input.serviceRequestId,
    {
      status: "In progress",
      diagnosis: input.diagnosis ?? sr.diagnosis ?? "",
      partsPaise: String(parts),
      labourPaise: String(labour),
      actualCostPaise: String(total),
      payer,
      customerChargePaise: payer === "Customer" ? String(total) : "0"
    },
    sr.version,
    wctx
  );
  await repo.logActivity(wctx, "service.job", "ServiceJobs", job.id,
    `Service job recorded: ${input.workDone.slice(0, 60)}`);
  return job;
}

/** Marks a service request resolved/closed. After-sale work never returns a vehicle to stock. */
export async function resolveServiceRequest(srId: string, completionNotes: string, nextFollowUpDate: string, ctx: WriteContext) {
  const repo = getRepo();
  const sr = await repo.table("ServiceRequests").get(srId);
  if (!sr) throw Object.assign(new Error("Service request not found"), { status: 404 });
  if (sr.status === "Cancelled") throw Object.assign(new Error("Cancelled requests cannot be resolved."), { status: 400 });
  const updated = await repo.table("ServiceRequests").update(
    srId,
    {
      status: "Resolved",
      completionNotes: completionNotes ?? "",
      nextFollowUpDate: nextFollowUpDate ?? "",
      customerAcknowledged: "TRUE"
    },
    sr.version,
    ctx
  );
  await repo.logStatusChange(ctx, "ServiceRequests", srId, sr.status ?? "", "Resolved");
  return updated;
}

export async function closeServiceRequest(srId: string, ctx: WriteContext) {
  const repo = getRepo();
  const sr = await repo.table("ServiceRequests").get(srId);
  if (!sr) throw Object.assign(new Error("Service request not found"), { status: 404 });
  if (!["Resolved"].includes(sr.status ?? "")) {
    throw Object.assign(new Error("Only resolved requests can be closed."), { status: 400 });
  }
  const updated = await repo.table("ServiceRequests").update(srId, { status: "Closed" }, sr.version, ctx);
  await repo.logStatusChange(ctx, "ServiceRequests", srId, "Resolved", "Closed");
  return updated;
}

export async function reopenServiceRequest(srId: string, reason: string, ctx: WriteContext) {
  const repo = getRepo();
  const sr = await repo.table("ServiceRequests").get(srId);
  if (!sr) throw Object.assign(new Error("Service request not found"), { status: 404 });
  if (!["Resolved", "Closed"].includes(sr.status ?? "")) {
    throw Object.assign(new Error("Only resolved or closed requests can be reopened."), { status: 400 });
  }
  const updated = await repo.table("ServiceRequests").update(
    srId,
    { status: "Reopened", reopenedFromId: sr.reopenedFromId || srId, completionNotes: reason },
    sr.version,
    ctx
  );
  await repo.logStatusChange(ctx, "ServiceRequests", srId, sr.status ?? "", "Reopened", reason);
  return updated;
}

/** ---------- Customer-billable charges (separate from sale balance) ---------- */

export async function addServiceCharge(input: ServiceChargeInput, ctx: WriteContext) {
  const repo = getRepo();
  const store = repo.store;
  const operationId = ctx.operationId ?? newOperationId();

  const sr = await repo.table("ServiceRequests").get(input.serviceRequestId);
  if (!sr) throw Object.assign(new Error("Service request not found"), { status: 404 });
  if (sr.coverageDecision !== "Customer billable") {
    throw Object.assign(new Error("Charges can only be collected on customer-billable service."), { status: 400 });
  }
  const chargeable = Number(sr.customerChargePaise ?? "0");
  const charges = (await repo.table("ServiceCharges").list()).filter(
    (c) => c.serviceRequestId === input.serviceRequestId && !c.voidedAt
  );
  const collected = sumPaise(charges.map((c) => Number(c.amountPaise ?? "0")));
  if (input.kind === "Charge" && collected + input.amount > chargeable) {
    throw Object.assign(new Error("Charge exceeds the approved customer charge."), { status: 400 });
  }
  const chargeRef = `SCH-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;

  const actions: CriticalAction[] = [
    ...((input.kind ?? "Charge") === "Charge"
      ? [
          // Re-checked under the lock: see the note in sales.addSalePayment.
          {
            type: "assert-sum" as const,
            table: "ServiceCharges" as const,
            field: "amountPaise",
            where: [{ field: "serviceRequestId", equals: input.serviceRequestId }],
            excludeWhenSet: ["voidedAt"],
            plus: input.amount,
            notGreaterThan: chargeable,
            message: "Charge exceeds the approved customer charge.",
            status: 400
          }
        ]
      : []),
    {
      type: "create",
      table: "ServiceCharges",
      data: {
        chargeRef,
        serviceRequestId: input.serviceRequestId,
        vehicleId: sr.vehicleId ?? "",
        customerId: sr.customerId ?? "",
        date: input.date,
        kind: input.kind ?? "Charge",
        amountPaise: (input.kind ?? "Charge") === "Charge" ? String(input.amount) : String(-input.amount),
        method: input.method,
        reference: input.reference ?? "",
        notes: input.notes ?? "",
        recordedBy: ctx.actor,
        voidedAt: "",
        voidReason: "",
        voidedBy: "",
        reversesChargeId: ""
      }
    }
  ];

  await store.runCritical(
    { operationId, kind: "service.charge", entityType: "ServiceCharges", entityId: input.serviceRequestId, actor: ctx.actor, payload: input },
    actions
  );
  await repo.logActivity({ actor: ctx.actor, operationId }, "service.charge", "ServiceCharges", input.serviceRequestId,
    `Service charge recorded on ${sr.requestRef}`);
  return { chargeRef, collected: collected + (input.kind === "Charge" ? input.amount : -input.amount), due: chargeable };
}

/** Outstanding balance on customer-billable service (charges − refunds). */
export async function serviceChargeBalance(store: import("@/lib/store/types").DataStore, serviceRequestId: string) {
  const repo = repoFor(store);
  const sr = await repo.table("ServiceRequests").get(serviceRequestId);
  if (!sr) throw Object.assign(new Error("Service request not found"), { status: 404 });
  const charges = (await repo.table("ServiceCharges").list()).filter(
    (c) => c.serviceRequestId === serviceRequestId && !c.voidedAt
  );
  const collected = sumPaise(charges.map((c) => Number(c.amountPaise ?? "0")));
  const chargeable = Number(sr.customerChargePaise ?? "0");
  return { chargeable, collected, due: chargeable - collected };
}

void optionalPhone;
