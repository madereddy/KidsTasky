import React, { useMemo } from 'react';
import { cn } from '../../lib/utils';
import { AppListItem } from '../../types';

interface StoreFilterBarProps {
  items: AppListItem[];
  activeStore: string | null;
  onSelectStore: (store: string | null) => void;
}

export function StoreFilterBar({ items, activeStore, onSelectStore }: StoreFilterBarProps) {
  // Get unique store names from uncompleted items
  const stores = useMemo(() => {
    return Array.from(new Set(items.filter(i => i.completed === 0 && i.storeName).map(i => i.storeName as string)));
  }, [items]);

  if (stores.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 border-b border-ui bg-ui-soft p-3 sm:flex-nowrap sm:overflow-x-auto sm:hide-scrollbar">
      <button
        onClick={() => onSelectStore(null)}
        aria-pressed={activeStore === null}
        aria-label="Show all items"
        className={cn(
          "min-h-11 rounded-full border px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-primary focus-visible:ring-offset-2",
          activeStore === null
            ? "border-ui-primary bg-ui-primary text-white shadow-sm"
            : "bg-white text-ui-primary border-ui hover:bg-ui-soft-2"
        )}
      >
        All
      </button>
      {stores.map(store => {
        const count = items.filter(i => i.completed === 0 && i.storeName === store).length;
        return (
          <button
            key={store}
            onClick={() => onSelectStore(store)}
            aria-pressed={activeStore === store}
            aria-label={`Filter by ${store} store`}
            className={cn(
              "flex min-h-11 items-center gap-1 rounded-full border px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-primary focus-visible:ring-offset-2",
              activeStore === store
                ? "border-ui-primary bg-ui-primary text-white shadow-sm"
                : "bg-white text-ui-primary border-ui hover:bg-ui-soft-2"
            )}
          >
            {store} <span className="opacity-70">({count})</span>
          </button>
        );
      })}
    </div>
  );
}
