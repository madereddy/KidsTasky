import { fetchAPI } from './http';
import { FamilySettings } from '../types';
import { SyncCalendar } from '../types';

const SETTINGS_TTL_MS = 10_000;
const CALENDARS_TTL_MS = 10_000;
const VISIBILITY_TTL_MS = 10_000;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export type SettingsBootstrapResponse = {
  settings: FamilySettings;
  calendars: SyncCalendar[];
  calendarVisibility: Array<{ calendarId: string; isVisible: number }>;
  connections: Array<{ id: string; lastSyncAt?: number; lastSyncStatus?: string }>;
};

const settingsCache = new Map<string, CacheEntry<FamilySettings>>();
const settingsInflight = new Map<string, Promise<FamilySettings>>();
const calendarsCache = new Map<string, CacheEntry<SyncCalendar[]>>();
const calendarsInflight = new Map<string, Promise<SyncCalendar[]>>();
let visibilityCache: CacheEntry<Array<{ calendarId: string; isVisible: number }>> | null = null;
let visibilityInflight: Promise<Array<{ calendarId: string; isVisible: number }>> | null = null;

function isCacheValid<T>(entry?: CacheEntry<T> | null): entry is CacheEntry<T> {
  return Boolean(entry && entry.expiresAt > Date.now());
}

function cacheEntry<T>(value: T, ttlMs: number): CacheEntry<T> {
  return { value, expiresAt: Date.now() + ttlMs };
}

function invalidateParentCaches(parentId: string) {
  settingsCache.delete(parentId);
  settingsInflight.delete(parentId);
  calendarsCache.delete(parentId);
  calendarsInflight.delete(parentId);
}

function hydrateBootstrapCaches(parentId: string, bootstrap: SettingsBootstrapResponse) {
  settingsCache.set(parentId, cacheEntry(bootstrap.settings, SETTINGS_TTL_MS));
  calendarsCache.set(parentId, cacheEntry(bootstrap.calendars || [], CALENDARS_TTL_MS));
  visibilityCache = cacheEntry(bootstrap.calendarVisibility || [], VISIBILITY_TTL_MS);
}

export const settingsClientService = {
  getBootstrap: (parentId: string): Promise<SettingsBootstrapResponse> =>
    fetchAPI(`/settings/${parentId}/bootstrap`).then((result) => {
      hydrateBootstrapCaches(parentId, result);
      return result;
    }),

  getSettings: (parentId: string): Promise<FamilySettings> => {
    const cached = settingsCache.get(parentId);
    if (isCacheValid(cached)) return Promise.resolve(cached.value);

    const inFlight = settingsInflight.get(parentId);
    if (inFlight) return inFlight;

    const req = fetchAPI(`/settings/${parentId}`)
      .then((result) => {
        settingsCache.set(parentId, cacheEntry(result, SETTINGS_TTL_MS));
        return result;
      })
      .finally(() => {
        settingsInflight.delete(parentId);
      });

    settingsInflight.set(parentId, req);
    return req;
  },
  saveSettings: (parentId: string, data: Partial<FamilySettings>): Promise<{ success: boolean }> =>
    fetchAPI(`/settings/${parentId}`, { method: 'PUT', body: JSON.stringify(data) }).then((result) => {
      invalidateParentCaches(parentId);
      return result;
    }),
  getCalendars: (parentId: string): Promise<SyncCalendar[]> => {
    const cached = calendarsCache.get(parentId);
    if (isCacheValid(cached)) return Promise.resolve(cached.value);

    const inFlight = calendarsInflight.get(parentId);
    if (inFlight) return inFlight;

    const req = fetchAPI(`/settings/${parentId}/calendars`)
      .then((result) => {
        calendarsCache.set(parentId, cacheEntry(result, CALENDARS_TTL_MS));
        return result;
      })
      .finally(() => {
        calendarsInflight.delete(parentId);
      });

    calendarsInflight.set(parentId, req);
    return req;
  },
  lockDisplay: (parentId: string): Promise<{ success: boolean }> =>
    fetchAPI(`/settings/${parentId}/lock`, { method: "POST" }).then((result) => {
      invalidateParentCaches(parentId);
      return result;
    }),
  unlockDisplay: (parentId: string, pin: string): Promise<{ success: boolean }> =>
    fetchAPI(`/settings/${parentId}/unlock`, { method: "POST", body: JSON.stringify({ pin }) }).then((result) => {
      invalidateParentCaches(parentId);
      return result;
    }),
  getCalendarVisibility: (): Promise<Array<{ calendarId: string; isVisible: number }>> => {
    if (isCacheValid(visibilityCache)) return Promise.resolve(visibilityCache.value);
    if (visibilityInflight) return visibilityInflight;

    visibilityInflight = fetchAPI('/settings/visibility')
      .then((result) => {
        visibilityCache = cacheEntry(result, VISIBILITY_TTL_MS);
        return result;
      })
      .finally(() => {
        visibilityInflight = null;
      });

    return visibilityInflight;
  },
  setCalendarVisibility: (calendarId: string, isVisible: boolean): Promise<{ success: boolean }> =>
    fetchAPI('/settings/visibility', { 
      method: 'POST', 
      body: JSON.stringify({ calendarId, isVisible: isVisible ? 1 : 0 }) 
    }).then((result) => {
      visibilityCache = null;
      visibilityInflight = null;
      return result;
    }),
};

export function resetSettingsClientCachesForTests() {
  settingsCache.clear();
  settingsInflight.clear();
  calendarsCache.clear();
  calendarsInflight.clear();
  visibilityCache = null;
  visibilityInflight = null;
}
