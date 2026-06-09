import React from 'react';
import { Clock3 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FrequentItem {
  text: string;
  listIds?: string[];
  storeNames?: string[];
  locationNames?: string[];
}

interface FrequentItemsProps {
  items: FrequentItem[];
  onSelect: (item: FrequentItem) => void;
  className?: string;
}

export function FrequentItems({ items, onSelect, className }: FrequentItemsProps) {
  if (items.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-ui-muted">
        <Clock3 size={12} />
        Frequent Adds
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
        {items.map((item, index) => (
          <button
            key={`${item.text}-${index}`}
            type="button"
            onClick={() => onSelect(item)}
            className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100 flex items-center gap-1.5"
          >
            + {item.text}
            {item.listIds && item.listIds.length > 1 && (
              <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] text-white">
                {item.listIds.length}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
