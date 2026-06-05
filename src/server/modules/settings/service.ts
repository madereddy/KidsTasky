import { db } from '../../db.js';
import { FamilySettings } from '../../../types.js';
import { sanitizeLocationNames, sanitizeStoreNames } from '../../../lib/householdListPreferences.js';

const DEFAULTS: Partial<FamilySettings> = {
  locationLat: 37.7749,
  locationLon: -122.4194,
  timezone: 'America/Chicago',
  temperatureUnit: 'celsius',
  timeFormat: '12h',
  sleepStart: '21:00',
  sleepEnd: '07:00',
  isLocked: false,
  photoCleanupEnabled: true,
  photoCleanupIntervalHours: 24,
  googlePhotosEnabled: false,
  googlePhotosAlbumId: null,
  displayRotationEnabled: false,
  displayRotationInterval: 30,
  displayRotationOrder: '["chores","calendar","weather","photos"]',
  screensaverShuffle: false,
  screensaverDurationSec: 10,
  screensaverCaptions: true,
  customStoreNames: [],
  customLocationNames: [],
};

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string');
  }
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

export const settingsService = {
  getSettings: (parentId: string): FamilySettings => {
    const row = db.prepare('SELECT * FROM family_settings WHERE parentId = ?').get(parentId) as FamilySettings | undefined;
    if (!row) return { ...DEFAULTS, parentId } as FamilySettings;
    return {
      ...row,
      isLocked: Boolean((row as any).isLocked),
      photoCleanupEnabled: Boolean((row as any).photoCleanupEnabled),
      googlePhotosEnabled: Boolean((row as any).googlePhotosEnabled),
      displayRotationEnabled: Boolean((row as any).displayRotationEnabled),
      displayRotationInterval: Number((row as any).displayRotationInterval ?? DEFAULTS.displayRotationInterval),
      displayRotationOrder: String((row as any).displayRotationOrder ?? DEFAULTS.displayRotationOrder),
      screensaverShuffle: Boolean((row as any).screensaverShuffle),
      screensaverDurationSec: Number((row as any).screensaverDurationSec ?? DEFAULTS.screensaverDurationSec),
      screensaverCaptions: (row as any).screensaverCaptions !== undefined ? Boolean((row as any).screensaverCaptions) : true,
      customStoreNames: sanitizeStoreNames(parseJsonArray((row as any).customStoreNames)),
      customLocationNames: sanitizeLocationNames(parseJsonArray((row as any).customLocationNames)),
    };
  },
  saveSettings: (parentId: string, data: Partial<FamilySettings>) => {
    const existingRow = db.prepare('SELECT parentId FROM family_settings WHERE parentId = ?').get(parentId) as { parentId?: string } | undefined;
    const existing = existingRow ? settingsService.getSettings(parentId) : undefined;
    const merged = { ...DEFAULTS, ...(existing ?? {}), ...data, parentId };
    const payload = {
      parentId: merged.parentId,
      locationLat: merged.locationLat ?? DEFAULTS.locationLat,
      locationLon: merged.locationLon ?? DEFAULTS.locationLon,
      timezone: merged.timezone ?? DEFAULTS.timezone,
      temperatureUnit: merged.temperatureUnit ?? DEFAULTS.temperatureUnit,
      timeFormat: merged.timeFormat ?? DEFAULTS.timeFormat,
      pin: merged.pin ?? null,
      sleepStart: merged.sleepStart ?? DEFAULTS.sleepStart,
      sleepEnd: merged.sleepEnd ?? DEFAULTS.sleepEnd,
      isLocked: merged.isLocked ? 1 : 0,
      photoCleanupEnabled: merged.photoCleanupEnabled ? 1 : 0,
      photoCleanupIntervalHours: Math.max(1, Number(merged.photoCleanupIntervalHours ?? DEFAULTS.photoCleanupIntervalHours)),
      googlePhotosEnabled: merged.googlePhotosEnabled ? 1 : 0,
      googlePhotosAlbumId: merged.googlePhotosAlbumId ?? null,
      displayRotationEnabled: merged.displayRotationEnabled ? 1 : 0,
      displayRotationInterval: Math.max(5, Number(merged.displayRotationInterval ?? DEFAULTS.displayRotationInterval)),
      displayRotationOrder: merged.displayRotationOrder ?? DEFAULTS.displayRotationOrder,
      screensaverShuffle: merged.screensaverShuffle ? 1 : 0,
      screensaverDurationSec: Math.max(5, Number(merged.screensaverDurationSec ?? DEFAULTS.screensaverDurationSec)),
      screensaverCaptions: merged.screensaverCaptions === false ? 0 : 1,
      customStoreNames: JSON.stringify(sanitizeStoreNames(merged.customStoreNames ?? [])),
      customLocationNames: JSON.stringify(sanitizeLocationNames(merged.customLocationNames ?? [])),
    };
    db.prepare(`
      INSERT INTO family_settings (
        parentId, locationLat, locationLon, timezone, temperatureUnit, timeFormat, pin, sleepStart, sleepEnd, isLocked,
        photoCleanupEnabled, photoCleanupIntervalHours, googlePhotosEnabled, googlePhotosAlbumId,
        displayRotationEnabled, displayRotationInterval, displayRotationOrder,
        screensaverShuffle, screensaverDurationSec, screensaverCaptions,
        customStoreNames, customLocationNames
      )
      VALUES (
        @parentId, @locationLat, @locationLon, @timezone, @temperatureUnit, @timeFormat, @pin, @sleepStart, @sleepEnd, @isLocked,
        @photoCleanupEnabled, @photoCleanupIntervalHours, @googlePhotosEnabled, @googlePhotosAlbumId,
        @displayRotationEnabled, @displayRotationInterval, @displayRotationOrder,
        @screensaverShuffle, @screensaverDurationSec, @screensaverCaptions,
        @customStoreNames, @customLocationNames
      )
      ON CONFLICT(parentId) DO UPDATE SET
        locationLat = excluded.locationLat,
        locationLon = excluded.locationLon,
        timezone = excluded.timezone,
        temperatureUnit = excluded.temperatureUnit,
        timeFormat = excluded.timeFormat,
        pin = excluded.pin,
        sleepStart = excluded.sleepStart,
        sleepEnd = excluded.sleepEnd,
        isLocked = excluded.isLocked,
        photoCleanupEnabled = excluded.photoCleanupEnabled,
        photoCleanupIntervalHours = excluded.photoCleanupIntervalHours,
        googlePhotosEnabled = excluded.googlePhotosEnabled,
        googlePhotosAlbumId = excluded.googlePhotosAlbumId,
        displayRotationEnabled = excluded.displayRotationEnabled,
        displayRotationInterval = excluded.displayRotationInterval,
        displayRotationOrder = excluded.displayRotationOrder,
        screensaverShuffle = excluded.screensaverShuffle,
        screensaverDurationSec = excluded.screensaverDurationSec,
        screensaverCaptions = excluded.screensaverCaptions,
        customStoreNames = excluded.customStoreNames,
        customLocationNames = excluded.customLocationNames
    `).run(payload);
  },
  setLocked: (parentId: string, isLocked: boolean) => {
    db.prepare("UPDATE family_settings SET isLocked = ? WHERE parentId = ?")
      .run(isLocked ? 1 : 0, parentId);
  },
  getCalendarVisibility: (userId: string) => {
    return db.prepare('SELECT calendarId, isVisible FROM calendar_visibility WHERE userId = ?')
      .all(userId) as Array<{ calendarId: string; isVisible: number }>;
  },
  setCalendarVisibility: (userId: string, calendarId: string, isVisible: boolean) => {
    db.prepare(`
      INSERT INTO calendar_visibility (userId, calendarId, isVisible)
      VALUES (?, ?, ?)
      ON CONFLICT(userId, calendarId) DO UPDATE SET isVisible = excluded.isVisible
    `).run(userId, calendarId, isVisible ? 1 : 0);
  }
};
