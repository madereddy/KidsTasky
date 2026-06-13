import fs from 'fs';
import { db } from '../db.js';
import { ensurePhotosUploadsDir, getSafePhotoFilename, resolvePhotoUploadPath } from '../modules/photos/storage.js';
import { logger } from '../lib/logger.js';
import { markWorkerJobStart, markWorkerJobSuccess, markWorkerJobFailure } from './diagnostics.js';

const lastPhotoCleanupRun = new Map<string, number>();
let photoSweepUploadsDirUnavailable = false;

export async function runPhotoCleanup() {
  const startedAt = markWorkerJobStart('photoCleanup');
  try {
    const families = db.prepare(`
      SELECT parentId, photoCleanupEnabled, photoCleanupIntervalHours
      FROM family_settings
    `).all() as Array<{ parentId: string; photoCleanupEnabled?: number; photoCleanupIntervalHours?: number }>;

    const now = Date.now();
    let shouldRunGlobalOrphanSweep = false;
    for (const family of families) {
      if (!family.parentId || Number(family.photoCleanupEnabled ?? 1) !== 1) continue;
      const intervalHours = Math.max(1, Number(family.photoCleanupIntervalHours || 24));
      const intervalMs = intervalHours * 60 * 60 * 1000;
      const lastRun = lastPhotoCleanupRun.get(family.parentId) ?? 0;
      if (now - lastRun < intervalMs) continue;

      const photos = db.prepare('SELECT id, url FROM family_photos WHERE parentId = ?')
        .all(family.parentId) as Array<{ id: string; url: string }>;

      const parentExists = db.prepare('SELECT 1 FROM users WHERE uid = ?').get(family.parentId);
      for (const photo of photos) {
        const url = photo.url;
        // Extract filename for local photos only; skip remote URLs (Google Photos https*)
        let localFilename: string | null = null;
        if (url.startsWith('/api/photos/file/')) {
          localFilename = getSafePhotoFilename(url.replace('/api/photos/file/', ''));
        } else if (url.startsWith('/uploads/photos/')) {
          localFilename = getSafePhotoFilename(url.replace('/uploads/photos/', ''));
        }

        if (!parentExists) {
          db.prepare('DELETE FROM family_photos WHERE id = ?').run(photo.id);
          if (localFilename) {
            const filePath = resolvePhotoUploadPath(localFilename, ensurePhotosUploadsDir());
            if (filePath) {
              fs.unlink(filePath, () => {});
            }
          }
          continue;
        }

        // Only check file existence for local photos; remote URLs are always "present"
        if (localFilename) {
          const filePath = resolvePhotoUploadPath(localFilename, ensurePhotosUploadsDir());
          if (filePath && !fs.existsSync(filePath)) {
            db.prepare('DELETE FROM family_photos WHERE id = ?').run(photo.id);
          }
        }
      }
      shouldRunGlobalOrphanSweep = true;
      lastPhotoCleanupRun.set(family.parentId, now);
    }

    if (shouldRunGlobalOrphanSweep) {
      if (photoSweepUploadsDirUnavailable) {
        markWorkerJobSuccess('photoCleanup', startedAt);
        return;
      }
      let uploadsDir: string;
      try {
        uploadsDir = ensurePhotosUploadsDir();
      } catch (err) {
        photoSweepUploadsDirUnavailable = true;
        logger.error({ error: err }, 'worker_photo_sweep_uploads_dir_unavailable');
        return;
      }
      const trackedFiles = new Set(
        (db.prepare("SELECT url FROM family_photos WHERE url LIKE '/uploads/photos/%' OR url LIKE '/api/photos/file/%'")
          .all() as Array<{ url: string }>)
          .map((r) => getSafePhotoFilename(r.url))
          .filter((value): value is string => Boolean(value))
      );
      for (const file of fs.readdirSync(uploadsDir)) {
        if (!trackedFiles.has(file)) {
          const filePath = resolvePhotoUploadPath(file, uploadsDir);
          if (filePath) {
            fs.unlink(filePath, () => {});
          }
        }
      }
    }
    markWorkerJobSuccess('photoCleanup', startedAt);
  } catch (error) {
    markWorkerJobFailure('photoCleanup', startedAt, error);
    logger.error({ error }, 'worker_photo_cleanup_error');
    throw error;
  }
}
