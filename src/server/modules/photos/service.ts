// src/server/modules/photos/service.ts
import { db } from '../../db.js';
import { randomUUID } from 'crypto';

export const photosService = {
  addPhoto: (parentId: string, url: string) => {
    const id = randomUUID();
    db.prepare('INSERT INTO family_photos (id, parentId, url, uploadedAt) VALUES (?, ?, ?, ?)').run(
      id, parentId, url, new Date().toISOString()
    );
    return { url, id };
  }
};
