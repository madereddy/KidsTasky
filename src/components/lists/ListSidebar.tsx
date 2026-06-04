// src/components/lists/ListSidebar.tsx
import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { AppListItem } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  listTitle: string;
  items: AppListItem[];
  isOpen: boolean;
  onToggleItem: (id: string, isCompleted: boolean) => void;
  onClose?: () => void;
  onAddItem?: (text: string, store?: string) => void;
  onDeleteItem?: (id: string) => void;
  onDeleteList?: () => void;
  inline?: boolean;
}

export function ListSidebar({ listTitle, items, isOpen, onToggleItem, onClose, onAddItem, onDeleteItem, onDeleteList, inline }: Props) {
  const [newItemText, setNewItemText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedStoreChip, setSelectedStoreChip] = useState<string | null>(null);

  const COMMON_STORES = ['Costco', 'Walmart', 'Target', 'Trader Joe\'s', 'Grocery'];

  if (!isOpen) return null;

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim() || !onAddItem) return;
    onAddItem(newItemText.trim(), selectedStoreChip || undefined);
    setNewItemText('');
    setSelectedStoreChip(null);
  };

  const containerClass = inline
    ? "flex flex-col h-full"
    : "fixed inset-y-0 right-0 w-80 bg-white shadow-2xl border-l z-40 transform transition-transform duration-300 flex flex-col";

  return (
    <div className={containerClass}>
      <div className="p-4 border-b border-ui flex justify-between items-center bg-ui-soft shrink-0">
        <h2 className="text-xl font-bold truncate flex-1 text-ui-primary">{listTitle}</h2>
        <div className="flex items-center gap-1 shrink-0">
          {onDeleteList && (
            confirmDelete ? (
              <div className="flex gap-1 items-center">
                <span className="text-xs text-red-500 font-semibold">Delete?</span>
                <button onClick={onDeleteList} className="px-2 py-1 bg-red-500 text-white text-xs rounded-lg font-semibold">Yes</button>
                <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 bg-ui-soft-3 text-xs rounded-lg font-semibold">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="p-2 hover:bg-red-100 text-ui-muted-2 hover:text-red-500 rounded-full transition-colors">
                <Trash2 size={16} />
              </button>
            )
          )}
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-ui-soft-3 rounded-full">
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 overflow-y-auto flex-1">
        {items.length === 0 ? (
          <p className="text-ui-muted-2 text-center mt-10 text-sm">No items yet.</p>
        ) : (
          <ul className="space-y-2">
            {items.map(item => (
              <li key={item.id} className="flex items-center gap-3 group">
                <input
                  type="checkbox"
                  checked={item.completed === 1}
                  onChange={(e) => onToggleItem(item.id, e.target.checked)}
                  className="w-5 h-5 rounded border-ui text-blue-600 focus:ring-blue-500 shrink-0"
                />
                <span className={cn("text-sm font-medium break-words flex-1", item.completed === 1 ? "text-ui-muted line-through" : "text-ui-primary")}>
                  {item.text}
                </span>
                {item.storeName && item.completed !== 1 && (
                  <span className="ml-2 inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold uppercase rounded-sm border border-blue-200">
                    {item.storeName}
                  </span>
                )}
                {onDeleteItem && (
                  <button
                    onClick={() => onDeleteItem(item.id)}
                    className="text-ui-muted-2 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {onAddItem && (
        <div className="p-3 border-t border-ui bg-white flex flex-col gap-2 shrink-0">
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            {COMMON_STORES.map(store => (
              <button
                key={store}
                type="button"
                onClick={() => setSelectedStoreChip(prev => prev === store ? null : store)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[10px] font-bold whitespace-nowrap transition-colors border",
                  selectedStoreChip === store ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-ui-soft text-ui-muted border-transparent hover:bg-ui-soft-2"
                )}
              >
                {store}
              </button>
            ))}
          </div>
          <form onSubmit={handleAddItem} className="flex gap-2">
            <input
              value={newItemText}
              onChange={e => setNewItemText(e.target.value)}
              placeholder="Add item…"
              className="flex-1 border border-ui rounded-lg px-3 py-2 text-sm text-ui-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button type="submit" className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
              <Plus size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

