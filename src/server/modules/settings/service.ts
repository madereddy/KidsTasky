import { db } from '../../db.js';
import { FamilySettings } from '../../../types.js';

const DEFAULTS: Partial<FamilySettings> = {
  locationLat: 37.7749,
  locationLon: -122.4194,
  timezone: 'America/Chicago',
  temperatureUnit: 'celsius',
  timeFormat: '12h',
  sleepStart: '21:00',
  sleepEnd: '07:00',
  isLocked: false,
};

export const settingsService = {
  getSettings: (parentId: string): FamilySettings => {
    const row = db.prepare('SELECT * FROM family_settings WHERE parentId = ?').get(parentId) as FamilySettings | undefined;
    if (!row) return { ...DEFAULTS, parentId } as FamilySettings;
    return { ...row, isLocked: Boolean((row as any).isLocked) };
  },
  saveSettings: (parentId: string, data: Partial<FamilySettings>) => {
    const existing = db.prepare('SELECT * FROM family_settings WHERE parentId = ?').get(parentId) as FamilySettings | undefined;
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
    };
    db.prepare(`
      INSERT INTO family_settings (parentId, locationLat, locationLon, timezone, temperatureUnit, timeFormat, pin, sleepStart, sleepEnd, isLocked)
      VALUES (@parentId, @locationLat, @locationLon, @timezone, @temperatureUnit, @timeFormat, @pin, @sleepStart, @sleepEnd, @isLocked)
      ON CONFLICT(parentId) DO UPDATE SET
        locationLat = excluded.locationLat,
        locationLon = excluded.locationLon,
        timezone = excluded.timezone,
        temperatureUnit = excluded.temperatureUnit,
        timeFormat = excluded.timeFormat,
        pin = excluded.pin,
        sleepStart = excluded.sleepStart,
        sleepEnd = excluded.sleepEnd,
        isLocked = excluded.isLocked
    `).run(payload);
  },
  setLocked: (parentId: string, isLocked: boolean) => {
    db.prepare("UPDATE family_settings SET isLocked = ? WHERE parentId = ?")
      .run(isLocked ? 1 : 0, parentId);
  }
};
