// src/server/modules/settings/features.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { db } from '../../db.js';
import { settingsService } from './service.js';

describe('Settings lock + sleep behavior', () => {
  it('returns defaults when no settings row exists', () => {
    const parentId = 'parent_defaults_test';
    db.prepare('DELETE FROM family_settings WHERE parentId = ?').run(parentId);

    const settings = settingsService.getSettings(parentId);
    expect(settings.parentId).toBe(parentId);
    expect(settings.isLocked).toBe(false);
    expect(settings.sleepStart).toBe('21:00');
    expect(settings.sleepEnd).toBe('07:00');
  });

  it('preserves pin when updating lock status through partial save', () => {
    const parentId = 'parent_settings_merge_test';
    db.prepare('DELETE FROM family_settings WHERE parentId = ?').run(parentId);

    settingsService.saveSettings(parentId, {
      locationLat: 10,
      locationLon: 20,
      timezone: 'UTC',
      pin: '2468',
      sleepStart: '22:00',
      sleepEnd: '06:00',
      isLocked: false,
    });

    settingsService.saveSettings(parentId, { isLocked: true });
    const settings = settingsService.getSettings(parentId);

    expect(settings.isLocked).toBe(true);
    expect(settings.pin).toBe('2468');
    expect(settings.sleepStart).toBe('22:00');
    expect(settings.sleepEnd).toBe('06:00');
  });

  it('round-trips household quick tags and display settings', () => {
    const parentId = 'parent_settings_quick_tags_test';
    db.prepare('DELETE FROM family_settings WHERE parentId = ?').run(parentId);

    settingsService.saveSettings(parentId, {
      customStoreNames: ['Publix', 'Costco', 'Publix'],
      customLocationNames: ['Baseball', 'Garage', 'Baseball'],
      displayRotationEnabled: true,
      displayRotationInterval: 45,
      screensaverShuffle: true,
      screensaverDurationSec: 20,
      screensaverCaptions: false,
    });

    const settings = settingsService.getSettings(parentId);

    expect(settings.customStoreNames).toEqual(['Publix', 'Costco']);
    expect(settings.customLocationNames).toEqual(['Baseball', 'Garage']);
    expect(settings.displayRotationEnabled).toBe(true);
    expect(settings.displayRotationInterval).toBe(45);
    expect(settings.screensaverShuffle).toBe(true);
    expect(settings.screensaverDurationSec).toBe(20);
    expect(settings.screensaverCaptions).toBe(false);
  });
});
