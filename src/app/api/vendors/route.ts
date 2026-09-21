import { NextResponse } from "next/server";
import { withPermission, parseBody } from "@/lib/api";
import { z } from "zod";
import { upsertVendor } from "@/server/services/vendors";

const vendorSchema = z.object({
  name: z.string().min(2, "Enter the vendor name"),
  category: z.string().default("Other"),
  phone: z.string().optional().default(""),
  email: z.string().email().optional().or(z.literal("")).default(""),
  address: z.string().optional().default(""),
  gst: z.string().optional().default(""),
  preferred: z.boolean().default(false)
});

export const POST = withPermission("vendor.manage", async ({ req, user }) => {
  const input = await parseBody(req, vendorSchema);
  const v = await upsertVendor(input, { actor: user.email });
  return NextResponse.json({ ok: true, id: v.id }, { status: 201 });
});
