import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { can, Role } from "@/lib/permissions";
import { templateCsv } from "@/server/services/imports";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { email?: string; role?: Role } | undefined;
  if (!user?.email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!can(user, "import.run")) return NextResponse.json({ error: "Permission denied." }, { status: 403 });
  const entity = new URL(req.url).searchParams.get("entity") ?? "Vehicles";
  const allowed = ["Vehicles", "Customers", "Vendors", "Expenses"];
  if (!allowed.includes(entity)) return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
  const csv = templateCsv(entity as "Vehicles");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${entity.toLowerCase()}-template.csv"`
    }
  });
}
