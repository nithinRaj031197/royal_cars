import { NextResponse } from "next/server";
import { withPermission } from "@/lib/api";
import { z } from "zod";

import {
  commitmentInputSchema, serviceChargeInputSchema, serviceJobInputSchema, serviceRequestInputSchema
} from "@/lib/form-schemas";
import {
  addServiceCharge, addServiceJob, closeServiceRequest, createCommitment, createServiceRequest,
  decideCoverage, reopenServiceRequest, resolveServiceRequest, scheduleServiceRequest
} from "@/server/services/aftersale";

export const POST = withPermission("aftersale.manage", async ({ req, user }) => {
  const body = await req.json();
  const type = (body as { type?: string }).type;

  if (type === "commitment") {
    const input = commitmentInputSchema.parse(body);
    const c = await createCommitment(input, { actor: user.email });
    return NextResponse.json({ ok: true, id: c.id }, { status: 201 });
  }
  if (type === "request") {
    const input = serviceRequestInputSchema.parse(body);
    const sr = await createServiceRequest(input, { actor: user.email });
    return NextResponse.json({ ok: true, id: sr.id }, { status: 201 });
  }
  if (type === "coverage") {
    const input = z.object({
      id: z.string().min(1),
      decision: z.enum(["Covered", "Customer billable"]),
      reason: z.string().min(2, "Record the reason")
    }).parse(body);
    await decideCoverage(input.id, input.decision, input.reason, { actor: user.email });
    return NextResponse.json({ ok: true });
  }
  if (type === "schedule") {
    const input = z.object({ id: z.string().min(1), appointmentAt: z.string().min(5) }).parse(body);
    await scheduleServiceRequest(input.id, input.appointmentAt, { actor: user.email });
    return NextResponse.json({ ok: true });
  }
  if (type === "job") {
    const input = serviceJobInputSchema.parse(body);
    const j = await addServiceJob(input, { actor: user.email });
    return NextResponse.json({ ok: true, id: j.id }, { status: 201 });
  }
  if (type === "resolve") {
    const input = z.object({
      id: z.string().min(1),
      completionNotes: z.string().min(2),
      nextFollowUpDate: z.string().optional().default("")
    }).parse(body);
    await resolveServiceRequest(input.id, input.completionNotes, input.nextFollowUpDate ?? "", { actor: user.email });
    return NextResponse.json({ ok: true });
  }
  if (type === "close") {
    const input = z.object({ id: z.string().min(1) }).parse(body);
    await closeServiceRequest(input.id, { actor: user.email });
    return NextResponse.json({ ok: true });
  }
  if (type === "reopen") {
    const input = z.object({ id: z.string().min(1), reason: z.string().min(2) }).parse(body);
    await reopenServiceRequest(input.id, input.reason, { actor: user.email });
    return NextResponse.json({ ok: true });
  }
  if (type === "charge") {
    const input = serviceChargeInputSchema.parse(body);
    const r = await addServiceCharge(input, { actor: user.email });
    return NextResponse.json({ ok: true, ...r });
  }
  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
});
