import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Clipboard, ClipboardCheck, Settings2, MapPin } from 'lucide-react';
import { ListSidebar } from './ListSidebar';
import { StoreFilterBar } from './StoreFilterBar';
import { cn } from '../../lib/utils';
import { useListsController } from '../../hooks/useListsController';
import { COMMON_LOCATIONS } from '../../constants';

interface Props {
  parentId: string;
}

export function RoutinesView({ parentId }: Props) {
  const [newListTitle, setNewListTitle] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeStoreFilter, setActiveStoreFilter] = useState<string | null>(null);
  const [showListSettings, setShowListSettings] = useState(false);
  const [editingListTitle, setEditingListTitle] = useState('');

  const {
    lists,
    routineLists,
    items,
    selectedList,
    selectedListId,
    setSelectedListId,
    createList,
    updateList,
    deleteList,
    addItem,
    addItemToLists,
    copyItemToLists,
    moveItemToList,
    toggleItem,
    deleteItem,
    frequentItems,
  } = useListsController({ parentId, preferredCategory: 'routine' });

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    await createList(newListTitle.trim(), 'routine');
    setNewListTitle('');
  };

  const handleDeleteList = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to delete this routine?')) return;
    await deleteList(id);
  };

  const handleAddItem = async (text: string, explicitStore?: string, explicitLocation?: string) => {
    await addItem(text, explicitStore, explicitLocation);
  };

  const handleRenameSelectedList = async () => {
    if (!selectedList || !editingListTitle.trim() || editingListTitle.trim() === selectedList.title) return;
    await updateList(selectedList.id, editingListTitle.trim(), selectedList.category, selectedList.isRoutine, selectedList.locationName);
  };

  const handleCopyItems = () => {
    const unchecked = items.filter((it) => it.completed === 0).map((it) => it.text).join('\n');
    navigator.clipboard.writeText(unchecked);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredItems = useMemo(() => {
    if (!activeStoreFilter) return items;
    return items.filter((i) => (
      i.completed === 1 ||
      i.storeName === activeStoreFilter ||
      i.locationName === activeStoreFilter
    ));
  }, [activeStoreFilter, items]);

  React.useEffect(() => {
    setEditingListTitle(selectedList?.title ?? '');
  }, [selectedList?.id, selectedList?.title]);

  return (
    <div className="flex h-[calc(100vh-200px)] overflow-hidden rounded-2xl border border-ui bg-white shadow-sm">
      <div className="flex w-64 shrink-0 flex-col border-r border-ui bg-ui-soft">
        <div className="border-b border-ui p-4">
          <h2 className="text-lg font-bold text-ui-primary">Routines</h2>
          <p className="mt-1 text-xs text-ui-muted">Shared checklists and family routines</p>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {routineLists.map((list) => {
            const itemCount = items.filter((i) => i.listId === list.id && !i.completed).length;
            return (
              <button
                key={list.id}
                onClick={() => {
                  setSelectedListId(list.id);
                  setShowListSettings(false);
                }}
                className={cn(
                  "group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all",
                  selectedListId === list.id
                    ? "bg-blue-500 text-white shadow-sm"
                    : "text-ui-secondary hover:bg-white hover:shadow-sm",
                )}
              >
                <div className="min-w-0 flex-1">
                  <span className="truncate">{list.title}</span>
                  {list.locationName && (
                    <span className={cn("mt-1 block text-[10px] font-bold uppercase", selectedListId === list.id ? "text-blue-100" : "text-ui-muted-2")}>
                      {list.locationName}
                    </span>
                  )}
                </div>
                <div className="ml-2 flex shrink-0 items-center gap-1">
                  {itemCount > 0 && (
                    <span className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                      selectedListId === list.id ? "bg-blue-400 text-white" : "bg-ui-soft-3 text-ui-muted",
                    )}>
                      {itemCount}
                    </span>
                  )}
                  {list.isRoutine === 1 && <span className="text-[10px]">Loop</span>}
                </div>
              </button>
            );
          })}
          {routineLists.length === 0 && (
            <p className="py-6 text-center text-xs text-ui-muted-2">No routines yet</p>
          )}
        </div>
        <div className="border-t border-ui p-3">
          <form onSubmit={handleCreateList} className="flex gap-2">
            <input
              value={newListTitle}
              onChange={(e) => setNewListTitle(e.target.value)}
              placeholder="New routine..."
              className="flex-1 rounded-lg border border-ui bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button type="submit" className="rounded-lg bg-blue-500 p-2 text-white transition-colors hover:bg-blue-600">
              <Plus size={14} />
            </button>
          </form>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden bg-white">
        {selectedList ? (
          <>
            <div className="flex shrink-0 items-center justify-between border-b border-ui bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-ui-primary">{selectedList.title}</h3>
                {selectedList.isRoutine === 1 && (
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-700">Mission routine</span>
                )}
                {selectedList.locationName && (
                  <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                    <MapPin size={10} /> {selectedList.locationName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowListSettings((value) => !value)}
                  className={cn(
                    "rounded-lg border p-2 transition-all",
                    showListSettings ? "border-ui-primary bg-ui-primary text-white" : "border-ui bg-white text-ui-muted hover:bg-ui-soft",
                  )}
                >
                  <Settings2 size={16} />
                </button>
                <button
                  onClick={handleCopyItems}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
                    copied ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-ui bg-white text-ui-muted hover:bg-ui-soft",
                  )}
                >
                  {copied ? <ClipboardCheck size={14} /> : <Clipboard size={14} />}
                  {copied ? 'Copied!' : 'Copy items'}
                </button>
              </div>
            </div>

            {showListSettings && (
              <div className="space-y-4 border-b border-ui bg-ui-soft p-4">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-ui-muted">List Name</label>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      value={editingListTitle}
                      onChange={(e) => setEditingListTitle(e.target.value)}
                      placeholder="Rename this routine"
                      className="rounded-xl border border-ui bg-white px-3 py-2 text-sm text-ui-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <button
                      type="button"
                      onClick={() => void handleRenameSelectedList()}
                      disabled={!editingListTitle.trim() || editingListTitle.trim() === selectedList.title}
                      className="rounded-xl border border-ui bg-white px-3 py-2 text-xs font-bold text-ui-primary transition-colors hover:bg-ui-soft disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Save name
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-ui-muted">Tab</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void updateList(selectedList.id, selectedList.title, 'routine', selectedList.isRoutine, selectedList.locationName)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-bold transition-all",
                        selectedList.category === 'routine' ? "border-ui-primary bg-ui-primary text-white shadow-sm" : "border-ui bg-white text-ui-muted",
                      )}
                    >
                      Routines
                    </button>
                    <button
                      onClick={() => void updateList(selectedList.id, selectedList.title, 'shopping', 0, selectedList.locationName)}
                      className="rounded-full border border-ui bg-white px-3 py-1.5 text-xs font-bold text-ui-muted transition-all hover:bg-ui-soft"
                    >
                      Move to Shopping
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-ui-muted">Location Tag</label>
                  <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
                    <button
                      onClick={() => void updateList(selectedList.id, selectedList.title, 'routine', selectedList.isRoutine, undefined)}
                      className={cn(
                        "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition-all",
                        !selectedList.locationName ? "border-ui-primary bg-ui-primary text-white shadow-sm" : "border-ui bg-white text-ui-muted",
                      )}
                    >
                      None
                    </button>
                    {COMMON_LOCATIONS.map((loc) => (
                      <button
                        key={loc.id}
                        onClick={() => void updateList(selectedList.id, selectedList.title, 'routine', selectedList.isRoutine, loc.label)}
                        className={cn(
                          "flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition-all",
                          selectedList.locationName === loc.label ? "border-sky-600 bg-sky-500 text-white shadow-sm" : "border-ui bg-white text-ui-muted",
                        )}
                      >
                        {loc.icon} {loc.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-ui-primary">Daily Routine</span>
                    <span className="text-xs text-ui-muted">Pins this routine into Mission Today.</span>
                  </div>
                  <button
                    onClick={() => void updateList(selectedList.id, selectedList.title, 'routine', selectedList.isRoutine ? 0 : 1, selectedList.locationName)}
                    className={cn(
                      "relative h-6 w-12 rounded-full transition-all",
                      selectedList.isRoutine ? "bg-emerald-500" : "bg-ui-soft-3",
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all",
                      selectedList.isRoutine ? "right-1" : "left-1",
                    )} />
                  </button>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => void handleDeleteList(selectedList.id)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-100"
                  >
                    <Trash2 size={14} /> Delete Routine
                  </button>
                </div>
              </div>
            )}

            <StoreFilterBar items={items} activeStore={activeStoreFilter} onSelectStore={setActiveStoreFilter} />
            <div className="flex-1 overflow-hidden">
              <ListSidebar
                listTitle={selectedList.title}
                items={filteredItems}
                frequentItems={frequentItems}
                availableLists={lists.map((list) => ({ id: list.id, title: list.title, category: list.category }))}
                primaryListId={selectedList.id}
                isOpen={true}
                inline={true}
                onToggleItem={(itemId, completed) => void toggleItem(itemId, completed)}
                onAddItem={handleAddItem}
                onAddItemToLists={(listIds, text, store, location) => void addItemToLists(listIds, text, store, location)}
                onCopyItem={(itemId, listIds) => void copyItemToLists(itemId, listIds)}
                onMoveItem={(itemId, targetListId) => void moveItemToList(itemId, targetListId)}
                onDeleteItem={(itemId) => void deleteItem(itemId)}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-ui-muted-2">
            <div className="text-center">
              <p className="text-lg font-semibold">No routine selected</p>
              <p className="mt-1 text-sm">Create a routine to get started.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
