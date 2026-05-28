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
const googleAccessTokenCache = new TTLCache<string>(45 * 60 * 1000, 500);
const GOOGLE_PHOTOS_RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const GOOGLE_PHOTOS_PICKER_SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchGooglePhotosJson<T>(url: string, init: RequestInit, retries = 2): Promise<T> {
  let lastStatus = 500;
  let lastBody = '';

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, init);
    if (response.ok) {
      return await response.json() as T;
    }

    lastStatus = response.status;
    lastBody = await response.text();
    console.error('[photos:google_api_error]', {
      url,
      status: response.status,
      attempt,
      bodySnippet: String(lastBody || '').slice(0, 500),
    });

    if (!GOOGLE_PHOTOS_RETRYABLE_STATUS.has(response.status) || attempt === retries) {
      break;
    }

    const retryAfterHeader = response.headers.get('retry-after');
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
    const delay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds * 1000
      : 500 * Math.pow(2, attempt);
    await sleep(delay);
  }

  if (lastStatus === 429) {
    throw Object.assign(
      new Error('Google Photos rate limit reached. Please wait a minute and try again.'),
      { status: 429 }
    );
  }
  const normalized = (lastBody || '').toLowerCase();
  if (lastStatus === 400 && (normalized.includes('pending_user_action') || normalized.includes('has not picked media items'))) {
    throw Object.assign(
      new Error('No photos are finalized in this Picker session yet. In Google Photos Picker, finish selection and confirm, then try import again.'),
      { status: 409 }
    );
  }
  if (lastStatus === 401 && (normalized.includes('unauthenticated') || normalized.includes('invalid authentication credentials'))) {
    throw Object.assign(
      new Error('Google authentication expired or invalid. Reconnect Google and approve Calendar + Photos access again.'),
      { status: 401 }
    );
  }
  if ((lastStatus === 401 || lastStatus === 403) && (
    normalized.includes('insufficient') ||
    normalized.includes('scope') ||
    normalized.includes('permission') ||
    normalized.includes('not authorized')
  )) {
    throw Object.assign(
      new Error('Google Photos permission is missing. Reconnect Google and grant Google Photos access.'),
      { status: 403 }
    );
  }
  throw Object.assign(new Error(lastBody || 'Failed to fetch Google Photos data'), { status: lastStatus });
}

async function resolvePickerMediaItemBaseUrl(token: string, mediaItemId: string, sessionId?: string): Promise<string | null> {
  const candidates: string[] = [];
  if (sessionId) {
    candidates.push(`https://photospicker.googleapis.com/v1/mediaItems/${encodeURIComponent(mediaItemId)}?sessionId=${encodeURIComponent(sessionId)}`);
  }
  candidates.push(`https://photospicker.googleapis.com/v1/mediaItems/${encodeURIComponent(mediaItemId)}`);

  for (const url of candidates) {
    try {
      const data = await fetchGooglePhotosJson<any>(url, {
        headers: { Authorization: `Bearer ${token}` },
      }, 0);
      const candidate = String(data?.baseUrl || data?.mediaFile?.baseUrl || '').trim();
      if (candidate) return candidate;
    } catch {
      // Try next candidate shape.
    }
  }
  return null;
}

async function getGoogleAccessToken(parentId: string): Promise<string | null> {
  const cached = googleAccessTokenCache.get(parentId);
  if (cached) return cached;

  const conn = syncService.getActiveGoogleConnection(parentId);
  if (!conn) return null;
  if (conn.accessToken) {
    googleAccessTokenCache.set(parentId, conn.accessToken);
    return conn.accessToken;
  }
  if (!conn.refreshToken) return null;

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
    const { credentials } = await oauth2.refreshAccessToken();
    const accessToken = credentials.access_token || conn.accessToken;
    const refreshToken = credentials.refresh_token || conn.refreshToken || null;
    if (accessToken || refreshToken) {
      db.prepare('UPDATE sync_connections SET accessToken = ?, refreshToken = ? WHERE id = ?')
        .run(accessToken || null, refreshToken, conn.id);
    }
    console.log('[photos:token_refresh_ok]', {
      parentId,
      connectionId: conn.id,
      hasAccessToken: Boolean(accessToken),
      hasRefreshToken: Boolean(refreshToken),
    });
    if (accessToken) googleAccessTokenCache.set(parentId, accessToken);
    return accessToken || null;
  } catch (error: any) {
    const message = String(error?.message || '');
    console.error('[photos:token_refresh_failed]', {
      parentId,
      connectionId: conn.id,
      message,
    });
    if (message.toLowerCase().includes('invalid_grant')) {
      return null;
    }
    if (conn.accessToken) {
      googleAccessTokenCache.set(parentId, conn.accessToken);
      return conn.accessToken;
    }
    return null;
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
  console.warn('[photos:legacy_library_api_disabled]', { parentId: req.params.parentId, endpoint: 'albums' });
  return res.status(410).json({
    error: 'Google Photos library album browsing is no longer supported by Google Photos Library API (March 31, 2025). Use local uploads for now; Picker API migration required.'
  });
});

photosRouter.get('/parents/:parentId/google-photos/albums/:albumId/media', requireAuth, async (req, res) => {
  const userParentId = (req as any).user?.role === 'parent' ? (req as any).user?.uid : (req as any).user?.parentId;
  if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
  console.warn('[photos:legacy_library_api_disabled]', { parentId: req.params.parentId, endpoint: 'media', albumId: req.params.albumId });
  return res.status(410).json({
    error: 'Google Photos library media browsing is no longer supported by Google Photos Library API (March 31, 2025). Use local uploads for now; Picker API migration required.'
  });
});

photosRouter.post('/parents/:parentId/google-photos/picker/session', requireAuth, async (req, res) => {
  const userParentId = (req as any).user?.role === 'parent' ? (req as any).user?.uid : (req as any).user?.parentId;
  if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });

  const token = await getGoogleAccessToken(String(req.params.parentId));
  if (!token) return res.status(401).json({ error: 'Google authentication expired or invalid. Reconnect Google and approve Calendar + Photos access again.' });

  try {
    const data = await fetchGooglePhotosJson<any>('https://photospicker.googleapis.com/v1/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const sessionId = data?.id || data?.name?.split('/').pop();
    const pickerUri = data?.pickerUri || data?.pickerUrl || data?.picker_url || null;
    if (!sessionId || !pickerUri) {
      return res.status(502).json({ error: 'Picker session created but response was missing session id or picker URL.' });
    }
    return res.json({ sessionId, pickerUri, raw: data });
  } catch (e: any) {
    const message = String(e?.message || '');
    if (message.toLowerCase().includes('scope') || message.toLowerCase().includes('permission') || message.toLowerCase().includes('insufficient')) {
      return res.status(403).json({ error: `Google Photos Picker scope is missing (${GOOGLE_PHOTOS_PICKER_SCOPE}). Reconnect Google and approve Photos Picker access.` });
    }
    return res.status(e?.status || 500).json({ error: message || 'Failed to create Google Photos Picker session' });
  }
});

photosRouter.get('/parents/:parentId/google-photos/picker/sessions/:sessionId/media-items', requireAuth, async (req, res) => {
  const userParentId = (req as any).user?.role === 'parent' ? (req as any).user?.uid : (req as any).user?.parentId;
  if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });

  const token = await getGoogleAccessToken(String(req.params.parentId));
  if (!token) return res.status(401).json({ error: 'Google authentication expired or invalid. Reconnect Google and approve Calendar + Photos access again.' });

  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 50)));
  const pageToken = String(req.query.pageToken || '');
  const qs = new URLSearchParams({ pageSize: String(pageSize), sessionId: String(req.params.sessionId) });
  if (pageToken) qs.set('pageToken', pageToken);
  const pickerMediaItemsUrl = new URL('https://photospicker.googleapis.com/v1/mediaItems');
  pickerMediaItemsUrl.search = qs.toString();

  try {
    const data = await fetchGooglePhotosJson<any>(pickerMediaItemsUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const rawItems = (data?.mediaItems || []);
    console.log('[photos:picker_media_items]', {
      parentId: req.params.parentId,
      sessionId: req.params.sessionId,
      count: rawItems.length,
      firstKeys: rawItems[0] ? Object.keys(rawItems[0]) : [],
    });
    const items = rawItems.map((m: any) => ({
      id: m.id,
      baseUrl: m.baseUrl || m.mediaFile?.baseUrl || '',
      filename: m.filename || '',
    }));
    return res.json({ items, nextPageToken: data?.nextPageToken || null });
  } catch (e: any) {
    return res.status(e?.status || 500).json({ error: e?.message || 'Failed to fetch picker media items' });
  }
});

photosRouter.post('/parents/:parentId/google-photos/picker/import', requireAuth, async (req, res) => {
  const userParentId = (req as any).user?.role === 'parent' ? (req as any).user?.uid : (req as any).user?.parentId;
  if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
  const parentId = String(req.params.parentId);
  const sessionId = String(req.body?.sessionId || '').trim();
  const token = await getGoogleAccessToken(parentId);
  if (!token) return res.status(401).json({ error: 'Google authentication expired or invalid. Reconnect Google and approve Calendar + Photos access again.' });

  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) return res.status(400).json({ error: 'No selected media items provided' });

  let imported = 0;
  let skipped = 0;
  let unresolved = 0;
  console.log('[photos:picker_import_start]', { parentId, sessionId, incoming: items.length });
  const normalizedUrls: string[] = [];
  for (const item of items) {
    let baseUrl = String(item?.baseUrl || '').trim();
    if (!baseUrl) {
      const mediaItemId = String(item?.id || '').trim();
      if (mediaItemId) {
        baseUrl = (await resolvePickerMediaItemBaseUrl(token, mediaItemId, sessionId)) || '';
      }
    }
    if (!baseUrl) {
      unresolved += 1;
      continue;
    }
    normalizedUrls.push(baseUrl.includes('=') ? baseUrl : `${baseUrl}=w1600-h1200`);
  }

  const uniqueUrls = Array.from(new Set(normalizedUrls));
  if (uniqueUrls.length === 0) {
    googleMediaCache.clearPrefix(`${parentId}:`);
    console.log('[photos:picker_import_done]', { parentId, imported, skipped, unresolved });
    return res.json({ success: true, imported, skipped, unresolved });
  }

  const existingRows = db.prepare(
    `SELECT url FROM family_photos WHERE parentId = ? AND url IN (${uniqueUrls.map(() => '?').join(',')})`
  ).all(parentId, ...uniqueUrls) as Array<{ url: string }>;
  const existingSet = new Set(existingRows.map((row) => row.url));

  for (const url of uniqueUrls) {
    if (existingSet.has(url)) {
      skipped += 1;
      continue;
    }
    photosService.addPhoto(parentId, url);
    imported += 1;
  }
  googleMediaCache.clearPrefix(`${parentId}:`);
  console.log('[photos:picker_import_done]', { parentId, imported, skipped, unresolved });
  return res.json({ success: true, imported, skipped, unresolved });
});
