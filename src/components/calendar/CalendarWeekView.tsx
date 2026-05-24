import React, { useState } from 'react';
import { format, addDays, isSameDay, startOfDay } from 'date-fns';
import { CalendarEvent } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  events: CalendarEvent[];
  weekStart: Date;
  memberColorMap: Record<string, string>;
}

const GRID_HEIGHT = 960; // px (1 px per 1.5 min)
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function minuteOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function CalendarWeekView({ events, weekStart, memberColorMap }: Props) {
  const [popover, setPopover] = useState<CalendarEvent | null>(null);
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const allDayEvents = events.filter(ev => {
    const dur = ev.endTime - ev.startTime;
    return dur >= 86400000;
  });
  const timedEvents = events.filter(ev => {
    const dur = ev.endTime - ev.startTime;
    return dur < 86400000;
  });

  const getEventsForDay = (day: Date) =>
    timedEvents.filter(ev => isSameDay(new Date(ev.startTime), day));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {allDayEvents.length > 0 && (
        <div className="flex border-b bg-blue-50">
          <div className="w-14 shrink-0" />
          {days.map((day, di) => {
            const dayAllDay = allDayEvents.filter(ev => isSameDay(new Date(ev.startTime), day));
            return (
              <div key={di} className="flex-1 border-l border-slate-100 p-1 min-h-[24px]">
                {dayAllDay.map(ev => (
                  <div key={ev.id} className="text-[10px] px-1 rounded text-white truncate"
                    style={{ backgroundColor: (ev.assignedToId && memberColorMap[ev.assignedToId]) || ev.color || '#6366f1' }}>
                    {ev.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex border-b">
        <div className="w-14 shrink-0" />
        {days.map((day, di) => (
          <div key={di} className={cn(
            "flex-1 border-l border-slate-100 py-2 text-center",
            isSameDay(day, today) && "bg-blue-50"
          )}>
            <p className="text-[10px] font-bold text-slate-500 uppercase">{format(day, 'EEE')}</p>
            <p className={cn(
              "text-lg font-bold",
              isSameDay(day, today) ? "text-blue-500" : "text-slate-700"
            )}>{format(day, 'd')}</p>
          </div>
        ))}
      </div>

      <div className="flex overflow-y-auto flex-1">
        <div className="w-14 shrink-0 relative" style={{ height: GRID_HEIGHT }}>
          {HOURS.map(h => (
            <div key={h} className="absolute w-full pr-1 text-right"
              style={{ top: (h / 24) * GRID_HEIGHT - 8 }}>
              <span className="text-[10px] text-slate-400 font-medium">
                {h === 0 ? '' : `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`}
              </span>
            </div>
          ))}
        </div>

        {days.map((day, di) => {
          const dayEvs = getEventsForDay(day);
          return (
            <div
              key={di}
              className={cn("flex-1 border-l border-slate-100 relative", isSameDay(day, today) && "bg-blue-50/30")}
              style={{ height: GRID_HEIGHT }}
            >
              {HOURS.map(h => (
                <div key={h} className="absolute w-full border-t border-slate-100"
                  style={{ top: (h / 24) * GRID_HEIGHT }} />
              ))}
              {dayEvs.map(ev => {
                const start = new Date(ev.startTime);
                const end = new Date(ev.endTime);
                const topPct = minuteOfDay(start) / 1440;
                const durMin = Math.max(30, (ev.endTime - ev.startTime) / 60000);
                const heightPct = Math.min(durMin / 1440, 1 - topPct);
                const color = (ev.assignedToId && memberColorMap[ev.assignedToId]) || ev.color || '#6366f1';
                return (
                  <button
                    key={ev.id}
                    onClick={() => setPopover(ev)}
                    className="absolute left-1 right-1 rounded text-left text-white text-[10px] font-semibold px-1 overflow-hidden shadow-sm"
                    style={{
                      top: topPct * GRID_HEIGHT,
                      height: Math.max(20, heightPct * GRID_HEIGHT),
                      backgroundColor: color,
                      zIndex: 2,
                    }}
                  >
                    <p className="truncate">{ev.title}</p>
                    <p className="opacity-80">{format(start, 'h:mm a')}</p>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {popover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setPopover(null)}>
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="w-3 h-3 rounded-full mb-3" style={{ backgroundColor: popover.color || '#6366f1' }} />
            <h3 className="font-bold text-lg mb-1">{popover.title}</h3>
            <p className="text-sm text-slate-500 mb-1">
              {format(new Date(popover.startTime), 'EEE, MMM d · h:mm a')} – {format(new Date(popover.endTime), 'h:mm a')}
            </p>
            {popover.description && <p className="text-sm text-slate-600 mt-2">{popover.description}</p>}
            <button onClick={() => setPopover(null)} className="mt-4 w-full py-2 bg-slate-100 rounded-xl text-sm font-semibold">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
