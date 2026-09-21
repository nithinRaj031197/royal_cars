import { requireSession } from "@/server/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { getRepo } from "@/lib/repo";
import { InspectionForm } from "./inspection-form";

export default async function NewInspectionPage({
  searchParams
}: {
  searchParams: Promise<{ vehicleId?: string }>;
}) {
  const session = await requireSession();
  if (!can(session.user, "inspection.manage")) {
    return <div className="card p-6 text-sm text-red-700">You do not have permission to record inspections.</div>;
  }
  const { vehicleId } = await searchParams;
  const repo = getRepo();
  const vehicles = (await repo.table("Vehicles").list()).map((v) => ({
    id: v.id,
    label: `${v.stockRef} — ${v.make} ${v.model} (${v.registrationNumber})`
  }));
  return (
    <div>
      <PageHeader title="Record inspection" subtitle="Checklist, findings and estimated repairs" />
      <InspectionForm vehicles={vehicles} initialVehicleId={vehicleId ?? ""} />
    </div>
  );
}
