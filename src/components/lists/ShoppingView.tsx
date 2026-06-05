import React, { useEffect, useMemo, useState } from 'react';
import { Clipboard, ClipboardCheck, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useListsController } from '../../hooks/useListsController';
import { cn } from '../../lib/utils';
import { FrequentItems } from './FrequentItems';
import { StoreFilterBar } from './StoreFilterBar';

interface Props {
  parentId: string;
}

export function ShoppingView({ parentId }: Props) {
  const [newListTitle, setNewListTitle] = useState('');
  const [newItemText, setNewItemText] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeStoreFilter, setActiveStoreFilter] = useState<string | null>(null);
  const {
    shoppingLists,
    shoppingItems,
    selectedListId,
    setSelectedListId,
    createList,
    deleteList,
    addItem,
    toggleItem,
    deleteItem,
    frequentItems,
  } = useListsController({ parentId, preferredCategory: 'shopping' });

  useEffect(() => {
    if (!selectedListId && shoppingLists.length > 0) {
      setSelectedListId(shoppingLists[0].id);
    }
  }, [selectedListId, setSelectedListId, shoppingLists]);

  const selectedList = useMemo(
    () => shoppingLists.find((list) => list.id === selectedListId) ?? shoppingLists[0] ?? null,
    [selectedListId, shoppingLists],
  );

  const listTitlesById = useMemo(
    () => new Map(shoppingLists.map((list) => [list.id, list.title])),
    [shoppingLists],
  );

  const filteredItems = useMemo(() => {
    if (!activeStoreFilter) return shoppingItems;
    return shoppingItems.filter((item) => (
      item.storeName === activeStoreFilter || item.locationName === activeStoreFilter
    ));
  }, [activeStoreFilter, shoppingItems]);

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    await createList(newListTitle.trim(), 'shopping');
    setNewListTitle('');
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim() || !selectedList) return;
    await addItem(newItemText.trim());
    setNewItemText('');
  };

  const handleCopyItems = async () => {
    const text = filteredItems.map((item) => item.text).join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteList = async (listId: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this shopping list?')) return;
    await deleteList(listId);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[2rem] border border-ui bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-amber-700">
              <ShoppingCart size={12} />
              Shopping
            </div>
            <div>
              <h2 className="text-2xl font-black text-ui-primary">Fast family shopping</h2>
              <p className="text-sm text-ui-muted">One queue for active grocery and supply items, with quick-add suggestions from recent history.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyItems}
              disabled={filteredItems.length === 0}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                copied ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-ui bg-white text-ui-muted hover:bg-ui-soft",
                filteredItems.length === 0 && "cursor-not-allowed opacity-50",
              )}
            >
              {copied ? <ClipboardCheck size={16} /> : <Clipboard size={16} />}
              {copied ? 'Copied' : 'Copy queue'}
            </button>
            {selectedList && (
              <button
                type="button"
                onClick={() => void handleDeleteList(selectedList.id)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
              >
                <Trash2 size={16} />
                Delete list
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <div className="space-y-4 rounded-[1.5rem] border border-ui bg-ui-soft p-4">
            <div className="space-y-3">
              <label className="text-[11px] font-black uppercase tracking-[0.18em] text-ui-muted">Send new items to</label>
              <div className="flex flex-wrap gap-2">
                {shoppingLists.map((list) => (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => setSelectedListId(list.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                      selectedList?.id === list.id
                        ? "border-sky-600 bg-sky-500 text-white"
                        : "border-ui bg-white text-ui-muted hover:bg-ui-soft-2",
                    )}
                  >
                    {list.title}
                  </button>
                ))}
                {shoppingLists.length === 0 && (
                  <p className="text-sm text-ui-muted">Create a shopping list to start capturing items.</p>
                )}
              </div>
            </div>

            <FrequentItems
              items={frequentItems}
              onSelect={(item) => {
                if (!selectedList) return;
                void addItem(item.text, item.storeName, item.locationName);
              }}
            />

            <form onSubmit={handleAddItem} className="flex flex-col gap-3 sm:flex-row">
              <input
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                placeholder={selectedList ? `Add to ${selectedList.title}` : 'Create a shopping list first'}
                disabled={!selectedList}
                className="flex-1 rounded-2xl border border-ui bg-white px-4 py-3 text-sm text-ui-primary focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:cursor-not-allowed disabled:bg-ui-soft"
              />
              <button
                type="submit"
                disabled={!selectedList || !newItemText.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-200"
              >
                <Plus size={16} />
                Add item
              </button>
            </form>
          </div>

          <div className="rounded-[1.5rem] border border-ui bg-white p-4">
            <label className="mb-3 block text-[11px] font-black uppercase tracking-[0.18em] text-ui-muted">Create shopping lists</label>
            <form onSubmit={handleCreateList} className="flex gap-2">
              <input
                value={newListTitle}
                onChange={(e) => setNewListTitle(e.target.value)}
                placeholder="Weekend groceries"
                className="flex-1 rounded-xl border border-ui px-3 py-2 text-sm text-ui-primary focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
              <button type="submit" className="rounded-xl bg-ui-primary px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-ui-primary/90">
                New
              </button>
            </form>
            <div className="mt-4 space-y-2">
              {shoppingLists.map((list) => {
                const pendingCount = shoppingItems.filter((item) => item.listId === list.id).length;
                return (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => setSelectedListId(list.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition-colors",
                      selectedList?.id === list.id ? "border-sky-300 bg-sky-50" : "border-ui bg-ui-soft hover:bg-white",
                    )}
                  >
                    <span className="font-semibold text-ui-primary">{list.title}</span>
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-ui-muted">{pendingCount} open</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-ui bg-white shadow-sm">
        <div className="border-b border-ui px-5 py-4">
          <h3 className="text-lg font-black text-ui-primary">Open shopping queue</h3>
          <p className="text-sm text-ui-muted">All active shopping items across every shopping list.</p>
        </div>
        <StoreFilterBar items={shoppingItems} activeStore={activeStoreFilter} onSelectStore={setActiveStoreFilter} />
        <div className="p-5">
          {filteredItems.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-ui bg-ui-soft px-6 py-12 text-center">
              <p className="text-lg font-semibold text-ui-primary">No shopping items waiting.</p>
              <p className="mt-1 text-sm text-ui-muted">Add an item above or use a frequent add chip.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {filteredItems.map((item) => (
                <li key={item.id} className="flex items-start gap-3 rounded-2xl border border-ui bg-ui-soft px-4 py-3">
                  <input
                    type="checkbox"
                    checked={item.completed === 1}
                    onChange={(e) => void toggleItem(item.id, e.target.checked)}
                    className="mt-1 h-5 w-5 rounded border-ui text-sky-600 focus:ring-sky-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ui-primary">{item.text}</p>
                      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wide text-ui-muted">
                        {listTitlesById.get(item.listId) ?? 'Shopping'}
                      </span>
                      {item.storeName && (
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-blue-700">
                          {item.storeName}
                        </span>
                      )}
                      {item.locationName && (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">
                          {item.locationName}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteItem(item.id)}
                    className="rounded-full p-2 text-ui-muted transition-colors hover:bg-red-50 hover:text-red-500"
                    aria-label={`Delete ${item.text}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
