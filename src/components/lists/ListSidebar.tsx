// src/components/lists/ListSidebar.tsx
import React from 'react';
import { X } from 'lucide-react';
import { AppListItem } from '../../types';

interface Props {
  listTitle: string;
  items: AppListItem[];
  isOpen: boolean;
  onToggleItem: (id: string, isCompleted: boolean) => void;
  onClose?: () => void;
}

export function ListSidebar({ listTitle, items, isOpen, onToggleItem, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl border-l z-40 transform transition-transform duration-300">
      <div className="p-4 border-b flex justify-between items-center bg-gray-50">
        <h2 className="text-xl font-bold">{listTitle}</h2>
        {onClose && (
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
            <X size={20} />
          </button>
        )}
      </div>
      
      <div className="p-4 overflow-y-auto max-h-[calc(100vh-70px)]">
        {items.length === 0 ? (
          <p className="text-gray-400 text-center mt-10">No items.</p>
        ) : (
          <ul className="space-y-3">
            {items.map(item => (
              <li key={item.id} className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  checked={item.completed === 1}
                  onChange={(e) => onToggleItem(item.id, e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={item.completed === 1 ? 'line-through text-gray-400' : 'text-gray-800'}>
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
