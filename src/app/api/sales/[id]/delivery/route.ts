import { NextResponse } from "next/server";
import { withPermission, parseBody } from "@/lib/api";
import { completeDeliveryInputSchema } from "@/lib/form-schemas";
import { completeDelivery } from "@/server/services/delivery";

export const POST = withPermission("delivery.manage", async ({ req, user, params }) => {
  const resolved = (await params) ?? {};
  const saleId = resolved.id ?? "";
  const input = await parseBody(req, completeDeliveryInputSchema);
  await completeDelivery({ ...input, saleId }, { actor: user.email });
  return NextResponse.json({ ok: true });
});
