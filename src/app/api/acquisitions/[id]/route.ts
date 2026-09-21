import { NextResponse } from "next/server";
import { withPermission, parseBody } from "@/lib/api";
import { z } from "zod";
import { getRepo } from "@/lib/repo";
import { markAcquired, rejectCase, updateCaseStatus } from "@/server/services/acquisitions";
import { approveAcquisition } from "@/server/services/purchases";
import { moneyInput } from "@/lib/schema";

const actionSchema = z.object({
  action: z.enum(["status", "approve", "acquire", "reject", "cancel"]),
  status: z.string().optional(),
  reason: z.string().optional().default(""),
  agreedPrice: moneyInput.optional(),
  purchasePrice: moneyInput.optional(),
  purchaseDate: z.string().optional().default(""),
  assignedTo: z.string().optional().default(""),
  followUpDate: z.string().optional().default("")
});

export const POST = withPermission("acquisition.manage", async ({ req, user, params }) => {
  const resolved = (await params) ?? {};
  const id = resolved.id ?? "";
  const input = await parseBody(req, actionSchema);
  const repo = getRepo();
  const ctx = { actor: user.email };
  const acq = await repo.table("AcquisitionCases").get(id);
  if (!acq) return NextResponse.json({ error: "Acquisition case not found" }, { status: 404 });

  switch (input.action) {
    case "approve": {
      if (input.agreedPrice === undefined) {
        return NextResponse.json({ error: "Agreed purchase price is required." }, { status: 400 });
      }
      await approveAcquisition(id, input.agreedPrice, ctx);
      break;
    }
    case "acquire": {
      if (input.purchasePrice === undefined || !input.purchaseDate) {
        return NextResponse.json({ error: "Purchase price and date are required." }, { status: 400 });
      }
      await markAcquired(id, input.purchasePrice, input.purchaseDate, ctx);
      break;
    }
    case "reject": {
      if (!input.reason) return NextResponse.json({ error: "A rejection reason is required." }, { status: 400 });
      await rejectCase(id, input.reason, ctx);
      break;
    }
    case "cancel": {
      await updateCaseStatus(id, "Cancelled", { reason: input.reason }, ctx);
      break;
    }
    case "status": {
      if (!input.status) return NextResponse.json({ error: "Status is required." }, { status: 400 });
      await updateCaseStatus(id, input.status as never, {
        reason: input.reason,
        assignedTo: input.assignedTo || undefined,
        followUpDate: input.followUpDate || undefined
      }, ctx);
      break;
    }
  }
  return NextResponse.json({ ok: true });
});
