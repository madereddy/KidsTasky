import React from 'react';
import { cn } from '../../lib/utils';
import { HouseholdLocationOption } from '../../lib/householdListPreferences';

interface LocationFilterBarProps {
  activeLocation: string | null;
  onLocationSelect: (location: string | null) => void;
  locationOptions?: HouseholdLocationOption[];
}

export function LocationFilterBar({ 
  activeLocation, 
  onLocationSelect,
  locationOptions = []
}: LocationFilterBarProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-4 hide-scrollbar px-2">
      <button
        onClick={() => onLocationSelect(null)}
        className={cn(
          "flex flex-col items-center gap-1 min-w-[70px] p-2 rounded-2xl border transition-all",
          activeLocation === null 
            ? "bg-ui-primary text-white border-ui-primary shadow-lg scale-105" 
            : "bg-white text-ui-muted border-ui hover:bg-ui-soft"
        )}
      >
        <span className="text-xl">🌟</span>
        <span className="text-[10px] font-bold uppercase tracking-wider">All</span>
      </button>

      {locationOptions.map((loc) => (
        <button
          key={loc.id}
          onClick={() => onLocationSelect(activeLocation === loc.label ? null : loc.label)}
          className={cn(
            "flex flex-col items-center gap-1 min-w-[70px] p-2 rounded-2xl border transition-all",
            activeLocation === loc.label 
              ? "bg-sky-500 text-white border-sky-600 shadow-lg scale-105" 
              : "bg-white text-ui-muted border-ui hover:bg-ui-soft"
          )}
        >
          <span className="text-xl">{'icon' in loc ? (loc as any).icon : '📍'}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider">{loc.label}</span>
        </button>
      ))}
    </div>
  );
}
