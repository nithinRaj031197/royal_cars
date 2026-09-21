import { NextResponse } from "next/server";
import { withPermission, parseBody } from "@/lib/api";
import { settingsInputSchema } from "@/lib/form-schemas";
import { saveSettings } from "@/server/services/settings";

export const POST = withPermission("settings.manage", async ({ req, user }) => {
  const input = await parseBody<Record<string, string>>(req, settingsInputSchema);
  const saved = await saveSettings(input as Parameters<typeof saveSettings>[0], { actor: user.email });
  return NextResponse.json({ ok: true, settings: saved });
});
