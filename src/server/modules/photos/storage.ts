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
