// src/server/modules/photos/routes.ts
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { google } from 'googleapis';
import { requireAuth } from '../../middleware/auth.js';
import { photosService } from './service.js';
import { ensurePhotosUploadsDir, getPhotosUploadsDir } from './storage.js';
import { syncService } from '../sync/service.js';
import { db } from '../../db.js';
import { TTLCache } from '../../lib/ttlCache.js';

import { randomUUID } from 'crypto';

export const photosRouter = Router();
const googleAlbumsCache = new TTLCache<any[]>(5 * 60 * 1000, 500);
const googleMediaCache = new TTLCache<any[]>(2 * 60 * 1000, 2000);

async function getGoogleAccessToken(parentId: string): Promise<string | null> {
  const conn = syncService.getActiveGoogleConnection(parentId);
  if (!conn) return null;

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
  oauth2.setCredentials({
    access_token: conn.accessToken,
    refresh_token: conn.refreshToken,
  });

  try {
    const tokenResult = await oauth2.getAccessToken();
    const accessToken = tokenResult.token || conn.accessToken;
    if (accessToken && accessToken !== conn.accessToken) {
      db.prepare('UPDATE sync_connections SET accessToken = ? WHERE id = ?').run(accessToken, conn.id);
    }
    return accessToken || null;
  } catch {
    return conn.accessToken || null;
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      const uploadsDir = ensurePhotosUploadsDir();
      cb(null, uploadsDir);
    } catch (error) {
      cb(error as Error, getPhotosUploadsDir());
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || ".jpg");
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) return cb(null, true);
    return cb(new Error("Only image files allowed"));
  }
});

photosRouter.post('/photos/upload', requireAuth, upload.single("photo"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const parentId = (req as any).user?.role === "parent" ? (req as any).user.uid : (req as any).user?.parentId;
  if (!parentId) return res.status(403).json({ error: "Missing parent context" });

  const url = `/uploads/photos/${req.file.filename}`;
  const result = photosService.addPhoto(parentId, url);
  googleMediaCache.clearPrefix(`${parentId}:`);
  return res.status(201).json(result);
});

photosRouter.get("/parents/:parentId/photos", requireAuth, (req, res) => {
  const userParentId = (req as any).user?.role === "parent" ? (req as any).user.uid : (req as any).user?.parentId;
  if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
  const photos = photosService.getPhotos(String(req.params.parentId));
  res.json(photos);
});

photosRouter.put("/photos/:id/caption", requireAuth, (req, res) => {
  photosService.updateCaption(String(req.params.id), String(req.body?.caption ?? ""));
  res.json({ success: true });
});

photosRouter.delete("/photos/:id", requireAuth, (req, res) => {
  const parentId = (req as any).user?.role === "parent" ? (req as any).user.uid : (req as any).user?.parentId;
  const url = photosService.deletePhoto(String(req.params.id));
  if (url) {
    const uploadsBase = path.resolve("uploads");
    const filePath = path.resolve(url.replace(/^\//, ""));
    if (filePath.startsWith(uploadsBase + path.sep) || filePath.startsWith(uploadsBase + "/")) {
      fs.unlink(filePath, () => {});
    }
  }
  if (parentId) googleMediaCache.clearPrefix(`${parentId}:`);
  res.json({ success: true });
});

photosRouter.get('/parents/:parentId/google-photos/albums', requireAuth, async (req, res) => {
  const userParentId = (req as any).user?.role === 'parent' ? (req as any).user?.uid : (req as any).user?.parentId;
  if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });

  const token = await getGoogleAccessToken(String(req.params.parentId));
  if (!token) return res.status(400).json({ error: 'Google account not connected for this family.' });

  try {
    const cacheKey = `${req.params.parentId}:albums`;
    const albums = await googleAlbumsCache.getOrLoad(cacheKey, async () => {
      const r = await fetch('https://photoslibrary.googleapis.com/v1/albums?pageSize=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const txt = await r.text();
        throw Object.assign(new Error(txt || 'Failed to fetch Google Photos albums'), { status: r.status });
      }
      const data = await r.json() as any;
      return (data.albums || []).map((a: any) => ({
        id: a.id,
        title: a.title || 'Untitled album',
        mediaItemsCount: Number(a.mediaItemsCount || 0),
        coverPhotoBaseUrl: a.coverPhotoBaseUrl || null,
      }));
    });
    res.json(albums);
  } catch (e: any) {
    res.status(e?.status || 500).json({ error: e?.message || 'Failed to fetch Google Photos albums' });
  }
});

photosRouter.get('/parents/:parentId/google-photos/albums/:albumId/media', requireAuth, async (req, res) => {
  const userParentId = (req as any).user?.role === 'parent' ? (req as any).user?.uid : (req as any).user?.parentId;
  if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });

  const token = await getGoogleAccessToken(String(req.params.parentId));
  if (!token) return res.status(400).json({ error: 'Google account not connected for this family.' });

  const pageSize = Math.min(100, Math.max(1, Number(req.query.limit || 30)));
  try {
    const cacheKey = `${req.params.parentId}:${req.params.albumId}:${pageSize}`;
    const items = await googleMediaCache.getOrLoad(cacheKey, async () => {
      const r = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          albumId: req.params.albumId,
          pageSize,
        }),
      });
      if (!r.ok) {
        const txt = await r.text();
        throw Object.assign(new Error(txt || 'Failed to fetch Google Photos media'), { status: r.status });
      }
      const data = await r.json() as any;
      return (data.mediaItems || [])
        .filter((m: any) => !!m.baseUrl && (m.mediaMetadata?.photo || m.mimeType?.startsWith('image/')))
        .map((m: any) => ({
          id: m.id,
          baseUrl: m.baseUrl,
          filename: m.filename,
        }));
    });
    res.json(items);
  } catch (e: any) {
    res.status(e?.status || 500).json({ error: e?.message || 'Failed to fetch Google Photos media' });
  }
});
