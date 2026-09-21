import { NextResponse } from "next/server";
import { withPermission, parseBody } from "@/lib/api";
import { getRepo } from "@/lib/repo";
import { createEnquiry, enquiryInputSchema } from "@/server/services/acquisitions";
import type { RecordRow } from "@/lib/store/types";

export const GET = withPermission("acquisition.view", async () => {
  const repo = getRepo();
  const cases = await repo.table("AcquisitionCases").list();
  const vehicles = await repo.table("Vehicles").list();
  const sellers = await repo.table("Sellers").list();
  const byId = (rows: RecordRow[], id?: string) => rows.find((r) => r.id === id);

  const rows = cases
    .map((c) => {
      const v = byId(vehicles, c.vehicleId);
      const s = byId(sellers, c.sellerId);
      return {
        id: c.id,
        caseRef: c.caseRef,
        status: c.status,
        vehicle: v ? `${v.make ?? ""} ${v.model ?? ""} ${v.variant ?? ""}`.trim() : "—",
        vehicleId: v?.id ?? "",
        stockRef: v?.stockRef ?? "",
        seller: s?.name ?? "—",
        sellerPhone: s?.phone ?? "",
        expectedPricePaise: Number(c.expectedPricePaise ?? "0"),
        offeredPricePaise: Number(c.offeredPricePaise ?? "0"),
        agreedPricePaise: Number(c.agreedPricePaise ?? "0"),
        followUpDate: c.followUpDate ?? "",
        assignedTo: c.assignedTo ?? "",
        updatedAt: c.updatedAt
      };
    })
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));

  return NextResponse.json({ cases: rows });
});

export const POST = withPermission("acquisition.manage", async ({ req, user }) => {
  const input = await parseBody(req, enquiryInputSchema);
  const result = await createEnquiry(input, { actor: user.email });
  return NextResponse.json(result, { status: 201 });
});
