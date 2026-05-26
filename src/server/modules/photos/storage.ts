import fs from "fs";
import path from "path";

type FsLike = Pick<typeof fs, "mkdirSync">;

export function getPhotosUploadsDir(): string {
  return path.resolve("uploads/photos");
}

export function ensurePhotosUploadsDir(fsLike: FsLike = fs): string {
  const uploadsDir = getPhotosUploadsDir();
  fsLike.mkdirSync(uploadsDir, { recursive: true });
  return uploadsDir;
}
