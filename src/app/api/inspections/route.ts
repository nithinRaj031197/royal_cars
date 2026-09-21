import { NextResponse } from "next/server";
import { withPermission, parseBody } from "@/lib/api";
import { inspectionInputSchema } from "@/lib/form-schemas";
import { createInspection } from "@/server/services/inspections";

export const POST = withPermission("inspection.manage", async ({ req, user }) => {
  const input = await parseBody(req, inspectionInputSchema);
  const result = await createInspection(input as Parameters<typeof createInspection>[0], { actor: user.email });
  return NextResponse.json(result, { status: 201 });
});

export const GET = withPermission("inspection.view", async () => {
  const { getRepo } = await import("@/lib/repo");
  const inspections = await getRepo().table("Inspections").list();
  return NextResponse.json({ inspections });
});
