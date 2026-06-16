import { TTLCache } from '../../lib/ttlCache.js';
import { logger } from '../../lib/logger.js';
import { syncService } from '../sync/service.js';

const googleMediaCache = new TTLCache<any[]>(2 * 60 * 1000, 2000, 'google-photos-media');
const googleAccessTokenCache = new TTLCache<string>(45 * 60 * 1000, 500, 'google-photos-access-token');
const GOOGLE_PHOTOS_RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export const GOOGLE_PHOTOS_PICKER_SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clearGooglePhotosMediaCache(parentId: string) {
  googleMediaCache.clearPrefix(`${parentId}:`);
}

export async function fetchGooglePhotosJson<T>(url: string, init: RequestInit, retries = 2): Promise<T> {
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
      { status: 429 },
    );
  }
  const normalized = (lastBody || '').toLowerCase();
  if (lastStatus === 400 && (normalized.includes('pending_user_action') || normalized.includes('has not picked media items'))) {
    throw Object.assign(
      new Error('No photos are finalized in this Picker session yet. In Google Photos Picker, finish selection and confirm, then try import again.'),
      { status: 409 },
    );
  }
  if (lastStatus === 401 && (normalized.includes('unauthenticated') || normalized.includes('invalid authentication credentials'))) {
    throw Object.assign(
      new Error('Google authentication expired or invalid. Reconnect Google and approve Calendar + Photos access again.'),
      { status: 401 },
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
      { status: 403 },
    );
  }
  throw Object.assign(new Error(lastBody || 'Failed to fetch Google Photos data'), { status: lastStatus });
}

export async function resolvePickerMediaItemBaseUrl(
  token: string,
  mediaItemId: string,
  sessionId?: string,
): Promise<string | null> {
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

export async function getGoogleAccessToken(parentId: string, forceRefresh = false): Promise<string | null> {
  const cached = forceRefresh ? null : googleAccessTokenCache.get(parentId);
  if (cached) return cached;

  const conn = syncService.getActiveGoogleConnection(parentId);
  if (!conn) return null;
  if (!forceRefresh && conn.accessToken) {
    googleAccessTokenCache.set(parentId, conn.accessToken);
    return conn.accessToken;
  }
  if (!conn.refreshToken) return null;

  try {
    const refreshed = await syncService.refreshGoogleConnectionTokens(conn);
    logger.info({
      parentId,
      connectionId: conn.id,
      hasAccessToken: Boolean(refreshed.accessToken),
      hasRefreshToken: Boolean(refreshed.refreshToken),
    }, 'photos_token_refresh_ok');
    if (refreshed.accessToken) googleAccessTokenCache.set(parentId, refreshed.accessToken);
    return refreshed.accessToken || null;
  } catch (error: any) {
    const message = String(error?.message || '');
    logger.error({
      parentId,
      connectionId: conn.id,
      status: error?.response?.status ?? error?.code ?? null,
      message,
    }, 'photos_token_refresh_failed');
    if (message.toLowerCase().includes('invalid_grant')) {
      return null;
    }
    if (!forceRefresh && conn.accessToken) {
      googleAccessTokenCache.set(parentId, conn.accessToken);
      return conn.accessToken;
    }
    return null;
  }
}

export async function withGooglePhotosToken<T>(
  parentId: string,
  operation: (token: string) => Promise<T>,
): Promise<T> {
  const initialToken = await getGoogleAccessToken(parentId);
  if (!initialToken) {
    throw Object.assign(
      new Error('Google authentication expired or invalid. Reconnect Google and approve Calendar + Photos access again.'),
      { status: 401 },
    );
  }

  try {
    return await operation(initialToken);
  } catch (error: any) {
    if (error?.status !== 401) throw error;
    googleAccessTokenCache.clearPrefix(parentId);
    const refreshedToken = await getGoogleAccessToken(parentId, true);
    if (!refreshedToken || refreshedToken === initialToken) throw error;
    return await operation(refreshedToken);
  }
}
