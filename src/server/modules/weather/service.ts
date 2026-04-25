// src/server/modules/weather/service.ts
export interface DailyForecast {
  date: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
}

export const weatherService = {
  getWeeklyForecast: async (lat: number, lon: number): Promise<DailyForecast[]> => {
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
  }
};
