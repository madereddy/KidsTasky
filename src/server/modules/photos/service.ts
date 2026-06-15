// src/server/modules/photos/service.ts
import { db } from '../../db.js';
import { randomUUID } from 'crypto';
import { FamilyPhoto } from '../../../types.js';

export const photosService = {
  addPhoto: (parentId: string, url: string): FamilyPhoto => {
    const id = randomUUID();
    const uploadedAt = new Date().toISOString();
    db.prepare('INSERT INTO family_photos (id, parentId, url, uploadedAt, caption) VALUES (?, ?, ?, ?, ?)').run(
      id, parentId, url, uploadedAt, null
    );
    return { id, parentId, url, uploadedAt, caption: undefined };
  },
  getPhotos: (parentId: string): FamilyPhoto[] => {
    return db.prepare('SELECT id, parentId, url, uploadedAt, caption FROM family_photos WHERE parentId = ? ORDER BY uploadedAt DESC')
      .all(parentId) as FamilyPhoto[];
  },
  updateCaption: (id: string, caption: string) => {
    db.prepare('UPDATE family_photos SET caption = ? WHERE id = ?').run(caption, id);
  },
  deletePhoto: (id: string): string | null => {
    const row = db.prepare('SELECT url FROM family_photos WHERE id = ?').get(id) as { url: string } | undefined;
    db.prepare('DELETE FROM family_photos WHERE id = ?').run(id);
    return row?.url ?? null;
  }
};

export function getPhotoParentId(photoId: string): string | null {
  const row = db.prepare('SELECT parentId FROM family_photos WHERE id = ?')
    .get(String(photoId)) as { parentId: string } | undefined;
  return row?.parentId ?? null;
}

export function getPhotoParentIdByUrl(apiUrl: string, legacyUrl: string): string | null {
  const row = db.prepare('SELECT parentId FROM family_photos WHERE url = ? OR url = ?')
    .get(apiUrl, legacyUrl) as { parentId: string } | undefined;
  return row?.parentId ?? null;
}

export function getExistingPhotoUrls(parentId: string, urls: string[]): string[] {
  if (urls.length === 0) return [];
  const placeholders = urls.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT url FROM family_photos WHERE parentId = ? AND url IN (${placeholders})`
  ).all(parentId, ...urls) as Array<{ url: string }>;
  return rows.map(r => r.url);
}
