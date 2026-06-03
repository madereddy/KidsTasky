import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSettingsClientCachesForTests, settingsClientService } from './settings';
import { fetchAPI } from './http';

vi.mock('./http', () => ({
  fetchAPI: vi.fn(),
}));

const fetchMock = vi.mocked(fetchAPI);

describe('settingsClientService cache behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    resetSettingsClientCachesForTests();
  });

  it('deduplicates concurrent getSettings requests', async () => {
    fetchMock.mockResolvedValueOnce({ parentId: 'p1', timezone: 'America/Chicago' });

    const [a, b] = await Promise.all([
      settingsClientService.getSettings('p1'),
      settingsClientService.getSettings('p1'),
    ]);

    expect(a).toEqual(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('invalidates settings cache after save', async () => {
    fetchMock
      .mockResolvedValueOnce({ parentId: 'p2', timezone: 'America/Chicago' })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ parentId: 'p2', timezone: 'America/New_York' });

    const first = await settingsClientService.getSettings('p2');
    expect(first.timezone).toBe('America/Chicago');

    await settingsClientService.saveSettings('p2', { timezone: 'America/New_York' });
    const second = await settingsClientService.getSettings('p2');

    expect(second.timezone).toBe('America/New_York');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('hydrates settings and calendars caches from bootstrap', async () => {
    fetchMock
      .mockResolvedValueOnce({
        settings: { parentId: 'p3', timezone: 'America/Chicago', isLocked: 0 },
        calendars: [{ id: 'cal1', syncConnectionId: 's1', parentId: 'p3', externalCalendarId: 'ext1', name: 'Family', enabled: 1 }],
        calendarVisibility: [{ calendarId: 'cal1', isVisible: 1 }],
        connections: [],
      })
      .mockResolvedValueOnce([{ calendarId: 'cal1', isVisible: 1 }]);

    const bootstrap = await settingsClientService.getBootstrap('p3');
    const settings = await settingsClientService.getSettings('p3');
    const calendars = await settingsClientService.getCalendars('p3');
    const visibility = await settingsClientService.getCalendarVisibility();

    expect(bootstrap.settings.parentId).toBe('p3');
    expect(settings.parentId).toBe('p3');
    expect(calendars[0].id).toBe('cal1');
    expect(visibility[0].calendarId).toBe('cal1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('invalidates cached settings after lock and unlock', async () => {
    fetchMock
      .mockResolvedValueOnce({ parentId: 'p4', timezone: 'America/Chicago', isLocked: 0 })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ parentId: 'p4', timezone: 'America/Chicago', isLocked: 1 })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ parentId: 'p4', timezone: 'America/Chicago', isLocked: 0 });

    const initial = await settingsClientService.getSettings('p4');
    expect(initial.isLocked).toBe(0);

    await settingsClientService.lockDisplay('p4');
    const locked = await settingsClientService.getSettings('p4');
    expect(locked.isLocked).toBe(1);

    await settingsClientService.unlockDisplay('p4', '1234');
    const unlocked = await settingsClientService.getSettings('p4');
    expect(unlocked.isLocked).toBe(0);
  });
});
