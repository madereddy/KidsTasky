import React, { useMemo, useState } from 'react';
import { ShoppingCart, X, CheckCircle2, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useListsController } from '../../hooks/useListsController';
import { useHouseholdListPreferences } from '../../hooks/useHouseholdListPreferences';
import { cn } from '../../lib/utils';

interface ShoppingModeOverlayProps {
  parentId: string;
  onClose: () => void;
}

export function ShoppingModeOverlay({ parentId, onClose }: ShoppingModeOverlayProps) {
  const { shoppingItems, toggleItem, shoppingLists } = useListsController({ parentId, preferredCategory: 'shopping' });
  const [activeStore, setActiveStore] = useState<string | null>(null);
  const [stagedOriginalIds, setStagedOriginalIds] = useState<Set<string>>(new Set());

  const listTitlesById = useMemo(
    () => new Map(shoppingLists.map((list) => [list.id, list.title])),
    [shoppingLists],
  );

  const handleToggle = (item: { originalIds: string[] }) => {
    const isStaged = item.originalIds.every(id => stagedOriginalIds.has(id));
    setStagedOriginalIds(prev => {
      const next = new Set(prev);
      if (isStaged) {
        item.originalIds.forEach(id => next.delete(id));
      } else {
        item.originalIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleClose = async () => {
    const idsToComplete = Array.from(stagedOriginalIds);
    // Fire off completion updates without blocking the UI close
    idsToComplete.forEach(id => {
      void toggleItem(id, true);
    });
    onClose();
  };

  // Deduplicate items by text across different lists, falling back to list title for store name
  const deduplicatedItems = useMemo(() => {
    const groups = new Map<string, typeof shoppingItems>();
    for (const item of shoppingItems) {
      if (item.completed === 1) continue;
      const key = item.text.trim().toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    
    return Array.from(groups.values()).map(group => {
      const first = group[0];
      
      // Collect explicit store names
      const explicitStores = group.map(i => i.storeName).filter(Boolean) as string[];
      
      // Fallback to list titles if no explicit store name is present for a specific item instance
      const implicitStores = group
        .filter(i => !i.storeName)
        .map(i => listTitlesById.get(i.listId))
        .filter(Boolean) as string[];

      const allStores = Array.from(new Set([...explicitStores, ...implicitStores]));
      const allLocationNames = Array.from(new Set(group.map(i => i.locationName).filter(Boolean)));
      
      return {
        ...first,
        id: group.map(i => i.id).join(','), // virtual id
        originalIds: group.map(i => i.id),
        allStoreNames: allStores,
        allLocationNames,
      };
    });
  }, [shoppingItems, listTitlesById]);

  const storeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    deduplicatedItems.forEach(item => {
      item.allStoreNames.forEach(store => {
        counts[store] = (counts[store] || 0) + 1;
      });
    });
    return counts;
  }, [deduplicatedItems]);

  const storesWithItems = useMemo(() => {
    const s = new Set<string>();
    deduplicatedItems.forEach(item => {
      item.allStoreNames.forEach(store => s.add(store));
    });
    return Array.from(s).sort();
  }, [deduplicatedItems]);

  // Combine master list of shopping list titles with any stores found in items (explicit @ tags)
  const allStores = useMemo(() => {
    const combined = new Set([...shoppingLists.map(l => l.title), ...storesWithItems]);
    return Array.from(combined).sort();
  }, [shoppingLists, storesWithItems]);

  const filteredItems = useMemo(() => {
    let items = deduplicatedItems;
    if (activeStore) {
      items = deduplicatedItems.filter(item => item.allStoreNames.includes(activeStore));
    }
    
    // Sort so staged items are at the bottom
    return [...items].sort((a, b) => {
      const aStaged = a.originalIds.every(id => stagedOriginalIds.has(id));
      const bStaged = b.originalIds.every(id => stagedOriginalIds.has(id));
      if (aStaged === bStaged) return 0;
      return aStaged ? 1 : -1;
    });
  }, [activeStore, deduplicatedItems, stagedOriginalIds]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
            <ShoppingCart size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-ui-primary leading-tight">Shopping Mode</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-ui-muted">
              {activeStore ? `Browsing ${activeStore}` : 'All Stores'}
            </p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-ui-soft text-ui-muted transition-colors hover:bg-ui-soft-3 hover:text-ui-primary"
        >
          <X size={24} />
        </button>
      </header>

      {/* List */}
      <div className="flex-1 overflow-y-auto bg-ui-soft/30 p-4">
        <AnimatePresence mode="popLayout">
          {filteredItems.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex h-full flex-col items-center justify-center text-center opacity-60"
            >
              <div className="mb-4 rounded-full bg-ui-soft p-6">
                <ShoppingCart size={48} className="text-ui-muted" />
              </div>
              <p className="text-lg font-bold text-ui-primary">No items found</p>
              <p className="text-sm text-ui-muted">
                {activeStore ? `Nothing left to get at ${activeStore}!` : 'Your shopping list is empty.'}
              </p>
            </motion.div>
          ) : (
            <ul className="space-y-3 pb-8">
              {filteredItems.map(item => {
                const isStaged = item.originalIds.every(id => stagedOriginalIds.has(id));
                return (
                  <motion.li
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, x: -20 }}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-2xl border border-ui p-4 shadow-sm transition-all active:scale-[0.98]",
                      isStaged ? "bg-ui-soft/50 opacity-60" : "bg-white"
                    )}
                    onClick={() => handleToggle(item)}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                      {isStaged ? (
                        <CheckCircle2 className="text-emerald-500" size={26} />
                      ) : (
                        <Circle className="text-ui-soft-3 group-active:text-emerald-500 transition-colors" size={26} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn(
                        "text-lg font-bold leading-tight transition-all",
                        isStaged ? "text-ui-muted line-through" : "text-ui-primary"
                      )}>
                        {item.text}
                      </p>
                      <div className="mt-0.5 flex flex-wrap gap-2">
                        {!activeStore && item.allStoreNames.map(store => (
                          <span key={store} className="text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 rounded">
                            {store}
                          </span>
                        ))}
                        {item.allLocationNames.map(loc => (
                          <span key={loc} className="text-[10px] font-black uppercase tracking-wider text-ui-muted">
                            📍 {loc}
                          </span>
                        ))}
                      </div>
                    </div>
                    {!isStaged && (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full text-ui-soft-3 group-active:text-emerald-500">
                        <CheckCircle2 size={28} />
                      </div>
                    )}
                  </motion.li>
                );
              })}
            </ul>
          )}
        </AnimatePresence>
      </div>

      {/* Store Selector */}
      <div className="flex shrink-0 gap-2 overflow-x-auto border-t bg-ui-soft p-3 hide-scrollbar">
        <button
          onClick={() => setActiveStore(null)}
          className={cn(
            "whitespace-nowrap rounded-full border px-5 py-2 text-sm font-black transition-all active:scale-95",
            activeStore === null
              ? "border-ui-primary bg-ui-primary text-white shadow-md"
              : "border-ui bg-white text-ui-primary hover:bg-ui-soft-2"
          )}
        >
          All <span className="ml-1 opacity-60">({deduplicatedItems.length})</span>
        </button>
        {allStores.map(store => {
          const count = storeCounts[store] || 0;
          return (
            <button
              key={store}
              onClick={() => setActiveStore(store)}
              className={cn(
                "whitespace-nowrap rounded-full border px-5 py-2 text-sm font-black transition-all active:scale-95",
                activeStore === store
                  ? "border-ui-primary bg-ui-primary text-white shadow-md"
                  : "border-ui bg-white text-ui-primary hover:bg-ui-soft-2",
                count === 0 && activeStore !== store && "opacity-40"
              )}
            >
              {store} <span className="ml-1 opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Footer / Info */}
      <footer className="shrink-0 border-t bg-white p-4 text-center shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
        <p className="text-xs font-bold text-ui-muted">
          {stagedOriginalIds.size > 0 
            ? `${stagedOriginalIds.size} item${stagedOriginalIds.size === 1 ? '' : 's'} ready to check off.`
            : "Tap any item to mark it as found."}
        </p>
      </footer>
    </div>
  );
}
