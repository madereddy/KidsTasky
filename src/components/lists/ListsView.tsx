import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Clipboard, ClipboardCheck, Settings2, MapPin } from 'lucide-react';
import { ListSidebar } from './ListSidebar';
import { StoreFilterBar } from './StoreFilterBar';
import { cn } from '../../lib/utils';
import { useListsController } from '../../hooks/useListsController';
import { COMMON_LOCATIONS } from '../../constants';

interface Props {
  parentId: string;
}

export function ListsView({ parentId }: Props) {
  const [newListTitle, setNewListTitle] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeStoreFilter, setActiveStoreFilter] = useState<string | null>(null);
  const [showListSettings, setShowListSettings] = useState(false);

  const {
    lists,
    items,
    selectedList,
    selectedListId,
    setSelectedListId,
    createList,
    updateList,
    deleteList,
    addItem,
    toggleItem,
    deleteItem,
    frequentItems,
  } = useListsController({ parentId });

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    await createList(newListTitle.trim());
    setNewListTitle('');
  };

  const handleDeleteList = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to delete this list?')) return;
    await deleteList(id);
  };

  const handleAddItem = async (text: string, explicitStore?: string, explicitLocation?: string) => {
    await addItem(text, explicitStore, explicitLocation);
  };

  const handleToggleItem = async (itemId: string, completed: boolean) => {
    await toggleItem(itemId, completed);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to delete this item?')) return;
    await deleteItem(itemId);
  };

  const handleCopyItems = () => {
    const unchecked = items.filter(it => it.completed === 0).map(it => it.text).join('\n');
    navigator.clipboard.writeText(unchecked);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredItems = useMemo(() => {
    if (!activeStoreFilter) return items;
    return items.filter(i => 
      i.completed === 1 || 
      i.storeName === activeStoreFilter || 
      i.locationName === activeStoreFilter
    );
  }, [items, activeStoreFilter]);

  return (
    <div className="flex h-[calc(100vh-200px)] bg-white rounded-2xl border border-ui overflow-hidden shadow-sm">
      <div className="w-64 shrink-0 border-r border-ui flex flex-col bg-ui-soft">
        <div className="p-4 border-b border-ui">
          <h2 className="font-bold text-ui-primary text-lg">My Lists</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {lists.map(list => {
            const itemCount = items.filter(i => i.listId === list.id && !i.completed).length;
            return (
              <button
                key={list.id}
                onClick={() => { setSelectedListId(list.id); setShowListSettings(false); }}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-between group",
                  selectedListId === list.id
                    ? "bg-blue-500 text-white shadow-sm"
                    : "text-ui-secondary hover:bg-white hover:shadow-sm"
                )}
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="truncate">{list.title}</span>
                  {list.locationName && (
                    <span className={cn("text-[8px] font-bold uppercase", selectedListId === list.id ? "text-blue-100" : "text-ui-muted-2")}>
                      📍 {list.locationName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {itemCount > 0 && (
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                      selectedListId === list.id ? "bg-blue-400 text-white" : "bg-ui-soft-3 text-ui-muted"
                    )}>{itemCount}</span>
                  )}
                  {list.isRoutine === 1 && <span className="text-[10px]">🔄</span>}
                </div>
              </button>
            );
          })}
          {lists.length === 0 && (
            <p className="text-xs text-ui-muted-2 text-center py-6">No lists yet</p>
          )}
        </div>
        <div className="p-3 border-t border-ui">
          <form onSubmit={handleCreateList} className="flex gap-2">
            <input
              value={newListTitle}
              onChange={e => setNewListTitle(e.target.value)}
              placeholder="New list…"
              className="flex-1 border border-ui rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            />
            <button type="submit" className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
              <Plus size={14} />
            </button>
          </form>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {selectedList ? (
          <>
            <div className="px-4 py-3 border-b border-ui flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-ui-primary text-lg">{selectedList.title}</h3>
                {selectedList.isRoutine === 1 && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full uppercase">Routine</span>
                )}
                {selectedList.locationName && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full uppercase">
                    <MapPin size={10} /> {selectedList.locationName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowListSettings(!showListSettings)}
                  className={cn(
                    "p-2 rounded-lg border transition-all",
                    showListSettings ? "bg-ui-primary text-white border-ui-primary" : "bg-white text-ui-muted border-ui hover:bg-ui-soft"
                  )}
                >
                  <Settings2 size={16} />
                </button>
                <button
                  onClick={handleCopyItems}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border",
                    copied ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-white text-ui-muted border-ui hover:bg-ui-soft"
                  )}
                >
                  {copied ? <ClipboardCheck size={14} /> : <Clipboard size={14} />}
                  {copied ? "Copied!" : "Copy items"}
                </button>
              </div>
            </div>

            {showListSettings && (
              <div className="p-4 bg-ui-soft border-b border-ui space-y-4">
                <div>
                  <label className="block text-xs font-bold text-ui-muted uppercase mb-2">Location Tag</label>
                  <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                    <button
                      onClick={() => updateList(selectedList.id, selectedList.title, undefined, selectedList.isRoutine)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap",
                        !selectedList.locationName ? "bg-ui-primary text-white border-ui-primary shadow-sm" : "bg-white text-ui-muted border-ui"
                      )}
                    >
                      None
                    </button>
                    {COMMON_LOCATIONS.map(loc => (
                      <button
                        key={loc.id}
                        onClick={() => updateList(selectedList.id, selectedList.title, loc.label, selectedList.isRoutine)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1 whitespace-nowrap",
                          selectedList.locationName === loc.label ? "bg-sky-500 text-white border-sky-600 shadow-sm" : "bg-white text-ui-muted border-ui"
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
                    <span className="text-xs text-ui-muted">Pins to "Mission Today" view</span>
                  </div>
                  <button
                    onClick={() => updateList(selectedList.id, selectedList.title, selectedList.locationName, selectedList.isRoutine ? 0 : 1)}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      selectedList.isRoutine ? "bg-emerald-500" : "bg-ui-soft-3"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm",
                      selectedList.isRoutine ? "right-1" : "left-1"
                    )} />
                  </button>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => handleDeleteList(selectedList.id)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-bold hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={14} /> Delete List
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
                isOpen={true}
                inline={true}
                onToggleItem={handleToggleItem}
                onAddItem={handleAddItem}
                onDeleteItem={handleDeleteItem}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-ui-muted-2">
            <div className="text-center">
              <p className="text-lg font-semibold">No list selected</p>
              <p className="text-sm mt-1">Create a list to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
