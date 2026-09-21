import { NextResponse } from "next/server";
import { withPermission } from "@/lib/api";
import { getRepo } from "@/lib/repo";
import { can } from "@/lib/permissions";

export const GET = withPermission("inventory.view", async ({ req, user }) => {
  const repo = getRepo();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").toLowerCase();
  const state = url.searchParams.get("state") ?? "";
  const fuel = url.searchParams.get("fuel") ?? "";
  const transmission = url.searchParams.get("transmission") ?? "";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = 25;

  let rows = await repo.table("Vehicles").list();
  if (q) {
    rows = rows.filter((v) =>
      [v.stockRef, v.registrationNumber, v.vin, v.make, v.model, v.variant, v.colour]
        .some((f) => (f ?? "").toLowerCase().includes(q))
    );
  }
  if (state) rows = rows.filter((v) => v.lifecycleState === state);
  if (fuel) rows = rows.filter((v) => v.fuel === fuel);
  if (transmission) rows = rows.filter((v) => v.transmission === transmission);

  const total = rows.length;
  const paged = rows.slice((page - 1) * pageSize, page * pageSize);
  const sellerProfitAllowed = can(user, "purchase.view");

  const vehicles = paged.map((v) => ({
    id: v.id,
    stockRef: v.stockRef,
    title: `${v.make ?? ""} ${v.model ?? ""} ${v.variant ?? ""}`.trim(),
    registrationNumber: v.registrationNumber,
    manufactureYear: v.manufactureYear,
    fuel: v.fuel,
    transmission: v.transmission,
    odometerKm: v.odometerKm,
    colour: v.colour,
    lifecycleState: v.lifecycleState,
    publicationState: v.publicationState,
    purchasePricePaise: sellerProfitAllowed ? Number(v.purchasePricePaise ?? 0) : null,
    currentAskingPaise: can(user, "sales.view") ? Number(v.currentAskingPaise ?? 0) : null
  }));

  return NextResponse.json({ vehicles, total, page, pageSize });
});
