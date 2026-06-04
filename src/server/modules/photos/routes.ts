// src/server/modules/photos/routes.ts
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { google } from 'googleapis';
import { requireAuth, assertParentScope, getParentId } from '../../middleware/auth.js';
import { photosService } from './service.js';
import { ensurePhotosUploadsDir, getPhotosUploadsDir, getSafePhotoFilename, resolvePhotoUploadPath } from './storage.js';
import { syncService } from '../sync/service.js';
import { db } from '../../db.js';
import { TTLCache } from '../../lib/ttlCache.js';
import { logSecurityEvent } from '../../lib/securityLog.js';
import { logger } from '../../lib/logger.js';

import { randomUUID } from 'crypto';

export const photosRouter = Router();

// Auth-protected file endpoint — replaces unauthenticated static /uploads serving
photosRouter.get('/photos/file/:filename', requireAuth, (req, res) => {
  const filename = req.params.filename as string;
  const caller = (req as any).user as { uid: string; role: string; parentId: string };
  const userParentId = caller.role === 'parent' ? caller.uid : caller.parentId;

  // Find photo by filename to verify family ownership
  const apiUrl = `/api/photos/file/${filename}`;
  const legacyUrl = `/uploads/photos/${filename}`;
  const photo = db.prepare(
    'SELECT parentId FROM family_photos WHERE url = ? OR url = ?'
  ).get(apiUrl, legacyUrl) as { parentId: string } | undefined;

  if (!photo || photo.parentId !== userParentId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const photosDir = getPhotosUploadsDir();
  const safeName = getSafePhotoFilename(filename);
  const filePath = safeName ? resolvePhotoUploadPath(safeName, photosDir) : null;
  if (!safeName || !filePath) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  res.type(path.extname(safeName));
  fs.createReadStream(filePath)
    .on('error', () => {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to read photo file' });
      } else {
        res.destroy();
      }
    })
    .pipe(res);
});

const googleAlbumsCache = new TTLCache<any[]>(5 * 60 * 1000, 500, 'google-photos-albums');
const googleMediaCache = new TTLCache<any[]>(2 * 60 * 1000, 2000, 'google-photos-media');
const googleAccessTokenCache = new TTLCache<string>(45 * 60 * 1000, 500, 'google-photos-access-token');
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
    logger.error({
      url,
      status: response.status,
      attempt,
      bodySnippet: String(lastBody || '').slice(0, 500),
    }, 'photos_google_api_error');

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
    logger.info({
      parentId,
      connectionId: conn.id,
      hasAccessToken: Boolean(accessToken),
      hasRefreshToken: Boolean(refreshToken),
    }, 'photos_token_refresh_ok');
    if (accessToken) googleAccessTokenCache.set(parentId, accessToken);
    return accessToken || null;
  } catch (error: any) {
    const message = String(error?.message || '');
    logger.error({
      parentId,
      connectionId: conn.id,
      message,
    }, 'photos_token_refresh_failed');
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

function detectImageType(buffer: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return 'png';
  if (buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) return 'webp';
  return null;
}

photosRouter.post('/photos/upload', requireAuth, upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const parentId = (req as any).user?.role === "parent" ? (req as any).user.uid : (req as any).user?.parentId;
  if (!parentId) return res.status(403).json({ error: "Missing parent context" });
  const filePath = req.file.path;
  let finalFilename = req.file.filename;
  try {
    const fd = await fs.promises.open(filePath, 'r');
    const header = Buffer.alloc(16);
    await fd.read(header, 0, header.length, 0);
    await fd.close();
    const detected = detectImageType(header);
    if (!detected) {
      await fs.promises.unlink(filePath).catch(() => {});
      logSecurityEvent('photos.upload.rejected_invalid_magic', {
        parentId,
        mimetype: req.file.mimetype,
        filename: req.file.filename,
      });
      return res.status(400).json({ error: 'Unsupported or invalid image file.' });
    }
    const expectedExt = `.${detected}`;
    if (!finalFilename.toLowerCase().endsWith(expectedExt)) {
      const base = finalFilename.replace(/\.[^.]+$/, '');
      const renamed = `${base}${expectedExt}`;
      const dir = path.dirname(filePath);
      const renamedPath = `${dir}${path.sep}${renamed}`;
      await fs.promises.rename(filePath, renamedPath);
      finalFilename = renamed;
    }
  } catch (error: any) {
    logSecurityEvent('photos.upload.validation_failed', {
      parentId,
      filename: req.file.filename,
      error: String(error?.message || error),
    }, 'error');
    return res.status(500).json({ error: 'Failed to validate uploaded image.' });
  }

  const url = `/api/photos/file/${finalFilename}`;
  const result = photosService.addPhoto(parentId, url);
  logSecurityEvent('photos.upload.accepted', { parentId, filename: finalFilename }, 'info');
  googleMediaCache.clearPrefix(`${parentId}:`);
  return res.status(201).json(result);
});

photosRouter.get("/parents/:parentId/photos", requireAuth, assertParentScope, (req, res) => {
  const photos = photosService.getPhotos(String(req.params.parentId));
  res.json(photos);
});

photosRouter.put("/photos/:id/caption", requireAuth, (req, res) => {
  const callerParentId = getParentId(req);
  const photo = db.prepare('SELECT parentId FROM family_photos WHERE id = ?').get(String(req.params.id)) as { parentId: string } | undefined;
  if (!photo) return res.status(404).json({ error: 'Not found' });
  if (photo.parentId !== callerParentId) return res.status(403).json({ error: 'Forbidden' });
  photosService.updateCaption(String(req.params.id), String(req.body?.caption ?? ""));
  res.json({ success: true });
});

photosRouter.delete("/photos/:id", requireAuth, (req, res) => {
  const parentId = getParentId(req);
  // Verify family ownership before deleting — without this any authenticated
  // user could delete another family's photo by id (IDOR).
  const owner = db.prepare('SELECT parentId FROM family_photos WHERE id = ?').get(String(req.params.id)) as { parentId: string } | undefined;
  if (!owner) return res.status(404).json({ error: 'Not found' });
  if (owner.parentId !== parentId) return res.status(403).json({ error: 'Forbidden' });
  const url = photosService.deletePhoto(String(req.params.id));
  if (url) {
    // Handle both URL formats: /api/photos/file/{name} and legacy /uploads/photos/{name}
    const photosDir = getPhotosUploadsDir();
    let filename: string | null = null;
    if (url.startsWith('/api/photos/file/')) {
      filename = getSafePhotoFilename(url.replace('/api/photos/file/', ''));
    } else if (url.startsWith('/uploads/photos/')) {
      filename = getSafePhotoFilename(url.replace('/uploads/photos/', ''));
    }
    if (filename) {
      const filePath = resolvePhotoUploadPath(filename, photosDir);
      if (filePath) {
        fs.unlink(filePath, () => {});
      }
    }
  }
  if (parentId) googleMediaCache.clearPrefix(`${parentId}:`);
  res.json({ success: true });
});

photosRouter.get('/parents/:parentId/google-photos/albums', requireAuth, assertParentScope, async (req, res) => {
  logger.warn({ parentId: req.params.parentId, endpoint: 'albums' }, 'photos_legacy_library_api_disabled');
  return res.status(410).json({
    error: 'Google Photos library album browsing is no longer supported by Google Photos Library API (March 31, 2025). Use local uploads for now; Picker API migration required.'
  });
});

photosRouter.get('/parents/:parentId/google-photos/albums/:albumId/media', requireAuth, assertParentScope, async (req, res) => {
  logger.warn({ parentId: req.params.parentId, endpoint: 'media', albumId: req.params.albumId }, 'photos_legacy_library_api_disabled');
  return res.status(410).json({
    error: 'Google Photos library media browsing is no longer supported by Google Photos Library API (March 31, 2025). Use local uploads for now; Picker API migration required.'
  });
});

photosRouter.post('/parents/:parentId/google-photos/picker/session', requireAuth, assertParentScope, async (req, res) => {

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

photosRouter.get('/parents/:parentId/google-photos/picker/sessions/:sessionId/media-items', requireAuth, assertParentScope, async (req, res) => {

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
    logger.info({
      parentId: req.params.parentId,
      sessionId: req.params.sessionId,
      count: rawItems.length,
      firstKeys: rawItems[0] ? Object.keys(rawItems[0]) : [],
    }, 'photos_picker_media_items');
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

photosRouter.post('/parents/:parentId/google-photos/picker/import', requireAuth, assertParentScope, async (req, res) => {
  const parentId = String(req.params.parentId);
  const sessionId = String(req.body?.sessionId || '').trim();
  const token = await getGoogleAccessToken(parentId);
  if (!token) return res.status(401).json({ error: 'Google authentication expired or invalid. Reconnect Google and approve Calendar + Photos access again.' });

  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) return res.status(400).json({ error: 'No selected media items provided' });

  let imported = 0;
  let skipped = 0;
  let unresolved = 0;
  logger.info({ parentId, sessionId, incoming: items.length }, 'photos_picker_import_start');
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
    logger.info({ parentId, imported, skipped, unresolved }, 'photos_picker_import_done');
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
  logger.info({ parentId, imported, skipped, unresolved }, 'photos_picker_import_done');
  return res.json({ success: true, imported, skipped, unresolved });
});
