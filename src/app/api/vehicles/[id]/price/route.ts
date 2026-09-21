import { NextResponse } from "next/server";
import { withPermission, parseBody } from "@/lib/api";
import { priceChangeInputSchema } from "@/lib/form-schemas";
import { changePrice } from "@/server/services/pricing";

export const POST = withPermission("sales.manage", async ({ req, user, params }) => {
  const resolved = (await params) ?? {};
  const vehicleId = resolved.id ?? "";
  const input = await parseBody(req, priceChangeInputSchema);
  const result = await changePrice({ ...input, vehicleId }, { actor: user.email });
  return NextResponse.json({ ok: true, previous: result.previous });
});
