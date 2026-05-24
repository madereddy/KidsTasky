import React, { useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { CalendarEvent } from '../../types';
import { MealPlanWithRecipe } from '../../services/meals';
import { cn } from '../../lib/utils';

interface Props {
  events: CalendarEvent[];
  day: Date;
  memberColorMap: Record<string, string>;
  onTimeSlotClick?: (time: string) => void;
  dayMeals?: MealPlanWithRecipe[];
}

const GRID_HEIGHT = 960;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function minuteOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function CalendarDayView({ events, day, memberColorMap, onTimeSlotClick, dayMeals }: Props) {
  const [popover, setPopover] = useState<CalendarEvent | null>(null);
  const dayEvents = events.filter(ev => isSameDay(new Date(ev.startTime), day));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b py-3 px-4 text-center">
        <p className="text-xs font-bold text-slate-500 uppercase">{format(day, 'EEEE')}</p>
        <p className="text-2xl font-bold text-slate-800">{format(day, 'MMMM d, yyyy')}</p>
      </div>

      {dayMeals && dayMeals.length > 0 && (
        <div className="shrink-0 mx-4 my-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
          <p className="text-xs font-bold text-amber-700 mb-2 uppercase tracking-wide">Today's Meals</p>
          <div className="space-y-1">
            {dayMeals.map(meal => (
              <div key={meal.id} className="flex gap-2 text-sm">
                <span className="text-amber-500 font-semibold w-20 shrink-0">{meal.mealType}</span>
                <span className="text-slate-700">{(meal as any).recipeName ?? 'Planned'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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

        <div className="flex-1 border-l border-slate-100 relative" style={{ height: GRID_HEIGHT }}>
          {HOURS.map(h => (
            <div
              key={h}
              className="absolute w-full border-t border-slate-100 cursor-pointer hover:bg-blue-50/40"
              style={{ top: (h / 24) * GRID_HEIGHT, height: GRID_HEIGHT / 24 }}
              onClick={() => onTimeSlotClick?.(`${String(h).padStart(2, '0')}:00`)}
            />
          ))}

          {dayEvents.map(ev => {
            const start = new Date(ev.startTime);
            const topPct = minuteOfDay(start) / 1440;
            const durMin = Math.max(30, (ev.endTime - ev.startTime) / 60000);
            const heightPct = Math.min(durMin / 1440, 1 - topPct);
            const color = (ev.assignedToId && memberColorMap[ev.assignedToId]) || ev.color || '#6366f1';
            return (
              <button
                key={ev.id}
                onClick={() => setPopover(ev)}
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
                  {format(start, 'h:mm a')} – {format(new Date(ev.endTime), 'h:mm a')}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {popover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setPopover(null)}>
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="w-3 h-3 rounded-full mb-3" style={{ backgroundColor: popover.color || '#6366f1' }} />
            <h3 className="font-bold text-lg mb-1">{popover.title}</h3>
            <p className="text-sm text-slate-500 mb-1">
              {format(new Date(popover.startTime), 'h:mm a')} – {format(new Date(popover.endTime), 'h:mm a')}
            </p>
            {popover.description && <p className="text-sm text-slate-600 mt-2">{popover.description}</p>}
            <button onClick={() => setPopover(null)} className="mt-4 w-full py-2 bg-slate-100 rounded-xl text-sm font-semibold">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
