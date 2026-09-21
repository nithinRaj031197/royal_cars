import { NextResponse } from "next/server";
import { withPermission } from "@/lib/api";
import { getStore } from "@/lib/store";
import { reconcile } from "@/server/services/reconcile";

export const POST = withPermission("settings.manage", async () => {
  const issues = await reconcile(getStore());
  return NextResponse.json({ ok: true, issues, checkedAt: new Date().toISOString() });
});
