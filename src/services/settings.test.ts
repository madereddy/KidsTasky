import { beforeEach, describe, expect, it, vi } from 'vitest';
import { settingsClientService } from './settings';
import { fetchAPI } from './http';

vi.mock('./http', () => ({
  fetchAPI: vi.fn(),
}));

const fetchMock = vi.mocked(fetchAPI);

describe('settingsClientService cache behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
