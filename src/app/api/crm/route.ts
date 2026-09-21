import { NextResponse } from "next/server";
import { withPermission } from "@/lib/api";
import { z } from "zod";
import { customerInputSchema, followUpInputSchema, leadInputSchema, testDriveInputSchema } from "@/lib/form-schemas";
import { completeFollowUp, createFollowUp, createLead, scheduleTestDrive, upsertCustomer } from "@/server/services/crm";

export const POST = withPermission("crm.manage", async ({ req, user }) => {
  const body = await req.json();
  const type = (body as { type?: string }).type;
  if (type === "customer") {
    const input = customerInputSchema.parse(body);
    const r = await upsertCustomer(input, { actor: user.email });
    return NextResponse.json({ ok: true, id: r.customer.id }, { status: 201 });
  }
  if (type === "lead") {
    const input = leadInputSchema.parse(body);
    const lead = await createLead(input, { actor: user.email });
    return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
  }
  if (type === "followup") {
    const input = followUpInputSchema.parse(body);
    const fu = await createFollowUp(input, { actor: user.email });
    return NextResponse.json({ ok: true, id: fu.id }, { status: 201 });
  }
  if (type === "followup-done") {
    const input = z.object({ id: z.string().min(1), outcome: z.string().min(2) }).parse(body);
    await completeFollowUp(input.id, input.outcome, { actor: user.email });
    return NextResponse.json({ ok: true });
  }
  if (type === "testdrive") {
    const input = testDriveInputSchema.parse(body);
    const td = await scheduleTestDrive(input, { actor: user.email });
    return NextResponse.json({ ok: true, id: td.id }, { status: 201 });
  }
  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
});
