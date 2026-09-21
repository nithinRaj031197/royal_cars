import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { can } from "@/lib/permissions";
import { uploadVehicleFile } from "@/server/services/media";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { email?: string; role?: import("@/lib/permissions").Role } | undefined;
  if (!user?.email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!can(user, "inventory.manage")) return NextResponse.json({ error: "Permission denied." }, { status: 403 });

  const url = new URL(req.url);
  const vehicleId = url.searchParams.get("vehicleId") ?? "";
  if (!vehicleId) return NextResponse.json({ error: "vehicleId is required" }, { status: 400 });

  const form = await req.formData();
  const file = form.get("file");
  const category = (form.get("category") as string) ?? "Gallery";
  if (!(file instanceof File)) return NextResponse.json({ error: "A file is required." }, { status: 400 });

  try {
    const result = await uploadVehicleFile(file, { vehicleId, category }, { actor: user.email });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = status >= 500 ? "Upload failed. The file was not saved — please retry." : (err as Error).message;
    return NextResponse.json({ error: message }, { status });
  }
}
