import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { can } from "@/lib/permissions";
import { getRepo } from "@/lib/repo";
import { toCsv } from "@/lib/csv";
import { formatINR } from "@/lib/money";
import { investmentBreakdown } from "@/server/services/work";
import { getStore } from "@/lib/store";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { email?: string; role?: import("@/lib/permissions").Role } | undefined;
  if (!user?.email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "inventory";
  const repo = getRepo();

  if (type === "inventory") {
    if (!can(user, "report.financial")) return NextResponse.json({ error: "Permission denied." }, { status: 403 });
    const vehicles = (await repo.table("Vehicles").list()).filter((v) => v.lifecycleState !== "In acquisition pipeline");
    const rows: Array<Array<string | number>> = [
      ["stockRef", "make", "model", "variant", "year", "fuel", "transmission", "km", "reg", "state", "purchase", "investment", "asking"]
    ];
    for (const v of vehicles) {
      const inv = await investmentBreakdown(getStore(), v.id);
      rows.push([
        v.stockRef ?? "", v.make ?? "", v.model ?? "", v.variant ?? "", v.manufactureYear ?? "",
        v.fuel ?? "", v.transmission ?? "", v.odometerKm ?? "", v.registrationNumber ?? "",
        v.lifecycleState ?? "", Number(v.purchasePricePaise ?? 0) / 100, inv.total / 100, Number(v.currentAskingPaise ?? 0) / 100
      ]);
    }
    return csvResponse(rows, "inventory.csv");
  }

  if (type === "sales") {
    if (!can(user, "report.financial")) return NextResponse.json({ error: "Permission denied." }, { status: 403 });
    const sales = await repo.table("Sales").list();
    const customers = await repo.table("Customers").list();
    const vehicles = await repo.table("Vehicles").list();
    const rows: Array<Array<string | number>> = [
      ["saleRef", "date", "stockRef", "customer", "price", "snapshotInvestment", "snapshotProfit", "status"]
    ];
    for (const s of sales) {
      const c = customers.find((x) => x.id === s.customerId);
      const v = vehicles.find((x) => x.id === s.vehicleId);
      rows.push([
        s.saleRef ?? "", s.saleDate ?? "", v?.stockRef ?? "", c?.name ?? "",
        Number(s.finalNetPricePaise ?? 0) / 100,
        Number(s.snapshotInvestmentPaise ?? 0) / 100,
        Number(s.snapshotGrossProfitPaise ?? 0) / 100,
        s.status ?? ""
      ]);
    }
    return csvResponse(rows, "sales.csv");
  }

  return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
}

function csvResponse(rows: Array<Array<string | number>>, filename: string): NextResponse {
  // toCsv escapes formula-injection prefixes (=, +, -, @) defensively.
  const body = toCsv(rows);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}

void formatINR;
