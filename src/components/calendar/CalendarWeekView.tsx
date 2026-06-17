import React, { useState, useEffect, useRef, useMemo } from 'react';
import { format, addDays, isSameDay, startOfDay } from 'date-fns';
import { CalendarEvent } from '../../types';
import { cn } from '../../lib/utils';
import { DailyForecast } from '../../services/weather';
import { getWeatherInfo } from '../../constants';
import { TemperatureUnitPref, TimeFormatPref, formatTimeWithPrefs, formatDateTimeWithPrefs, toDisplayTemp } from '../../lib/dateTimePrefs';
import { positionEvents } from '../../lib/calendarLayout';

interface Props {
  events: CalendarEvent[];
  weekStart: Date;
  onEventClick: (event: CalendarEvent) => void;
  onRoutineClick?: (event: CalendarEvent) => void;
  memberColorMap: Record<string, string>;
  forecast: DailyForecast[];
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

export function CalendarWeekView({
  events,
  weekStart,
  onEventClick,
  onRoutineClick,
  memberColorMap,
  forecast = [],
  temperatureUnit = 'celsius',
  timeFormat = '12h',
  timezone = 'America/Chicago'
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const allDayEvents = events.filter((ev) => ev.isAllDay);
  const timedEvents = events.filter((ev) => !ev.isAllDay);
  const getEventsForDay = (day: Date) => timedEvents.filter((ev) => isSameDay(new Date(ev.startTime), day));

  useEffect(() => {
    if (scrollRef.current) {
      // Find earliest event in the visible week or default to 7 AM
      let earliestHour = 7;
      
      const visibleWeekTimedEvents = timedEvents.filter(ev => 
        days.some(day => isSameDay(new Date(ev.startTime), day))
      );

      if (visibleWeekTimedEvents.length > 0) {
        const earliestEvent = visibleWeekTimedEvents.reduce((min, ev) => ev.startTime < min ? ev.startTime : min, visibleWeekTimedEvents[0].startTime);
        const eventHour = new Date(earliestEvent).getHours();
        earliestHour = Math.min(earliestHour, eventHour);
      }
      
      const scrollPos = (earliestHour / 24) * GRID_HEIGHT;
      scrollRef.current.scrollTop = scrollPos;
    }
  }, [weekStart, events]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {allDayEvents.length > 0 && (
        <div className="flex border-b bg-blue-50">
          <div className="w-14 shrink-0" />
          {days.map((day, di) => {
            const dayAllDay = allDayEvents.filter((ev) => isSameDay(new Date(ev.startTime), day));
            return (
              <div key={di} className="flex-1 border-l border-ui-soft p-1 min-h-[44px]">
                {dayAllDay.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => onEventClick?.(ev)}
                    className="w-full text-xs px-1.5 py-0.5 rounded text-white truncate font-semibold mb-0.5"
                    style={{ backgroundColor: (ev.assignedToId && memberColorMap[ev.assignedToId]) || ev.color || '#6366f1' }}
                  >
                    {ev.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex border-b">
        <div className="w-14 shrink-0" />
        {days.map((day, di) => {
          const dayForecast = forecast.find((f) => f.date === format(day, 'yyyy-MM-dd'));
          return (
            <div key={di} className={cn('flex-1 border-l border-ui-soft py-2 text-center', isSameDay(day, today) && 'bg-blue-50')}>
              <p className="text-xs font-bold text-ui-muted uppercase">{format(day, 'EEE')}</p>
              <p className={cn('text-lg font-bold', isSameDay(day, today) ? 'text-blue-500' : 'text-ui-secondary')}>{format(day, 'd')}</p>
              {dayForecast && (
                <p className="text-xs text-ui-muted">
                  {getWeatherInfo(dayForecast.weatherCode).icon} {Math.round(toDisplayTemp(dayForecast.maxTemp, temperatureUnit))}°/{Math.round(toDisplayTemp(dayForecast.minTemp, temperatureUnit))}°
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex overflow-y-auto flex-1" ref={scrollRef}>
        <div className="w-14 shrink-0 relative" style={{ height: GRID_HEIGHT }}>
          {HOURS.map((h) => (
            <div key={h} className="absolute w-full pr-1 text-right" style={{ top: (h / 24) * GRID_HEIGHT - 8 }}>
              <span className="text-xs text-ui-muted-2 font-medium">{h === 0 ? '' : (timeFormat === '24h' ? `${String(h).padStart(2, '0')}:00` : `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`)}</span>
            </div>
          ))}
        </div>

        {days.map((day, di) => {
          const dayEvs = getEventsForDay(day);
          return (
            <div key={di} className={cn('flex-1 border-l border-ui-soft relative', isSameDay(day, today) && 'bg-blue-50/30')} style={{ height: GRID_HEIGHT }}>
              {HOURS.map((h) => (
                <div key={h} className="absolute w-full border-t border-ui-soft" style={{ top: (h / 24) * GRID_HEIGHT }} />
              ))}
              {useMemo(() => positionEvents(dayEvs), [dayEvs]).map((ev) => {
                const start = new Date(ev.startTime);
                const topPct = minuteOfDay(start) / 1440;
                const durMin = Math.max(30, (ev.endTime - ev.startTime) / 60000);
                const heightPct = Math.min(durMin / 1440, 1 - topPct);
                const color = (ev.assignedToId && memberColorMap[ev.assignedToId]) || ev.color || '#6366f1';
                return (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick?.(ev)}
                    className="absolute rounded text-left text-white text-xs font-semibold px-1 overflow-hidden shadow-sm"
                    style={{
                      top: topPct * GRID_HEIGHT,
                      height: Math.max(20, heightPct * GRID_HEIGHT),
                      left: `calc(${ev.left}% + 2px)`,
                      width: `calc(${ev.width}% - 4px)`,
                      backgroundColor: color,
                      zIndex: 2
                    }}
                  >
                    <p className="truncate">{ev.title}</p>
                    <p className="opacity-80">{formatTimeWithPrefs(start, timezone, timeFormat)}</p>
                    {ev.routineListId && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          onRoutineClick?.(ev);
                        }}
                        className="mt-0.5 inline-flex rounded bg-white/90 px-1 py-0.5 text-[9px] font-bold text-purple-700"
                      >
                        Routine
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

