// src/server/modules/weather/service.test.ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { weatherService } from './service.js';

global.fetch = vi.fn();

describe('Weather Service', () => {
  it('should fetch 7-day forecast from Open-Meteo', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        daily: {
          time: ['2026-04-25'],
          temperature_2m_max: [75],
          temperature_2m_min: [55],
          weathercode: [3]
        },
        hourly: {
          time: ['2026-04-25T10:00'],
          temperature_2m: [68],
          weathercode: [2]
        }
      })
    });

    const forecast = await weatherService.getWeeklyForecast(40.7128, -74.0060);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('open-meteo.com')
    );
    expect(forecast.daily.length).toBe(1);
    expect(forecast.daily[0].maxTemp).toBe(75);
  });
});
