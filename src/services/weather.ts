import { fetchAPI } from "./http";

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

export const weatherClientService = {
  getForecast: async (lat: number, lon: number): Promise<DailyForecast[]> => {
    const response = await fetchAPI(`/weather?lat=${lat}&lon=${lon}`);
    if (Array.isArray(response)) return response as DailyForecast[];
    return (response?.daily || []) as DailyForecast[];
  },
  getForecastWithHourly: async (lat: number, lon: number): Promise<ForecastResponse> => {
    const response = await fetchAPI(`/weather?lat=${lat}&lon=${lon}`);
    if (Array.isArray(response)) {
      return { daily: response as DailyForecast[], hourlyToday: [] };
    }
    return {
      daily: (response?.daily || []) as DailyForecast[],
      hourlyToday: (response?.hourlyToday || []) as HourlyForecastEntry[],
    };
  }
};
