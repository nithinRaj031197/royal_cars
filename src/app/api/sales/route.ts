import { NextResponse } from "next/server";
import { withPermission } from "@/lib/api";
import { z } from "zod";
import { moneyInput } from "@/lib/schema";
import { reservationInputSchema, saleInputSchema, salePaymentInputSchema } from "@/lib/form-schemas";
import { addSalePayment, cancelReservation, createReservation, createSale, voidSalePayment } from "@/server/services/sales";

export const POST = withPermission("sales.manage", async ({ req, user }) => {
  const body = await req.json();
  const type = (body as { type?: string }).type;

  if (type === "reservation") {
    const input = reservationInputSchema.parse(body);
    const r = await createReservation(input, { actor: user.email });
    return NextResponse.json({ ok: true, id: r.reservationId }, { status: 201 });
  }
  if (type === "reservation-cancel") {
    const input = z.object({
      id: z.string().min(1),
      reason: z.string().min(2, "Enter the cancellation reason"),
      refundAmount: moneyInput,
      refundMethod: z.string().default("UPI")
    }).parse(body);
    await cancelReservation(input.id, input.reason, input.refundAmount, input.refundMethod, { actor: user.email });
    return NextResponse.json({ ok: true });
  }
  if (type === "sale") {
    const input = saleInputSchema.parse(body);
    const s = await createSale(input, { actor: user.email });
    return NextResponse.json({ ok: true, id: s.saleId }, { status: 201 });
  }
  if (type === "sale-cancel") {
    const input = z.object({
      id: z.string().min(1),
      reason: z.string().min(2, "Enter the cancellation reason")
    }).parse(body);
    const { cancelSale } = await import("@/server/services/sales");
    await cancelSale(input.id, input.reason, { actor: user.email });
    return NextResponse.json({ ok: true });
  }
  if (type === "payment") {
    const input = salePaymentInputSchema.parse(body);
    const r = await addSalePayment(input, { actor: user.email });
    return NextResponse.json({ ok: true, ...r });
  }
  if (type === "payment-void") {
    const input = z.object({ id: z.string().min(1), reason: z.string().min(2) }).parse(body);
    await voidSalePayment(input.id, input.reason, { actor: user.email });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
});
