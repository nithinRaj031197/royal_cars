import { requireSession } from "@/server/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { getRepo } from "@/lib/repo";
import { WorkEntryForm } from "./work-form";

export default async function NewWorkPage({
  searchParams
}: {
  searchParams: Promise<{ type?: string; vehicleId?: string }>;
}) {
  const session = await requireSession();
  if (!can(session.user, "work.manage") && !can(session.user, "expense.manage")) {
    return <div className="card p-6 text-sm text-red-700">You do not have permission to record work or costs.</div>;
  }
  const { type, vehicleId } = await searchParams;
  const repo = getRepo();
  const vehicles = (await repo.table("Vehicles").list())
    .filter((v) => v.lifecycleState !== "In acquisition pipeline")
    .map((v) => ({ id: v.id, label: `${v.stockRef} — ${v.make} ${v.model} (${v.registrationNumber})` }));
  const vendors = (await repo.table("Vendors").list()).map((v) => ({ id: v.id, label: `${v.name} (${v.category})` }));

  return (
    <div>
      <PageHeader
        title={type === "accessory" ? "Add accessory" : type === "expense" ? "Add expense" : "New work order"}
        subtitle="Costs post to investment only when completed and showroom-paid"
      />
      <WorkEntryForm
        type={type === "accessory" ? "accessory" : type === "expense" ? "expense" : "work"}
        vehicles={vehicles}
        vendors={vendors}
        initialVehicleId={vehicleId ?? ""}
      />
    </div>
  );
}
