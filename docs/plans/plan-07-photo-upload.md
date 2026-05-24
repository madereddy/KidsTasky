# Plan 07 — Photo Upload UI + Captions

**Group:** C (requires Plan 03)
**Blocked by:** Plan 03 (PhotoManager lives inside SettingsView)

---

## Problem

`PhotoScreensaver.tsx` exists and rotates through photos, but it has no real data — it uses placeholder/hardcoded photos. The upload route `POST /photos/upload` is mocked with a hardcoded `parentId` and no real file handling. There is no UI to upload photos or add captions. The `family_photos` table has no caption column.

---

## What Already Exists

- `FamilyPhoto` type: `{ id, parentId, url, uploadedAt }`
- `src/server/modules/photos/service.ts` — `addPhoto(parentId, url)` inserts a DB row
- `src/server/modules/photos/routes.ts` — `POST /photos/upload` (mocked, no multer, hardcoded parentId)
- `src/components/shared/PhotoScreensaver.tsx` — exists, needs to be checked for how it gets photos
- `family_photos` table in DB (migration 008)

---

## Database

### Migration `015_add_photo_caption.sql`
Create at `src/server/migrations/015_add_photo_caption.sql`:

```sql
ALTER TABLE family_photos ADD COLUMN caption TEXT;
```

---

## Dependencies

- Add `multer` to the project:
  ```bash
  npm install multer
  npm install --save-dev @types/multer
  ```

---

## Files to Modify

### `src/types.ts`
Add caption to `FamilyPhoto`:
```ts
export interface FamilyPhoto {
  id: string;
  parentId: string;
  url: string;
  uploadedAt: string;
  caption?: string;   // add this
}
```

### `src/server/modules/photos/service.ts`
Replace minimal stub with full implementation:

```ts
import { db } from '../../db.js';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { FamilyPhoto } from '../../../types.js';

export const photosService = {
  addPhoto: (parentId: string, url: string): FamilyPhoto => {
    const id = randomUUID();
    const uploadedAt = new Date().toISOString();
    db.prepare('INSERT INTO family_photos (id, parentId, url, uploadedAt) VALUES (?, ?, ?, ?)')
      .run(id, parentId, url, uploadedAt);
    return { id, parentId, url, uploadedAt };
  },
  getPhotos: (parentId: string): FamilyPhoto[] => {
    return db.prepare('SELECT * FROM family_photos WHERE parentId = ? ORDER BY uploadedAt DESC')
      .all(parentId) as FamilyPhoto[];
  },
  updateCaption: (id: string, caption: string) => {
    db.prepare('UPDATE family_photos SET caption = ? WHERE id = ?').run(caption, id);
  },
  deletePhoto: (id: string): string | null => {
    const photo = db.prepare('SELECT url FROM family_photos WHERE id = ?').get(id) as { url: string } | undefined;
    db.prepare('DELETE FROM family_photos WHERE id = ?').run(id);
    return photo?.url ?? null; // return url so route can delete the file from disk
  },
};
```

### `src/server/modules/photos/routes.ts`
Replace mocked stub with real implementation:

```ts
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../../middleware/auth.js';
import { photosService } from './service.js';

const uploadsDir = path.resolve('uploads/photos');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

export const photosRouter = Router();

photosRouter.post('/photos/upload', requireAuth, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/photos/${req.file.filename}`;
  const photo = photosService.addPhoto(req.user.uid, url);
  res.status(201).json(photo);
});

photosRouter.get('/parents/:parentId/photos', requireAuth, (req, res) => {
  const photos = photosService.getPhotos(req.params.parentId);
  res.json(photos);
});

photosRouter.put('/photos/:id/caption', requireAuth, (req, res) => {
  photosService.updateCaption(req.params.id, req.body.caption ?? '');
  res.json({ success: true });
});

photosRouter.delete('/photos/:id', requireAuth, (req, res) => {
  const url = photosService.deletePhoto(req.params.id);
  // Delete file from disk
  if (url) {
    const filePath = path.resolve(url.replace(/^\//, ''));
    fs.unlink(filePath, () => {}); // best-effort, ignore error
  }
  res.json({ success: true });
});
```

### `server.ts` (Express entry point)
Ensure the `uploads/` directory is served as static files:
```ts
app.use('/uploads', express.static(path.resolve('uploads')));
```

### `src/components/shared/PhotoScreensaver.tsx`
Read the current file to understand its photo source, then modify to fetch real photos:

- Accept `parentId: string` prop
- On mount: fetch `GET /parents/:parentId/photos`
- Store `photos: FamilyPhoto[]` in state
- Display `photo.caption` as an overlay at the bottom of each slide:
  ```tsx
  {currentPhoto.caption && (
    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 text-white text-center">
      <p className="text-lg font-medium">{currentPhoto.caption}</p>
    </div>
  )}
  ```
- If `photos` is empty: fall back to current behavior (dark overlay / sleep mode)

---

## Files to Create

### `src/services/photos.ts`

```ts
import { fetchAPI } from './http';
import { FamilyPhoto } from '../types';

export const photosClientService = {
  getPhotos: (parentId: string): Promise<FamilyPhoto[]> =>
    fetchAPI(`/parents/${parentId}/photos`),

  uploadPhoto: async (file: File): Promise<FamilyPhoto> => {
    const formData = new FormData();
    formData.append('photo', file);
    const token = localStorage.getItem('kidtasker_token');
    const res = await fetch('/api/photos/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
      // Do NOT set Content-Type — browser sets it with boundary for multipart
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },

  updateCaption: (id: string, caption: string): Promise<void> =>
    fetchAPI(`/photos/${id}/caption`, { method: 'PUT', body: JSON.stringify({ caption }) }),

  deletePhoto: (id: string): Promise<void> =>
    fetchAPI(`/photos/${id}`, { method: 'DELETE' }),
};
```

### `src/components/parent/PhotoManager.tsx`
Photo management grid. Rendered inside `SettingsView` (Plan 03).

**Props:** `parentId: string`

**Layout:**
- Grid of photo thumbnails (3 columns)
- Each thumbnail:
  - `<img src={photo.url}>` (served from `/uploads/photos/...`)
  - Caption text below (click to edit inline)
  - Delete button (×) top-right corner with a confirmation step
- Upload area at the top:
  - Drag-and-drop zone or "Upload Photos" button
  - Hidden `<input type="file" accept="image/*" multiple>` triggered by button click
  - On file select: call `photosClientService.uploadPhoto(file)` for each file
  - Show upload progress per file (simple spinner or progress bar)

**Caption inline edit:**
- Click caption text → becomes an `<input>` with current caption value
- Blur or Enter → calls `photosClientService.updateCaption(id, caption)`
- Show a placeholder "Add caption..." when caption is empty

---

## Integration

### `src/components/parent/SettingsView.tsx` (from Plan 03)
Add a "Family Photos" section at the bottom:
```tsx
<section>
  <h3 className="text-lg font-semibold mb-3">Family Photos</h3>
  <p className="text-sm text-gray-500 mb-4">
    These photos display on the screensaver when the app is idle.
  </p>
  <PhotoManager parentId={parentId} />
</section>
```

---

## Acceptance Criteria

- [ ] Photos can be uploaded from the settings panel (single or multiple files)
- [ ] Uploaded photos appear in the screensaver rotation
- [ ] Captions can be added/edited per photo and show on the screensaver slide
- [ ] Photos can be deleted (removed from DB and disk)
- [ ] File size limit (10MB) is enforced with a user-facing error
- [ ] Non-image files are rejected
- [ ] Static file serving works — photo URLs load correctly in `<img>` tags
