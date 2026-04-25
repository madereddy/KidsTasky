// src/components/calendar/CalendarMonthView.tsx
import React from 'react';
import { CalendarEvent } from '../../types';

export function CalendarMonthView({ events }: { events: CalendarEvent[] }) {
  // A complete month view mathematical grid will be fleshed out progressively. 
  // For now, we establish the layout boundary.
  return (
    <div className="flex-1 w-full flex flex-col p-4 bg-gray-50 pb-20">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Month View</h2>
      </div>
      <div className="grid grid-cols-7 gap-2 flex-1">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => (
          <div key={day} className="text-center font-semibold text-gray-500">{day}</div>
        ))}
        {/* Placeholder for days */}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="min-h-[80px] bg-white rounded-lg shadow-sm border border-gray-100 p-1">
            <span className="text-sm text-gray-400">{i % 30 + 1}</span>
            <div className="mt-1 space-y-1">
              {events.slice(0,1).map(ev => (
                <div key={ev.id} className="text-[10px] px-1 rounded truncate text-white" style={{ backgroundColor: ev.color }}>
                  {ev.title}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
