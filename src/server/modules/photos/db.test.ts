// src/server/modules/photos/db.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { db } from '../../db.js';
import { photosService } from './service.js';

describe('Photos service/db', () => {
  it('stores, updates caption, lists by parent, and deletes', () => {
    const parentId = 'parent_photo_test';
    db.prepare('DELETE FROM family_photos WHERE parentId = ?').run(parentId);

    const added = photosService.addPhoto(parentId, '/uploads/photos/test-a.jpg');
    expect(added.parentId).toBe(parentId);

    photosService.updateCaption(added.id, 'Family trip');

    const list = photosService.getPhotos(parentId);
    expect(list.length).toBe(1);
    expect(list[0].caption).toBe('Family trip');

    const deletedUrl = photosService.deletePhoto(added.id);
    expect(deletedUrl).toBe('/uploads/photos/test-a.jpg');

    const after = photosService.getPhotos(parentId);
    expect(after.length).toBe(0);
  });
});
