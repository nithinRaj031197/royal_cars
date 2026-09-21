import { requireSession } from "@/server/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { getRepo } from "@/lib/repo";
import { NewSaleForm } from "./new-sale-form";

export default async function NewSalePage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const session = await requireSession();
  if (!can(session.user, "sales.manage")) {
    return <div className="card p-6 text-sm text-red-700">You do not have permission to create sales.</div>;
  }
  const { type } = await searchParams;
  const repo = getRepo();
  const vehicles = (await repo.table("Vehicles").list())
    .filter((v) => ["Ready for sale", "In preparation", "Reserved"].includes(v.lifecycleState ?? ""))
    .map((v) => ({ id: v.id, label: `${v.stockRef} — ${v.make} ${v.model} · asking ₹${Number(v.currentAskingPaise ?? 0) / 100}` }));
  const reservations = (await repo.table("Reservations").list())
    .filter((r) => r.status === "Active")
    .map((r) => ({ id: r.id, label: r.reservationRef ?? r.id }));

  return (
    <div>
      <PageHeader title={type === "reservation" ? "New reservation" : "New sale"} subtitle="Booking amounts transfer into the sale balance" />
      <NewSaleForm kind={type === "reservation" ? "reservation" : "sale"} vehicles={vehicles} reservations={reservations} />
    </div>
  );
}
