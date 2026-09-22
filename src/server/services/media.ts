import { getRepo } from "@/lib/repo";
import { WriteContext } from "@/lib/store/types";
import { envConfig } from "@/lib/config/env";
import { googleAuthConfig, hasGoogleCredentials } from "@/lib/config/google-credentials";
import { IMAGE_MIME_TYPES, DOC_MIME_TYPES, MAX_UPLOAD_BYTES } from "@/lib/config/constants";
import { newUUID } from "@/lib/ids";

export interface UploadMeta {
  vehicleId: string;
  category: string; // "Gallery" | "Inspection" | "Document" | "Invoice" | "Identity"
  isPrimary?: boolean;
  inspectionId?: string;
  publicApproved?: boolean;
}

const DRIVE_FOLDER_BY_CATEGORY: Record<string, "photos" | "docs"> = {
  Gallery: "photos",
  Inspection: "photos",
  Document: "docs",
  Invoice: "docs",
  Identity: "docs"
};

async function driveClient() {
  const { google } = await import("googleapis");
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth(googleAuthConfig(["https://www.googleapis.com/auth/drive"]));
  return google.drive({ version: "v3", auth });
}

/** Uploads a file to Drive and records metadata in the Sheets tab. */
export async function uploadVehicleFile(
  file: File,
  meta: UploadMeta,
  ctx: WriteContext
): Promise<{ id: string; fileId: string; url: string }> {
  // Validate the file before checking configuration: a 15 MB file or a .exe is
  // wrong whether or not Drive is wired up, and the user should be told which
  // problem they actually have.
  if (file.size > MAX_UPLOAD_BYTES) {
    throw Object.assign(new Error("File is larger than the 15 MB limit."), { status: 400 });
  }
  const isImage = IMAGE_MIME_TYPES.includes(file.type);
  const isDoc = DOC_MIME_TYPES.includes(file.type);
  if (!isImage && !isDoc) {
    throw Object.assign(new Error("Unsupported file type. Use JPEG, PNG, WebP, HEIC, PDF or DOCX."), { status: 400 });
  }
  const folderKind = DRIVE_FOLDER_BY_CATEGORY[meta.category] ?? "photos";
  if (folderKind === "photos" && !isImage) {
    throw Object.assign(new Error("Photo categories require an image file."), { status: 400 });
  }

  if (!hasGoogleCredentials()) {
    throw Object.assign(
      new Error("Google Drive is not configured. Uploads require GOOGLE_SERVICE_ACCOUNT_FILE."),
      { status: 503 }
    );
  }

  const drive = await driveClient();
  const parentId = folderKind === "photos"
    ? envConfig.drivePhotoFolderId ?? envConfig.driveRootFolderId
    : envConfig.driveDocFolderId ?? envConfig.driveRootFolderId;

  const buffer = Buffer.from(await file.arrayBuffer());
  const res = await drive.files.create({
    requestBody: {
      name: `${meta.vehicleId}-${Date.now()}-${file.name}`,
      parents: parentId ? [parentId] : undefined,
      // Keep originals; optimization happens at display/projection time.
      properties: { app: "showroom-admin", vehicleId: meta.vehicleId, category: meta.category }
    },
    media: { mimeType: file.type, body: Buffer.from(buffer) }
  });
  const fileId = res.data.id;
  // No metadata row is written unless Drive returned a real file id, so a failed
  // upload leaves no orphaned record pointing at a file that does not exist.
  if (!fileId) throw Object.assign(new Error("Drive upload failed."), { status: 502 });

  // Permission: keep files private; the app proxies reads for signed-in staff.
  const url = `/api/media/${fileId}`;
  const repo = getRepo();
  const row: Record<string, string> = {
    vehicleId: meta.vehicleId,
    fileId,
    url,
    category: meta.category,
    isPrimary: meta.isPrimary ? "TRUE" : "FALSE",
    sortOrder: String(Date.now()),
    inspectionId: meta.inspectionId ?? "",
    uploadedBy: ctx.actor,
    mimeType: file.type,
    sizeBytes: String(file.size),
    width: "",
    height: "",
    publicApproved: meta.publicApproved ? "TRUE" : "FALSE"
  };
  if (meta.category === "Gallery" || meta.category === "Inspection") {
    await repo.table("VehiclePhotos").create(row, ctx);
  } else {
    await repo.table("VehicleDocuments").create(
      { ...row, type: meta.category, title: file.name, issueDate: "", expiryDate: "", notes: "", sensitive: meta.category === "Identity" ? "TRUE" : "FALSE" },
      ctx
    );
  }
  await repo.logActivity(ctx, "media.upload", meta.category === "Gallery" || meta.category === "Inspection" ? "VehiclePhotos" : "VehicleDocuments", fileId, `Uploaded ${file.name}`);
  return { id: fileId, fileId, url };
}

/** Streams a Drive file to an authenticated staff member. Files stay private. */
export async function readDriveFile(fileId: string): Promise<{ stream: NodeJS.ReadableStream; mimeType: string; name: string } | null> {
  if (!hasGoogleCredentials()) return null;
  const drive = await driveClient();
  try {
    const meta = await drive.files.get({ fileId, fields: "name,mimeType" });
    const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "stream" });
    return {
      stream: res.data as unknown as NodeJS.ReadableStream,
      mimeType: meta.data.mimeType ?? "application/octet-stream",
      name: meta.data.name ?? fileId
    };
  } catch {
    return null; // missing file handled gracefully upstream
  }
}

export async function setPrimaryPhoto(photoId: string, ctx: WriteContext): Promise<void> {
  const repo = getRepo();
  const photo = await repo.table("VehiclePhotos").get(photoId);
  if (!photo) throw Object.assign(new Error("Photo not found"), { status: 404 });
  const siblings = (await repo.table("VehiclePhotos").list()).filter((p) => p.vehicleId === photo.vehicleId);
  for (const s of siblings) {
    const makePrimary = s.id === photoId;
    if ((s.isPrimary === "TRUE") !== makePrimary) {
      await repo.table("VehiclePhotos").update(s.id, { isPrimary: makePrimary ? "TRUE" : "FALSE" }, s.version, ctx);
    }
  }
}

export async function reorderPhotos(vehicleId: string, orderedIds: string[], ctx: WriteContext): Promise<void> {
  const repo = getRepo();
  for (let i = 0; i < orderedIds.length; i++) {
    const p = await repo.table("VehiclePhotos").get(orderedIds[i] as string);
    if (p && p.vehicleId === vehicleId && p.sortOrder !== String(i)) {
      await repo.table("VehiclePhotos").update(p.id, { sortOrder: String(i) }, p.version, ctx);
    }
  }
}

export async function deletePhoto(photoId: string, ctx: WriteContext): Promise<void> {
  const repo = getRepo();
  const photo = await repo.table("VehiclePhotos").get(photoId);
  if (!photo) return;
  // Use the store's archive API rather than writing the audit column by hand,
  // so the version bump and actor stamp happen the same way everywhere.
  await repo.table("VehiclePhotos").archive(photoId, ctx);
  await repo.logActivity(ctx, "media.archive", "VehiclePhotos", photoId, "Photo archived");
}

void newUUID;
