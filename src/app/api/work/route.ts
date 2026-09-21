import { NextResponse } from "next/server";
import { withPermission } from "@/lib/api";
import { z } from "zod";
import { accessoryInputSchema, expenseInputSchema, workCompletionSchema, workOrderInputSchema } from "@/lib/form-schemas";
import { addAccessory, addExpense, approveWorkOrder, cancelWorkOrder, completeWorkOrder, createWorkOrder } from "@/server/services/work";

export const POST = withPermission("work.manage", async ({ req, user }) => {
  const body = await req.json();
  const type = (body as { type?: string }).type ?? "work";
  if (type === "work") {
    const input = workOrderInputSchema.parse(body);
    const wo = await createWorkOrder(input, { actor: user.email });
    return NextResponse.json({ ok: true, id: wo.id }, { status: 201 });
  }
  if (type === "accessory") {
    const input = accessoryInputSchema.parse(body);
    const acc = await addAccessory(input, { actor: user.email });
    return NextResponse.json({ ok: true, id: acc.id }, { status: 201 });
  }
  if (type === "expense") {
    const input = expenseInputSchema.parse(body);
    const exp = await addExpense(input, { actor: user.email });
    return NextResponse.json({ ok: true, id: exp.id }, { status: 201 });
  }
  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
});

const completionSchema = workCompletionSchema.extend({ woId: z.string().min(1) });

export const PUT = withPermission("work.manage", async ({ req, user }) => {
  const body = await req.json();
  const action = (body as { action?: string }).action;
  if (action === "complete") {
    const input = completionSchema.parse(body);
    await completeWorkOrder(input.woId, {
      parts: input.parts ?? 0,
      labour: input.labour ?? 0,
      other: input.other ?? 0,
      tax: input.tax ?? 0,
      discount: input.discount ?? 0,
      invoiceNumber: input.invoiceNumber ?? "",
      completionNotes: input.completionNotes ?? "",
      completedOn: input.completedOn
    }, { actor: user.email });
    return NextResponse.json({ ok: true });
  }
  if (action === "approve") {
    const input = z.object({ woId: z.string().min(1), notes: z.string().optional().default("") }).parse(body);
    await approveWorkOrder(input.woId, input.notes ?? "", { actor: user.email });
    return NextResponse.json({ ok: true });
  }
  if (action === "cancel") {
    const input = z.object({ woId: z.string().min(1), reason: z.string().min(2) }).parse(body);
    await cancelWorkOrder(input.woId, input.reason, { actor: user.email });
    return NextResponse.json({ ok: true });
  }
  if (action === "start") {
    const input = z.object({ woId: z.string().min(1) }).parse(body);
    const { startWorkOrder } = await import("@/server/services/work");
    await startWorkOrder(input.woId, { actor: user.email });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
});
