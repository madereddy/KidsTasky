import React from 'react';
import { getWeatherInfo } from '../../constants';
import { DailyForecast } from '../../services/weather';
import { TemperatureUnitPref, toDisplayTemp } from '../../lib/dateTimePrefs';

export function WeeklyWeather({ forecast = [], temperatureUnit = 'celsius' }: { forecast: DailyForecast[]; temperatureUnit?: TemperatureUnitPref }) {
  if (forecast.length === 0) return null;

  return (
    <div className="flex gap-2 p-2 bg-white rounded-lg shadow-sm overflow-x-auto">
      {forecast.map((day) => (
        <div key={day.date} className="flex flex-col items-center min-w-[60px] p-2 border-r last:border-r-0">
          <span className="text-xs font-medium text-gray-500">
            {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
          </span>
          <span className="text-[10px] text-ui-muted mt-1">{getWeatherInfo(day.weatherCode).icon}</span>
          <div className="flex flex-col mt-1 font-semibold text-center">
            <span className="text-orange-500 text-sm">{Math.round(toDisplayTemp(day.maxTemp, temperatureUnit))}{'\u00B0'}</span>
            <span className="text-blue-500 text-xs">{Math.round(toDisplayTemp(day.minTemp, temperatureUnit))}{'\u00B0'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

