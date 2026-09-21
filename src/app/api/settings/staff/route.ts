import { NextResponse } from "next/server";
import { withPermission, parseBody } from "@/lib/api";
import { staffInputSchema } from "@/lib/form-schemas";
import { upsertStaff } from "@/server/services/settings";

export const POST = withPermission("staff.manage", async ({ req, user }) => {
  const input = await parseBody(req, staffInputSchema);
  const s = await upsertStaff(input, { actor: user.email });
  return NextResponse.json({ ok: true, id: s.id });
});
