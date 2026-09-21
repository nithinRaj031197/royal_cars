import { NextResponse } from "next/server";
import { withPermission, parseBody } from "@/lib/api";
import { purchasePaymentInputSchema } from "@/lib/form-schemas";
import { addPurchasePayment } from "@/server/services/purchases";

export const POST = withPermission("purchase.manage", async ({ req, user }) => {
  const input = await parseBody(req, purchasePaymentInputSchema);
  const r = await addPurchasePayment(input, { actor: user.email });
  return NextResponse.json({ ok: true, ...r });
});
