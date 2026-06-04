import fs from "fs";
import path from "path";

type FsLike = Pick<typeof fs, "mkdirSync">;

export function getPhotosUploadsDir(): string {
  const configured = process.env.PHOTOS_UPLOADS_DIR?.trim();
  if (configured) return path.resolve(configured);
  return path.resolve("uploads/photos");
}

export function ensurePhotosUploadsDir(fsLike: FsLike = fs): string {
  const uploadsDir = getPhotosUploadsDir();
  fsLike.mkdirSync(uploadsDir, { recursive: true });
  return uploadsDir;
}

export function getSafePhotoFilename(input: string): string | null {
  const trimmed = String(input || "").trim();
  if (!trimmed) return null;
  const safeName = path.basename(trimmed);
  if (!safeName || safeName === "." || safeName === "..") return null;
  if (safeName !== trimmed) return null;
  if (safeName.includes("/") || safeName.includes("\\") || safeName.includes("\0")) return null;
  return safeName;
}

export function resolvePhotoUploadPath(filename: string, uploadsDir = getPhotosUploadsDir()): string | null {
  const safeName = getSafePhotoFilename(filename);
  if (!safeName) return null;
  const root = uploadsDir.endsWith(path.sep) ? uploadsDir.slice(0, -path.sep.length) : uploadsDir;
  return `${root}${path.sep}${safeName}`;
}
