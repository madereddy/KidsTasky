import { Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  items: string[];
  onAdd: (item: string) => void;
  isWallMode?: boolean;
}

const ITEM_EMOJI: Record<string, string> = {
  milk: '🥛', eggs: '🥚', bread: '🍞', butter: '🧈', cheese: '🧀',
  chicken: '🍗', rice: '🍚', pasta: '🍝', apples: '🍎', bananas: '🍌',
};

export function GroceryChips({ items, onAdd, isWallMode }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {items.map(item => {
        const emoji = ITEM_EMOJI[item.toLowerCase()] ?? '🛒';
        return (
          <button
            key={item}
            onClick={() => onAdd(item)}
            className={cn(
              'flex items-center gap-2 flex-shrink-0 px-4 py-2 rounded-full',
              'bg-white dark:bg-white/10 border border-gray-200 dark:border-gray-700',
              'text-gray-700 dark:text-gray-200 font-medium',
              'hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-400',
              'active:scale-95 transition-all duration-150',
              isWallMode ? 'text-lg px-5 py-3' : 'text-sm'
            )}
          >
            <span>{emoji}</span>
            <span className="capitalize">{item}</span>
            <Plus size={isWallMode ? 18 : 14} className="text-emerald-500" />
          </button>
        );
      })}
    </div>
  );
}
