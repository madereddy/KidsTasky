import React from 'react';
import { Suggestion } from '../../lib/suggestions';
import { cn } from '../../lib/utils';

interface SuggestionBarProps {
  suggestions: Suggestion[];
  onSelect: (suggestion: Suggestion) => void;
  className?: string;
}

export function SuggestionBar({ suggestions, onSelect, className }: SuggestionBarProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-2 hide-scrollbar", className)}>
      {suggestions.map(s => (
        <button
          key={s.id}
          onClick={() => onSelect(s)}
          className={cn(
            "flex-none px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-all active:scale-95",
            "bg-slate-100 hover:bg-slate-200 text-slate-700",
            "border border-slate-200/50 shadow-sm",
            s.type === 'who' && "border-blue-200/50 bg-blue-50/50 hover:bg-blue-100/50",
            s.type === 'when' && "border-amber-200/50 bg-amber-50/50 hover:bg-amber-100/50",
            s.type === 'where' && "border-emerald-200/50 bg-emerald-50/50 hover:bg-emerald-100/50"
          )}
        >
          <span className="mr-1.5 opacity-70">
            {s.type === 'who' && '👤'}
            {s.type === 'when' && '⏰'}
            {s.type === 'where' && '📍'}
          </span>
          {s.label}
        </button>
      ))}
    </div>
  );
}
