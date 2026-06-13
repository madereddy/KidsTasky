import React, { useEffect, useRef } from 'react';
import { format, isSameDay, startOfDay } from 'date-fns';
import { CalendarEvent } from '../../types';
import { MealPlanWithRecipe } from '../../services/meals';
import { DailyForecast } from '../../services/weather';
import { getWeatherInfo } from '../../constants';
import { TemperatureUnitPref, TimeFormatPref, formatTimeWithPrefs, toDisplayTemp } from '../../lib/dateTimePrefs';

interface Props {
  events: CalendarEvent[];
  day: Date;
  onEventClick: (event: CalendarEvent) => void;
  memberColorMap: Record<string, string>;
  onTimeSlotClick: (time: string) => void;
  dayMeals?: MealPlanWithRecipe[];
  weatherEntry?: DailyForecast;
  temperatureUnit: TemperatureUnitPref;
  timeFormat?: TimeFormatPref;
  timezone?: string;
  userRole?: 'parent' | 'kid' | 'coparent';
}

const GRID_HEIGHT = 960;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function minuteOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function CalendarDayView({
  events,
  day,
  onEventClick,
  memberColorMap,
  onTimeSlotClick,
  dayMeals,
  weatherEntry,
  temperatureUnit = 'celsius',
  timeFormat = '12h',
  timezone = 'America/Chicago'
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const allDayEvents = events.filter((ev) => ev.isAllDay && isSameDay(new Date(ev.startTime), day));
  const dayEvents = events.filter((ev) => !ev.isAllDay && isSameDay(new Date(ev.startTime), day));

  useEffect(() => {
    if (scrollRef.current) {
      // Find earliest event or default to 7 AM
      let earliestHour = 7;
      if (dayEvents.length > 0) {
        const earliestEvent = dayEvents.reduce((min, ev) => ev.startTime < min ? ev.startTime : min, dayEvents[0].startTime);
        const eventHour = new Date(earliestEvent).getHours();
        earliestHour = Math.min(earliestHour, eventHour);
      }
      
      const scrollPos = (earliestHour / 24) * GRID_HEIGHT;
      scrollRef.current.scrollTop = scrollPos;
    }
  }, [day, dayEvents.length]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b py-3 px-4 text-center">
        <p className="text-xs font-bold text-ui-muted uppercase">{format(day, 'EEEE')}</p>
        <p className="text-2xl font-bold text-ui-primary">{format(day, 'MMMM d, yyyy')}</p>
      </div>

      {allDayEvents.length > 0 && (
        <div className="flex gap-1 px-4 py-2 border-b border-ui-soft bg-blue-50 flex-wrap">
          {allDayEvents.map(ev => (
            <button key={ev.id} onClick={() => onEventClick?.(ev)}
              className="px-2 py-1 rounded text-xs font-semibold text-white truncate max-w-[150px]"
              style={{ backgroundColor: (ev.assignedToId && memberColorMap[ev.assignedToId]) || ev.color || '#6366f1' }}>
              {ev.title}
            </button>
          ))}
        </div>
      )}

      {weatherEntry && (
        <div className="shrink-0 mx-4 mt-2 p-3 bg-sky-50 rounded-xl border border-sky-100">
          <p className="text-sm font-semibold text-sky-800">
            {getWeatherInfo(weatherEntry.weatherCode).label} ({getWeatherInfo(weatherEntry.weatherCode).icon})
          </p>
          <p className="text-xs text-sky-700">
            {Math.round(toDisplayTemp(weatherEntry.maxTemp, temperatureUnit))}° / {Math.round(toDisplayTemp(weatherEntry.minTemp, temperatureUnit))}°
          </p>
        </div>
      )}

      {dayMeals && dayMeals.length > 0 && (
        <div className="shrink-0 mx-4 my-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
          <p className="text-xs font-bold text-amber-700 mb-2 uppercase tracking-wide">Today's Meals</p>
          <div className="space-y-1">
            {dayMeals.map((meal) => (
              <div key={meal.id} className="flex gap-2 text-sm">
                <span className="text-amber-500 font-semibold w-20 shrink-0">{meal.mealType}</span>
                <span className="text-ui-secondary">{(meal as any).recipeName ?? 'Planned'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex overflow-y-auto flex-1" ref={scrollRef}>
        <div className="w-14 shrink-0 relative" style={{ height: GRID_HEIGHT }}>
          {HOURS.map((h) => (
            <div key={h} className="absolute w-full pr-1 text-right" style={{ top: (h / 24) * GRID_HEIGHT - 8 }}>
              <span className="text-[10px] text-ui-muted-2 font-medium">
                {h === 0 ? '' : (timeFormat === '24h' ? `${String(h).padStart(2, '0')}:00` : `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`)}
              </span>
            </div>
          ))}
        </div>

        <div className="flex-1 border-l border-ui-soft relative" style={{ height: GRID_HEIGHT }}>
          {HOURS.map((h) => (
            <div
              key={h}
              className="absolute w-full border-t border-ui-soft cursor-pointer hover:bg-blue-50/40"
              style={{ top: (h / 24) * GRID_HEIGHT, height: GRID_HEIGHT / 24 }}
              onClick={() => onTimeSlotClick?.(`${String(h).padStart(2, '0')}:00`)}
            />
          ))}

          {dayEvents.map((ev) => {
            const start = new Date(ev.startTime);
            const topPct = minuteOfDay(start) / 1440;
            const durMin = Math.max(30, (ev.endTime - ev.startTime) / 60000);
            const heightPct = Math.min(durMin / 1440, 1 - topPct);
            const color = (ev.assignedToId && memberColorMap[ev.assignedToId]) || ev.color || '#6366f1';
            return (
              <button
                key={ev.id}
                onClick={() => onEventClick?.(ev)}
                className="absolute left-2 right-2 rounded-lg text-left text-white text-xs font-semibold px-2 py-1 overflow-hidden shadow-sm"
                style={{
                  top: topPct * GRID_HEIGHT,
                  height: Math.max(24, heightPct * GRID_HEIGHT),
                  backgroundColor: color,
                  zIndex: 2,
                }}
              >
                <p className="font-bold truncate">{ev.title}</p>
                <p className="opacity-80 text-[10px]">
                  {formatTimeWithPrefs(start, timezone, timeFormat)} - {formatTimeWithPrefs(new Date(ev.endTime), timezone, timeFormat)}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
