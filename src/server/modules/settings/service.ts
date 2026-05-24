import { db } from '../../db.js';
import { FamilySettings } from '../../../types.js';

const DEFAULTS: Partial<FamilySettings> = {
  locationLat: 37.7749,
  locationLon: -122.4194,
  timezone: 'America/Chicago',
  sleepStart: '21:00',
  sleepEnd: '07:00',
};

export const settingsService = {
  getSettings: (parentId: string): FamilySettings => {
    const row = db.prepare('SELECT * FROM family_settings WHERE parentId = ?').get(parentId) as FamilySettings | undefined;
    return row ?? { ...DEFAULTS, parentId } as FamilySettings;
  },
  saveSettings: (parentId: string, data: Partial<FamilySettings>) => {
    const merged = { ...DEFAULTS, ...data, parentId };
    db.prepare(`
      INSERT INTO family_settings (parentId, locationLat, locationLon, timezone, pin, sleepStart, sleepEnd)
      VALUES (@parentId, @locationLat, @locationLon, @timezone, @pin, @sleepStart, @sleepEnd)
      ON CONFLICT(parentId) DO UPDATE SET
        locationLat = excluded.locationLat,
        locationLon = excluded.locationLon,
        timezone = excluded.timezone,
        pin = excluded.pin,
        sleepStart = excluded.sleepStart,
        sleepEnd = excluded.sleepEnd
    `).run(merged);
  }
};
