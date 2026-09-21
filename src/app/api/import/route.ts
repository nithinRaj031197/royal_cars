import { NextResponse } from "next/server";
import { withPermission, parseBody } from "@/lib/api";
import { z } from "zod";
import { importCsv } from "@/server/services/imports";

const bodySchema = z.object({
  entity: z.enum(["Vehicles", "Customers", "Vendors", "Expenses"]),
  mode: z.enum(["create-only", "upsert"]),
  csv: z.string().min(5, "CSV content is required")
});

export const POST = withPermission("import.run", async ({ req, user }) => {
  const input = await parseBody(req, bodySchema);
  const result = await importCsv(input.entity, input.csv, input.mode, { actor: user.email });
  return NextResponse.json({ ok: true, ...result });
});
