import { z } from "zod";
import { getRepo } from "@/lib/repo";
import { WriteContext } from "@/lib/store/types";
import { settingsInputSchema, staffInputSchema } from "@/lib/form-schemas";
import type { SettingsInput } from "@/lib/form-schemas";

// Schemas live in @/lib/form-schemas so forms and routes validate identically.
export { settingsInputSchema, staffInputSchema };
export type { SettingsInput };

export async function getSettings(): Promise<Record<string, string>> {
  return getRepo().settings();
}

export async function saveSettings(input: SettingsInput, ctx: WriteContext) {
  const repo = getRepo();
  for (const [key, value] of Object.entries(input)) {
    await repo.setSetting(`showroom:${key}`, String(value ?? ""), ctx);
  }
  await repo.logActivity(ctx, "settings.save", "Settings", "showroom", "Showroom settings updated");
  return getSettings();
}

/** Staff management (owner only). */
export async function upsertStaff(input: z.infer<typeof staffInputSchema>, ctx: WriteContext) {
  const repo = getRepo();
  const email = input.email.toLowerCase();
  const existing = (await repo.table("Staff").list({ activeOnly: false })).find((s) => (s.email ?? "").toLowerCase() === email);
  if (existing) {
    const updated = await repo.table("Staff").update(
      existing.id,
      { name: input.name, role: input.role, phone: input.phone ?? "", active: input.active ? "TRUE" : "FALSE" },
      existing.version,
      ctx
    );
    await repo.logActivity(ctx, "staff.update", "Staff", existing.id, `Staff ${input.name} updated (${input.role})`);
    return updated;
  }
  const created = await repo.table("Staff").create(
    {
      email,
      name: input.name,
      role: input.role,
      phone: input.phone ?? "",
      active: input.active ? "TRUE" : "FALSE",
      googleSub: "",
      lastLoginAt: ""
    },
    ctx
  );
  await repo.logActivity(ctx, "staff.create", "Staff", created.id, `Staff ${input.name} added (${input.role})`);
  return created;
}
