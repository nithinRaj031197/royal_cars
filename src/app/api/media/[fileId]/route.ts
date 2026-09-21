import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { can, Role } from "@/lib/permissions";
import { readDriveFile } from "@/server/services/media";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

/**
 * Private file retrieval.
 *
 * Being signed in is not enough. A file is served only when the app has a
 * metadata row for it, and only to a role allowed to see that kind of file:
 *
 *  - unknown id            → 404, so a staff session cannot be used to walk the
 *                            service account's Drive by guessing file ids
 *  - photos / documents    → inventory.view
 *  - documents marked      → document.sensitive (owner, sales, accounts), so an
 *    sensitive (identity)    identity scan is not readable by every role
 */
export async function GET(_req: NextRequest, routeCtx: { params: Promise<{ fileId: string }> }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { email?: string; role?: Role } | undefined;
  if (!user?.email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { fileId } = await routeCtx.params;
  const store = getStore();

  const [photos, docs] = await Promise.all([
    store.list("VehiclePhotos", { activeOnly: false }),
    store.list("VehicleDocuments", { activeOnly: false })
  ]);
  const photo = photos.find((p) => p.fileId === fileId);
  const doc = docs.find((d) => d.fileId === fileId);
  const record = photo ?? doc;

  // Only files this application recorded are retrievable through it.
  if (!record) return NextResponse.json({ error: "File not found." }, { status: 404 });

  if (!can(user, "inventory.view")) {
    return NextResponse.json({ error: "You do not have permission to view this file." }, { status: 403 });
  }
  if (doc && doc.sensitive === "TRUE" && !can(user, "document.sensitive")) {
    return NextResponse.json({ error: "You do not have permission to view this document." }, { status: 403 });
  }

  const file = await readDriveFile(fileId);
  // Metadata exists but the file does not: an orphaned record, reported by the
  // reconciliation report. Fail clearly rather than with a broken stream.
  if (!file) {
    return NextResponse.json({ error: "File is missing from Drive, or Drive is not configured." }, { status: 404 });
  }

  return new NextResponse(file.stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.name)}"`,
      "Cache-Control": "private, no-store"
    }
  });
}
