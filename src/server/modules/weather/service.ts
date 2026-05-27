// src/server/modules/weather/service.ts
import { TTLCache } from '../../lib/ttlCache.js';

export interface DailyForecast {
  date: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
}

const weatherCache = new TTLCache<DailyForecast[]>(10 * 60 * 1000, 1000);

export const weatherService = {
  getWeeklyForecast: async (lat: number, lon: number): Promise<DailyForecast[]> => {
    const latKey = lat.toFixed(3);
    const lonKey = lon.toFixed(3);
    const cacheKey = `${latKey},${lonKey}`;
    return weatherCache.getOrLoad(cacheKey, async () => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Weather fetch failed');

      const data = await res.json();
      const forecast: DailyForecast[] = [];

      for (let i = 0; i < data.daily.time.length; i++) {
        forecast.push({
          date: data.daily.time[i],
          maxTemp: data.daily.temperature_2m_max[i],
          minTemp: data.daily.temperature_2m_min[i],
          weatherCode: data.daily.weathercode[i]
        });
      }
      return forecast;
    });
  }
};
