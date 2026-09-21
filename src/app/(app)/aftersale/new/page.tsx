import { requireSession } from "@/server/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { getRepo } from "@/lib/repo";
import { ServiceRequestForm } from "./request-form";

export default async function NewServiceRequestPage() {
  const session = await requireSession();
  if (!can(session.user, "aftersale.manage")) {
    return <div className="card p-6 text-sm text-red-700">You do not have permission to raise service requests.</div>;
  }
  const repo = getRepo();
  const sales = await repo.table("Sales").list();
  const vehicles = await repo.table("Vehicles").list();
  const customers = await repo.table("Customers").list();
  const options = sales.map((s) => {
    const v = vehicles.find((x) => x.id === s.vehicleId);
    const c = customers.find((x) => x.id === s.customerId);
    return { id: s.id, label: `${s.saleRef} · ${v?.stockRef ?? ""} ${v?.make ?? ""} ${v?.model ?? ""} · ${c?.name ?? ""}` };
  });
  return (
    <div>
      <PageHeader title="New service request" subtitle="Complaint, priority and appointment" />
      <ServiceRequestForm sales={options} />
    </div>
  );
}
