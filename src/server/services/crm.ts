import { getRepo } from "@/lib/repo";
import { WriteContext } from "@/lib/store/types";

import { newOperationId } from "@/lib/ids";
import { customerInputSchema, followUpInputSchema, leadInputSchema, testDriveInputSchema } from "@/lib/form-schemas";
import type { CustomerInput, FollowUpInput, LeadInput, TestDriveInput } from "@/lib/form-schemas";

// Schemas live in @/lib/form-schemas so forms and routes validate identically.
export { customerInputSchema, followUpInputSchema, leadInputSchema, testDriveInputSchema };
export type { CustomerInput, FollowUpInput, LeadInput, TestDriveInput };

export async function upsertCustomer(
  input: { name: string; phone: string; altPhone?: string; email?: string; address?: string; idType?: string; idNumberMasked?: string; notes?: string },
  ctx: WriteContext
) {
  const repo = getRepo();
  const wctx: WriteContext = { actor: ctx.actor, operationId: ctx.operationId ?? newOperationId() };
  // Match on phone only when there IS a phone. Matching on "" would fold every
  // customer recorded without a number into a single record — the showroom is
  // migrating incomplete history, so blank phones are expected and must stay
  // separate people.
  const phoneKey = (input.phone ?? "").trim();
  const existing = phoneKey
    ? (await repo.table("Customers").list()).find((c) => (c.phone ?? "").trim() === phoneKey && !c.archived)
    : undefined;
  if (existing) {
    const data: Record<string, string> = {
      name: input.name,
      altPhone: input.altPhone ?? "",
      email: input.email ?? "",
      address: input.address ?? "",
      idType: input.idType ?? "",
      idNumberMasked: input.idNumberMasked ?? "",
      notes: input.notes ?? ""
    };
    const updated = await repo.table("Customers").update(existing.id, data, existing.version, wctx);
    return { customer: updated, created: false };
  }
  const customer = await repo.table("Customers").create(
    {
      name: input.name,
      phone: input.phone,
      phoneE164: "",
      altPhone: input.altPhone ?? "",
      email: input.email ?? "",
      address: input.address ?? "",
      idType: input.idType ?? "",
      idNumberMasked: input.idNumberMasked ?? "",
      dob: "",
      anniversary: "",
      notes: input.notes ?? ""
    },
    wctx
  );
  await repo.logActivity(wctx, "customer.create", "Customers", customer.id, `Customer ${input.name} created`);
  return { customer, created: true };
}

export async function createLead(input: LeadInput, ctx: WriteContext) {
  const repo = getRepo();
  const wctx: WriteContext = { actor: ctx.actor, operationId: ctx.operationId ?? newOperationId() };
  const lead = await repo.table("Leads").create(
    {
      leadRef: `LEAD-${Date.now().toString(36).toUpperCase()}`,
      customerId: input.customerId,
      vehicleId: input.vehicleId ?? "",
      source: input.source,
      budgetPaise: String(input.budget ?? 0),
      status: input.status ?? "New",
      assignedTo: input.assignedTo || ctx.actor,
      notes: input.notes ?? ""
    },
    wctx
  );
  await repo.logActivity(wctx, "lead.create", "Leads", lead.id, `Lead created (${input.source})`);
  return lead;
}

export async function updateLeadStatus(leadId: string, status: string, ctx: WriteContext) {
  const repo = getRepo();
  const lead = await repo.table("Leads").get(leadId);
  if (!lead) throw Object.assign(new Error("Lead not found"), { status: 404 });
  const updated = await repo.table("Leads").update(leadId, { status }, lead.version, ctx);
  await repo.logStatusChange(ctx, "Leads", leadId, lead.status ?? "", status);
  return updated;
}

export async function createFollowUp(input: FollowUpInput, ctx: WriteContext) {
  const repo = getRepo();
  const fu = await repo.table("FollowUps").create(
    {
      leadId: input.leadId ?? "",
      customerId: input.customerId,
      vehicleId: input.vehicleId ?? "",
      dueDate: input.dueDate,
      note: input.note ?? "",
      status: input.status ?? "Open",
      outcome: "",
      completedAt: ""
    },
    ctx
  );
  await repo.logActivity(ctx, "followup.create", "FollowUps", fu.id, `Follow-up scheduled for ${input.dueDate}`);
  return fu;
}

export async function completeFollowUp(followUpId: string, outcome: string, ctx: WriteContext) {
  const repo = getRepo();
  const fu = await repo.table("FollowUps").get(followUpId);
  if (!fu) throw Object.assign(new Error("Follow-up not found"), { status: 404 });
  const updated = await repo.table("FollowUps").update(
    followUpId,
    { status: "Done", outcome, completedAt: new Date().toISOString() },
    fu.version,
    ctx
  );
  await repo.logActivity(ctx, "followup.complete", "FollowUps", followUpId, `Follow-up completed: ${outcome}`);
  return updated;
}

export async function scheduleTestDrive(input: TestDriveInput, ctx: WriteContext) {
  const repo = getRepo();
  const td = await repo.table("TestDrives").create(
    {
      driveRef: `TD-${Date.now().toString(36).toUpperCase()}`,
      leadId: input.leadId ?? "",
      customerId: input.customerId,
      vehicleId: input.vehicleId,
      scheduledAt: input.scheduledAt,
      status: "Scheduled",
      outcome: "",
      feedback: input.notes ?? "",
      staffId: input.staffId || ctx.actor,
      odometerBefore: "",
      odometerAfter: ""
    },
    ctx
  );
  await repo.logActivity(ctx, "testdrive.schedule", "TestDrives", td.id, `Test drive scheduled`);
  return td;
}

export async function completeTestDrive(tdId: string, outcome: string, feedback: string, ctx: WriteContext) {
  const repo = getRepo();
  const td = await repo.table("TestDrives").get(tdId);
  if (!td) throw Object.assign(new Error("Test drive not found"), { status: 404 });
  const updated = await repo.table("TestDrives").update(
    tdId,
    { status: "Completed", outcome, feedback },
    td.version,
    ctx
  );
  await repo.logActivity(ctx, "testdrive.complete", "TestDrives", tdId, `Test drive completed: ${outcome}`);
  return updated;
}

/** Overdue = open follow-ups with dueDate < today. */
export async function overdueFollowUps(store: import("@/lib/store/types").DataStore) {
  const rows = await store.list("FollowUps");
  const today = new Date().toISOString().slice(0, 10);
  return rows.filter((r) => r.status === "Open" && r.dueDate && r.dueDate < today);
}

/** Upcoming = open follow-ups due today or in the next 7 days. */
export async function upcomingFollowUps(store: import("@/lib/store/types").DataStore) {
  const rows = await store.list("FollowUps");
  const today = new Date().toISOString().slice(0, 10);
  const week = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  return rows.filter((r) => r.status === "Open" && r.dueDate && r.dueDate >= today && r.dueDate <= week);
}
