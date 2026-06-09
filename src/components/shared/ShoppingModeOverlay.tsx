import React, { useMemo, useState } from 'react';
import { ShoppingCart, X, CheckCircle2, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useListsController } from '../../hooks/useListsController';
import { cn } from '../../lib/utils';

interface ShoppingModeOverlayProps {
  parentId: string;
  onClose: () => void;
}

export function ShoppingModeOverlay({ parentId, onClose }: ShoppingModeOverlayProps) {
  const { shoppingItems, toggleItem } = useListsController({ parentId, preferredCategory: 'shopping' });
  const [activeStore, setActiveStore] = useState<string | null>(null);

  const stores = useMemo(() => {
    const s = new Set<string>();
    shoppingItems.forEach(item => {
      if (item.completed === 0 && item.storeName) {
        s.add(item.storeName);
      }
    });
    return Array.from(s).sort();
  }, [shoppingItems]);

  const filteredItems = useMemo(() => {
    if (!activeStore) return shoppingItems.filter(i => i.completed === 0);
    return shoppingItems.filter(item => 
      item.completed === 0 && item.storeName === activeStore
    );
  }, [activeStore, shoppingItems]);

  // Set first store as active if none selected and stores available
  useMemo(() => {
    if (!activeStore && stores.length > 0) {
      setActiveStore(stores[0]);
    }
  }, [stores, activeStore]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
            <ShoppingCart size={24} />
          </div>
          <h2 className="text-xl font-black text-ui-primary">Shopping Mode</h2>
        </div>
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-ui-soft text-ui-muted transition-colors hover:bg-ui-soft-3 hover:text-ui-primary"
        >
          <X size={24} />
        </button>
      </header>

      {/* Store Selector */}
      <div className="flex shrink-0 gap-2 overflow-x-auto border-b bg-ui-soft p-3 hide-scrollbar">
        {stores.length === 0 ? (
          <p className="text-sm font-bold text-ui-muted">No stores tagged.</p>
        ) : (
          stores.map(store => (
            <button
              key={store}
              onClick={() => setActiveStore(store)}
              className={cn(
                "whitespace-nowrap rounded-full border px-5 py-2 text-sm font-black transition-all active:scale-95",
                activeStore === store
                  ? "border-ui-primary bg-ui-primary text-white shadow-md"
                  : "border-ui bg-white text-ui-primary hover:bg-ui-soft-2"
              )}
            >
              {store}
            </button>
          ))
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredItems.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center opacity-60">
            <div className="mb-4 rounded-full bg-ui-soft p-6">
              <ShoppingCart size={48} className="text-ui-muted" />
            </div>
            <p className="text-lg font-bold text-ui-primary">No items found</p>
            <p className="text-sm text-ui-muted">All caught up or try another store.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filteredItems.map(item => (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-3 rounded-2xl border border-ui bg-ui-soft p-4 shadow-sm"
                onClick={() => void toggleItem(item.id, true)}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                  <Circle className="text-ui-muted" size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold text-ui-primary">{item.text}</p>
                  {item.locationName && (
                    <span className="text-xs font-black uppercase tracking-wider text-ui-muted">{item.locationName}</span>
                  )}
                </div>
                <button
                   className="flex h-10 w-10 items-center justify-center rounded-full text-emerald-500 hover:bg-emerald-50"
                   aria-label={`Got ${item.text}`}
                >
                  <CheckCircle2 size={28} />
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer / Info */}
      <footer className="shrink-0 border-t bg-ui-soft p-4 text-center">
        <p className="text-xs font-bold text-ui-muted">Tap any item to mark it as found and remove it from the list.</p>
      </footer>
    </div>
  );
}
