import { requireSession } from "@/server/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { getRepo } from "@/lib/repo";
import { LeadForm } from "./lead-form";

export default async function NewLeadPage() {
  const session = await requireSession();
  if (!can(session.user, "crm.manage")) {
    return <div className="card p-6 text-sm text-red-700">You do not have permission to create leads.</div>;
  }
  const repo = getRepo();
  const customers = (await repo.table("Customers").list()).map((c) => ({ id: c.id, label: `${c.name} · ${c.phone}` }));
  const vehicles = (await repo.table("Vehicles").list())
    .filter((v) => ["Ready for sale", "In preparation"].includes(v.lifecycleState ?? ""))
    .map((v) => ({ id: v.id, label: `${v.stockRef} — ${v.make} ${v.model}` }));
  return (
    <div>
      <PageHeader title="New lead" />
      <LeadForm customers={customers} vehicles={vehicles} />
    </div>
  );
}
