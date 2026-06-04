// src/server/modules/weather/service.ts
import { TTLCache } from '../../lib/ttlCache.js';

export interface DailyForecast {
  date: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
}

export interface HourlyForecastEntry {
  time: string;
  temp: number;
  weatherCode: number;
}

export interface ForecastResponse {
  daily: DailyForecast[];
  hourlyToday: HourlyForecastEntry[];
}

const weatherCache = new TTLCache<ForecastResponse>(10 * 60 * 1000, 50);

export const weatherService = {
  getWeeklyForecast: async (lat: number, lon: number): Promise<ForecastResponse> => {
    const latKey = lat.toFixed(3);
    const lonKey = lon.toFixed(3);
    const cacheKey = `${latKey},${lonKey}`;
    return weatherCache.getOrLoad(cacheKey, async () => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&hourly=weathercode,temperature_2m&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Weather fetch failed');

      const data = await res.json();
      const daily: DailyForecast[] = [];

      for (let i = 0; i < data.daily.time.length; i++) {
        daily.push({
          date: data.daily.time[i],
          maxTemp: data.daily.temperature_2m_max[i],
          minTemp: data.daily.temperature_2m_min[i],
          weatherCode: data.daily.weathercode[i]
        });
      }
      const today = new Date().toISOString().slice(0, 10);
      const hourlyToday: HourlyForecastEntry[] = [];
      if (Array.isArray(data.hourly?.time)) {
        for (let i = 0; i < data.hourly.time.length; i++) {
          const time = data.hourly.time[i] as string;
          if (typeof time === 'string' && time.startsWith(today)) {
            hourlyToday.push({
              time,
              temp: data.hourly.temperature_2m[i],
              weatherCode: data.hourly.weathercode[i]
            });
          }
        }
      }

      return { daily, hourlyToday };
    }, 60_000);
  }
};
