import { getRepo } from "@/lib/repo";
import { WriteContext } from "@/lib/store/types";

export async function upsertVendor(
  input: { name: string; category: string; phone?: string; email?: string; address?: string; gst?: string; preferred?: boolean },
  ctx: WriteContext
) {
  const repo = getRepo();
  const existing = (await repo.table("Vendors").list()).find(
    (v) => (v.name ?? "").toLowerCase() === input.name.toLowerCase() && !v.archived
  );
  const data = {
    name: input.name,
    category: input.category || "Other",
    phone: input.phone ?? "",
    email: input.email ?? "",
    address: input.address ?? "",
    gst: input.gst ?? "",
    notes: "",
    preferred: input.preferred ? "TRUE" : "FALSE"
  };
  if (existing) {
    return repo.table("Vendors").update(existing.id, data, existing.version, ctx);
  }
  const created = await repo.table("Vendors").create(
    { ...data, email: input.email ?? "" },
    ctx
  );
  await repo.logActivity(ctx, "vendor.create", "Vendors", created.id, `Vendor ${input.name} added`);
  return created;
}
