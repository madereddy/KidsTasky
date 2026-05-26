import { fetchAPI } from "./http";

export interface DailyForecast {
  date: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
}

export const weatherClientService = {
  getForecast: (lat: number, lon: number): Promise<DailyForecast[]> =>
    fetchAPI(`/weather?lat=${lat}&lon=${lon}`)
};
