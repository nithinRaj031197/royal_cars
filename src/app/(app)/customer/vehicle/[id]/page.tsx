import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/server/auth";
import { getStore } from "@/lib/store";
import { repoFor } from "@/lib/repo";
import { customerVehicleProjection } from "@/server/services/reports";
import { formatINR } from "@/lib/money";
import { PrintLink } from "@/app/(app)/sales/[id]/print-link";

export const dynamic = "force-dynamic";

/**
 * Customer detail sheet for a vehicle on offer.
 *
 * Uses customerVehicleProjection()'s allowlist plus the approved gallery, so a
 * buyer sees specification and asking price only — never purchase cost,
 * minimum price, seller identity or repair spend.
 */
export default async function CustomerVehicleSheet({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const repo = repoFor(getStore());

  const vehicle = await repo.table("Vehicles").get(id);
  if (!vehicle) notFound();

  const v = customerVehicleProjection(
    Object.fromEntries(Object.entries(vehicle).map(([k, val]) => [k, String(val ?? "")]))
  );
  const settings = await repo.settings();
  // Only photos explicitly approved for customer/public use.
  const photos = (await repo.table("VehiclePhotos").list({ where: (r) => r.vehicleId === id })).filter(
    (p) => p.publicApproved === "TRUE" && p.category !== "Inspection evidence"
  );

  const spec: Array<[string, string]> = [
    ["Make", v.make],
    ["Model", v.model],
    ["Variant", v.variant || "—"],
    ["Manufactured", v.manufactureYear],
    ["Registered", v.registrationYear],
    ["Fuel", v.fuel],
    ["Transmission", v.transmission],
    ["Body type", v.bodyType],
    ["Colour", v.colour],
    ["Odometer", `${v.odometerKm} km`],
    ["Previous owners", v.ownershipCount],
    ["Registered at", v.registrationLocation || "—"]
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 no-print">
        <Link className="btn-secondary" href="/customer">← Customer view</Link>
        <div className="flex gap-2">
          <Link className="btn-secondary" href={`/inventory/${id}`}>Open internal workspace</Link>
          <PrintLink />
        </div>
      </div>

      <article className="card p-6 print:border-0 print:shadow-none">
        <header className="border-b border-slate-200 pb-4">
          <p className="text-sm text-slate-500">{settings["showroom:showroomName"] ?? "Showroom"}</p>
          <h1 className="text-xl font-semibold text-slate-900">
            {v.manufactureYear} {v.title}
          </h1>
          <p className="mt-1 text-lg font-semibold text-brand-700">
            {formatINR(Number(v.askingPricePaise || "0"))}
          </p>
          <p className="text-xs text-slate-500">Stock reference {v.stockRef}</p>
        </header>

        {photos.length > 0 ? (
          <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.id}
                src={`/api/media/${p.fileId}`}
                alt={`${v.title} photo`}
                className="aspect-[4/3] w-full rounded-lg object-cover"
              />
            ))}
          </section>
        ) : null}

        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Specification</h2>
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
            {spec.map(([k, val]) => (
              <div key={k} className="flex justify-between gap-2 border-b border-slate-100 py-1">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-right font-medium text-slate-800">{val || "—"}</dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="mt-6 border-t border-slate-200 pt-3 text-xs text-slate-500">
          {settings["showroom:publicContactNote"] ||
            "Please contact the showroom to arrange a viewing or test drive."}
          {settings["showroom:phone"] ? ` · ${settings["showroom:phone"]}` : ""}
          <br />
          Price shown is the current asking price and is subject to change until a booking is confirmed.
        </footer>
      </article>
    </div>
  );
}
