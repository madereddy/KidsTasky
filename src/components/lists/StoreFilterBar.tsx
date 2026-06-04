import React from 'react';
import { cn } from '../../lib/utils';
import { AppListItem } from '../../types';

interface StoreFilterBarProps {
  items: AppListItem[];
  activeStore: string | null;
  onSelectStore: (store: string | null) => void;
}

export function StoreFilterBar({ items, activeStore, onSelectStore }: StoreFilterBarProps) {
  // Get unique store names from uncompleted items
  const stores = Array.from(new Set(items.filter(i => i.completed === 0 && i.storeName).map(i => i.storeName as string)));
  
  if (stores.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto p-3 border-b border-ui bg-ui-soft hide-scrollbar">
      <button
        onClick={() => onSelectStore(null)}
        className={cn(
          "px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border",
          activeStore === null ? "bg-ui-primary text-white border-ui-primary" : "bg-white text-ui-muted border-ui hover:bg-ui-soft-2"
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
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border flex items-center gap-1",
              activeStore === store ? "bg-blue-500 text-white border-blue-500" : "bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
            )}
          >
            {store} <span className="opacity-70">({count})</span>
          </button>
        );
      })}
    </div>
  );
}
