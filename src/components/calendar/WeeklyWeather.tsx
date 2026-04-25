// src/components/calendar/WeeklyWeather.tsx
import React from 'react';

// Using the same interface as from service, mapped locally for UI
interface DailyForecast {
  date: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
}

export function WeeklyWeather({ forecast = [] }: { forecast: DailyForecast[] }) {
  if (forecast.length === 0) return null;
  
  return (
    <div className="flex gap-2 p-2 bg-white rounded-lg shadow-sm overflow-x-auto">
      {forecast.map(day => (
        <div key={day.date} className="flex flex-col items-center min-w-[60px] p-2 border-r last:border-r-0">
          <span className="text-xs font-medium text-gray-500">
            {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
          </span>
          <div className="flex flex-col mt-1 font-semibold text-center">
            <span className="text-orange-500 text-sm">{Math.round(day.maxTemp)}°</span>
            <span className="text-blue-500 text-xs">{Math.round(day.minTemp)}°</span>
          </div>
        </div>
      ))}
    </div>
  );
}
