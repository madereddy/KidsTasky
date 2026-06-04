// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWallHomeController } from './useWallHomeController';

vi.mock('../services/dashboard', () => ({
  dashboardClientService: { getFamilyDashboardData: vi.fn() },
}));
vi.mock('../services/weather', () => ({
  weatherClientService: { getForecastWithHourly: vi.fn() },
}));
vi.mock('../services/settings', () => ({
  settingsClientService: { getSettings: vi.fn() },
}));

import { dashboardClientService } from '../services/dashboard';
import { weatherClientService } from '../services/weather';
import { settingsClientService } from '../services/settings';

describe('useWallHomeController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dashboardClientService.getFamilyDashboardData).mockResolvedValue({
      events: [{ id: 'e1', startTime: Date.now() + 1000 }],
      homework: [{ id: 'h1', dueDate: '2026-06-03', status: 'pending' }],
      tasks: [{ id: 't1', assignedKidId: 'k1' }],
      completions: [{ id: 'c1', taskId: 't1', kidId: 'k1' }],
    } as any);
    vi.mocked(settingsClientService.getSettings).mockResolvedValue({
      temperatureUnit: 'fahrenheit',
      displayRotationEnabled: true,
      displayRotationInterval: 20,
      displayRotationOrder: JSON.stringify(['calendar', 'weather']),
      locationLat: 1,
      locationLon: 2,
    } as any);
    vi.mocked(weatherClientService.getForecastWithHourly).mockResolvedValue({
      daily: [{ date: '2026-06-03' }],
      hourlyToday: [{ time: new Date().toISOString(), temp: 72, weatherCode: 1 }],
    } as any);
  });

  it('loads family data, weather, and per-kid task data', async () => {
    const { result } = renderHook(() => useWallHomeController({
      parentId: 'p1',
      kids: [{ uid: 'k1', role: 'kid', name: 'Kid One', email: 'kid@test.com' }],
    }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toHaveLength(1);
    expect(result.current.homework).toHaveLength(1);
    expect(result.current.forecast).toHaveLength(1);
    expect(result.current.hourlyToday).toHaveLength(1);
    expect(result.current.rotationEnabled).toBe(true);
    expect(result.current.allTasks).toHaveLength(1);
    expect(result.current.allCompletions).toHaveLength(1);
  });

  it('does not fetch when parentId is empty', async () => {
    const { result } = renderHook(() => useWallHomeController({
      parentId: '',
      kids: [{ uid: 'k1', role: 'kid', name: 'Kid One', email: 'kid@test.com' }],
    }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(dashboardClientService.getFamilyDashboardData).not.toHaveBeenCalled();
    expect(settingsClientService.getSettings).not.toHaveBeenCalled();
    expect(weatherClientService.getForecastWithHourly).not.toHaveBeenCalled();
    expect(result.current.events).toEqual([]);
    expect(result.current.allTasks).toEqual([]);
  });
});
