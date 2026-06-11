import React from 'react';

export function FrequentItemChips({ items, onAdd }: { items: string[], onAdd: (item: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 px-2 no-scrollbar">
      {items.map(item => (
        <button
          key={item}
          onClick={() => onAdd(item)}
          className="whitespace-nowrap px-4 py-2 rounded-full border border-ui bg-white/50 backdrop-blur-sm text-sm font-bold hover:bg-sky-500 hover:text-white transition-all active:scale-95"
        >
          + {item}
        </button>
      ))}
    </div>
  );
}
