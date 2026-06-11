import React, { useEffect, useMemo, useState } from 'react';
import { Clipboard, ClipboardCheck, Edit3, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useListsController } from '../../hooks/useListsController';
import { cn } from '../../lib/utils';
import { FrequentItems } from './FrequentItems';
import { StoreFilterBar } from './StoreFilterBar';
import { analyzeQuickListInput } from '../../lib/quickListInput';
import { useQuickItemTemplates } from '../../hooks/useQuickItemTemplates';
import { QuickItemTemplatesPanel } from './QuickItemTemplatesPanel';
import { useHouseholdListPreferences } from '../../hooks/useHouseholdListPreferences';
import { HouseholdTagManager } from '../shared/HouseholdTagManager';
import { SuggestionBar } from '../shared/SuggestionBar';
import { useFamilyData } from '../../contexts/FamilyDataContext';

interface Props {
  parentId: string;
}

export function ShoppingView({ parentId }: Props) {
  const [newListTitle, setNewListTitle] = useState('');
  const [newItemText, setNewItemText] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeStoreFilter, setActiveStoreFilter] = useState<string | null>(null);
  const [extraTargetListIds, setExtraTargetListIds] = useState<string[]>([]);
  const [transferTargets, setTransferTargets] = useState<Record<string, string>>({});
  const [runMode, setRunMode] = useState<'queue' | 'run'>('queue');
  const [editingListTitle, setEditingListTitle] = useState('');
  const {
    shoppingLists,
    shoppingItems,
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
  } = useListsController({ parentId, preferredCategory: 'shopping' });
  const { templates, saveTemplate, removeTemplate, pinTemplate } = useQuickItemTemplates('shopping');
  const {
    locationOptions,
    saveLocationNames,
    saving: savingPreferences,
  } = useHouseholdListPreferences(parentId);

  const { kids } = useFamilyData();

  const shoppingListTitles = useMemo(() => shoppingLists.map(l => l.title), [shoppingLists]);

  // Suggestions that match existing items or frequent items as you type
  const suggestions = useMemo(() => {
    if (!newItemText.trim()) return [];
    const search = newItemText.toLowerCase().trim();
    const matches = new Map<string, string>(); // text -> id
    
    // Check shopping items first (high priority)
    for (const item of shoppingItems) {
      if (item.text.toLowerCase().includes(search) && item.text.toLowerCase() !== search) {
        matches.set(item.text.toLowerCase(), item.text);
      }
    }
    // Check frequent items
    for (const item of frequentItems) {
      if (item.text.toLowerCase().includes(search) && item.text.toLowerCase() !== search) {
        matches.set(item.text.toLowerCase(), item.text);
      }
    }
    
    return Array.from(matches.values()).map(value => ({
      id: `match-${value}`,
      label: value,
      type: 'where' as any, // using 'where' for list items
      value
    })).slice(0, 5);
  }, [newItemText, frequentItems, shoppingItems]);

  useEffect(() => {
    if (!selectedListId && shoppingLists.length > 0) {
      setSelectedListId(shoppingLists[0].id);
    }
  }, [selectedListId, setSelectedListId, shoppingLists]);

  useEffect(() => {
    setExtraTargetListIds((prev) => prev.filter((id) => id !== selectedListId && shoppingLists.some((list) => list.id === id)));
  }, [selectedListId, shoppingLists]);

  const selectedList = useMemo(
    () => shoppingLists.find((list) => list.id === selectedListId) ?? shoppingLists[0] ?? null,
    [selectedListId, shoppingLists],
  );

  useEffect(() => {
    setEditingListTitle(selectedList?.title ?? '');
  }, [selectedList?.id, selectedList?.title]);

  const listTitlesById = useMemo(
    () => new Map(shoppingLists.map((list) => [list.id, list.title])),
    [shoppingLists],
  );

  // Deduplicate items by text across different lists
  const deduplicatedItems = useMemo(() => {
    const groups = new Map<string, typeof shoppingItems>();
    for (const item of shoppingItems) {
      const key = item.text.trim().toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    
    return Array.from(groups.values()).map(group => {
      const first = group[0];
      const allStoreNames = Array.from(new Set(group.map(i => i.storeName).filter((x): x is string => Boolean(x))));
      const allLocationNames = Array.from(new Set(group.map(i => i.locationName).filter((x): x is string => Boolean(x))));
      const allListIds = Array.from(new Set(group.map(i => i.listId)));
      
      return {
        ...first,
        id: group.map(i => i.id).join(','), // virtual id
        originalIds: group.map(i => i.id),
        allListIds,
        allStoreNames,
        allLocationNames,
      };
    });
  }, [shoppingItems]);

  const filteredItems = useMemo(() => {
    if (!activeStoreFilter) return deduplicatedItems;
    return deduplicatedItems.filter((item) => (
      item.allStoreNames.includes(activeStoreFilter) || 
      item.allLocationNames.includes(activeStoreFilter)
    ));
  }, [activeStoreFilter, deduplicatedItems]);

  const quickInputAnalysis = useMemo(
    () => analyzeQuickListInput(newItemText, shoppingLists, selectedListId, {
      storeNames: shoppingListTitles,
      locationNames: locationOptions.map((option) => option.label),
    }),
    [newItemText, shoppingLists, selectedListId, shoppingListTitles, locationOptions],
  );

  const resolvedExtraListIds = useMemo(
    () => Array.from(new Set([...extraTargetListIds, ...quickInputAnalysis.inferredExtraListIds])),
    [extraTargetListIds, quickInputAnalysis.inferredExtraListIds],
  );

  const groupedRunSections = useMemo(() => {
    const groups = new Map<string, typeof filteredItems>();
    for (const item of filteredItems) {
      const keys: string[] = [];
      if (item.allStoreNames.length > 0) keys.push(...item.allStoreNames);
      else if (item.allLocationNames.length > 0) keys.push(...item.allLocationNames);
      else if (item.allListIds.length > 0) keys.push(...item.allListIds.map(id => listTitlesById.get(id) || 'Open queue'));
      else keys.push('Open queue');

      const uniqueKeys = Array.from(new Set(keys));
      for (const key of uniqueKeys) {
        const existing = groups.get(key) ?? [];
        existing.push(item);
        groups.set(key, existing);
      }
    }
    return Array.from(groups.entries());
  }, [filteredItems, listTitlesById]);

  const getTransferOptions = (itemListIds: string[]) => shoppingLists.filter((list) => !itemListIds.includes(list.id));

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    await createList(newListTitle.trim(), 'shopping');
    setNewListTitle('');
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim() || !selectedList) return;
    
    // Check if this item exists in frequent history
    const frequentMatch = frequentItems.find(
      f => f.text.toLowerCase() === quickInputAnalysis.cleanText.toLowerCase()
    );

    // If the user didn't explicitly provide extra lists, but the item has history, use history
    const targetListIds = (resolvedExtraListIds.length === 0 && frequentMatch?.listIds && frequentMatch.listIds.length > 0)
      ? frequentMatch.listIds
      : [selectedList.id, ...resolvedExtraListIds];
    
    const finalStore = quickInputAnalysis.inferredStoreName;
    const finalLocation = quickInputAnalysis.inferredLocationName;
    
    if (targetListIds.length > 1) {
      await addItemToLists(targetListIds, quickInputAnalysis.cleanText, finalStore, finalLocation);
    } else {
      await addItem(quickInputAnalysis.cleanText, finalStore, finalLocation);
    }
    setNewItemText('');
    setExtraTargetListIds([]);
  };

  const handleRenameSelectedList = async () => {
    if (!selectedList || !editingListTitle.trim() || editingListTitle.trim() === selectedList.title) return;
    await updateList(selectedList.id, editingListTitle.trim(), 'shopping', selectedList.isRoutine, selectedList.locationName);
  };

  const handleCopyItems = async () => {
    try {
      const text = filteredItems.map((item) => item.text).join('\n');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this shopping list?')) return;
    await deleteList(listId);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-ui bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-amber-700">
              <ShoppingCart size={12} />
              Shopping
            </div>
            <div>
              <h2 className="text-2xl font-black text-ui-primary">Fast family shopping</h2>
              <p className="text-sm text-ui-muted">One queue for active grocery and supply items, with quick-add suggestions from recent history.</p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={handleCopyItems}
              disabled={filteredItems.length === 0}
              className={cn(
                "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-primary focus-visible:ring-offset-2 sm:min-h-0",
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
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-primary focus-visible:ring-offset-2 sm:min-h-0"
              >
                <Trash2 size={16} />
                Delete list
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <div className="min-w-0 space-y-4 rounded-[1.5rem] border border-ui bg-ui-soft p-4">
            
            <div className="space-y-3">
              {(quickInputAnalysis.inferredExtraListIds.length > 0 || quickInputAnalysis.inferredStoreName || quickInputAnalysis.inferredLocationName) && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-semibold text-sky-800">
                  <span>Quick match:</span>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {quickInputAnalysis.inferredExtraListIds.length > 0 && (
                      <span>lists {shoppingLists.filter((list) => quickInputAnalysis.inferredExtraListIds.includes(list.id)).map((list) => list.title).join(', ')}</span>
                    )}
                    {quickInputAnalysis.inferredStoreName && <span>store {quickInputAnalysis.inferredStoreName}</span>}
                    {quickInputAnalysis.inferredLocationName && <span>location {quickInputAnalysis.inferredLocationName}</span>}
                  </div>
                </div>
              )}

              <SuggestionBar 
                suggestions={suggestions} 
                onSelect={(s) => {
                  setNewItemText(s.value);
                }} 
              />

              <form onSubmit={handleAddItem} className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  placeholder={selectedList ? `Add to ${selectedList.title}, try 'Batteries Target Home'` : 'Create a shopping list first'}
                  disabled={!selectedList}
                  className="flex-1 rounded-2xl border border-ui bg-white px-4 py-3 text-sm text-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary disabled:cursor-not-allowed disabled:bg-ui-soft"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!selectedList || !newItemText.trim()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-ui-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-ui-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-ui-soft-3 disabled:text-ui-muted sm:min-h-0"
                >
                  <Plus size={16} />
                  Add item
                </button>
              </form>
            </div>
            
            <div className="space-y-3">
              <label className="text-[11px] font-black uppercase tracking-[0.18em] text-ui-muted">Primary shopping list</label>
              <div className="grid gap-2 sm:flex sm:flex-wrap">
                {shoppingLists.map((list) => (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => setSelectedListId(list.id)}
                    className={cn(
                      "min-w-0 rounded-2xl border px-3 py-3 text-left text-sm font-bold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-primary focus-visible:ring-offset-2 sm:w-auto sm:rounded-full sm:px-4 sm:py-2 sm:text-center",
                      selectedList?.id === list.id
                        ? "border-ui-primary bg-ui-primary text-white shadow-sm"
                        : "border-ui bg-white text-ui-muted hover:bg-ui-soft-2",
                    )}
                  >
                    <span className="block truncate sm:max-w-[12rem]">{list.title}</span>
                  </button>
                ))}
                {shoppingLists.length === 0 && (
                  <p className="text-sm text-ui-muted">Create a shopping list to start capturing items.</p>
                )}
              </div>
            </div>

            {selectedList && shoppingLists.length > 1 && (
              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase tracking-[0.18em] text-ui-muted">Also add to</label>
                <div className="grid gap-2 sm:flex sm:flex-wrap">
                  {shoppingLists.filter((list) => list.id !== selectedList.id).map((list) => {
                    const isSelected = extraTargetListIds.includes(list.id);
                    return (
                      <button
                        key={list.id}
                        type="button"
                        onClick={() => setExtraTargetListIds((prev) => (
                          prev.includes(list.id)
                            ? prev.filter((id) => id !== list.id)
                            : [...prev, list.id]
                        ))}
                        className={cn(
                          "min-w-0 rounded-2xl border px-3 py-3 text-left text-sm font-bold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-primary focus-visible:ring-offset-2 sm:w-auto sm:rounded-full sm:px-4 sm:py-2 sm:text-center",
                          isSelected
                            ? "border-ui-primary bg-ui-primary text-white shadow-sm"
                            : "border-ui bg-white text-ui-muted hover:bg-ui-soft-2",
                        )}
                      >
                        <span className="block truncate sm:max-w-[12rem]">{list.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <FrequentItems
              items={frequentItems}
              onSelect={(item) => {
                if (!selectedList) return;
                // If the item has historical listIds, use them. 
                // Otherwise fallback to current selection.
                const targetListIds = (item.listIds && item.listIds.length > 0)
                  ? item.listIds
                  : [selectedList.id, ...resolvedExtraListIds];
                
                if (targetListIds.length > 1) {
                  // If multiple lists, we don't pass a single storeName/locationName 
                  // as they are list-specific in this case.
                  void addItemToLists(targetListIds, item.text);
                } else {
                  // For a single list, we can pass the first storeName/location if available
                  void addItem(
                    item.text, 
                    item.storeNames?.[0], 
                    item.locationNames?.[0]
                  );
                }
                setExtraTargetListIds([]);
              }}
            />

            <QuickItemTemplatesPanel
              templates={templates}
              draftText={quickInputAnalysis.cleanText}
              onApply={(text) => {
                if (!selectedList) return;
                const targetListIds = [selectedList.id, ...resolvedExtraListIds];
                if (targetListIds.length > 1) {
                  void addItemToLists(targetListIds, text);
                } else {
                  void addItem(text);
                }
              }}
              onSave={(name, text, pinned) => void saveTemplate(name, text, pinned)}
              onRemove={(id) => void removeTemplate(id)}
              onTogglePin={(id, pinned) => void pinTemplate(id, pinned)}
            />

            {selectedList && (
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  value={editingListTitle}
                  onChange={(e) => setEditingListTitle(e.target.value)}
                  placeholder="Rename selected list"
                  className="rounded-2xl border border-ui bg-white px-4 py-3 text-sm text-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary"
                />
                <button
                  type="button"
                  onClick={() => void handleRenameSelectedList()}
                  disabled={!editingListTitle.trim() || editingListTitle.trim() === selectedList.title}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-ui bg-white px-4 py-3 text-sm font-bold text-ui-primary transition-colors hover:bg-ui-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0"
                >
                  <Edit3 size={14} />
                  Rename
                </button>
              </div>
            )}

            <div className="grid gap-3 lg:grid-cols-2">
              <HouseholdTagManager
                title="Quick locations"
                helperText="Optional tags for where shopping items belong after the run (e.g., Garage, Pantry)."
                values={locationOptions.map((opt) => opt.label)}
                placeholder="Garage"
                addLabel="Add location"
                disabled={savingPreferences}
                onChange={saveLocationNames}
              />
            </div>
          </div>

          <div className="min-w-0 rounded-[1.5rem] border border-ui bg-white p-4">
            <label className="mb-3 block text-[11px] font-black uppercase tracking-[0.18em] text-ui-muted">Create shopping lists</label>
            <form onSubmit={handleCreateList} className="flex flex-col gap-2 sm:flex-row">
              <input
                value={newListTitle}
                onChange={(e) => setNewListTitle(e.target.value)}
                placeholder="Weekend groceries"
                className="flex-1 rounded-xl border border-ui px-3 py-2 text-sm text-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary"
              />
              <button type="submit" className="min-h-11 rounded-xl bg-ui-primary px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-ui-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-primary focus-visible:ring-offset-2 sm:min-h-0">
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
                      "flex min-w-0 w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-primary focus-visible:ring-offset-2",
                      selectedList?.id === list.id
                        ? "border-ui-primary bg-ui-primary text-white shadow-sm"
                        : "border-ui bg-ui-soft hover:bg-white",
                    )}
                  >
                    <span className={cn("min-w-0 truncate font-semibold", selectedList?.id === list.id ? "text-white" : "text-ui-primary")}>{list.title}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-1 text-sm font-bold",
                        selectedList?.id === list.id ? "bg-ui-soft text-ui-primary" : "bg-white text-ui-muted",
                      )}
                    >
                      {pendingCount} open
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-ui bg-white shadow-sm sm:rounded-[2rem]">
        <div className="border-b border-ui px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-ui-primary">Open shopping queue</h3>
              <p className="text-sm text-ui-muted">All active shopping items across every shopping list.</p>
            </div>
            <div className="inline-flex w-full rounded-full border border-ui bg-white p-1 sm:w-auto" role="tablist" aria-label="Shopping queue display mode">
              <button
                type="button"
                onClick={() => setRunMode('queue')}
                role="tab"
                aria-selected={runMode === 'queue'}
                className={cn(
                  "flex-1 rounded-full px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-primary focus-visible:ring-offset-2 sm:flex-none",
                  runMode === 'queue' ? "bg-ui-primary text-white" : "text-ui-muted"
                )}
              >
                Queue
              </button>
              <button
                type="button"
                onClick={() => setRunMode('run')}
                role="tab"
                aria-selected={runMode === 'run'}
                className={cn(
                  "flex-1 rounded-full px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-primary focus-visible:ring-offset-2 sm:flex-none",
                  runMode === 'run' ? "bg-ui-primary text-white" : "text-ui-muted"
                )}
              >
                Run mode
              </button>
            </div>
          </div>
        </div>
        <StoreFilterBar items={shoppingItems} activeStore={activeStoreFilter} onSelectStore={setActiveStoreFilter} />
        <div className="p-4 sm:p-5">
          {filteredItems.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-ui bg-ui-soft px-6 py-12 text-center">
              <p className="text-lg font-semibold text-ui-primary">No shopping items waiting.</p>
              <p className="mt-1 text-sm text-ui-muted">Add an item above or use a frequent add chip.</p>
            </div>
          ) : runMode === 'run' ? (
            <div className="space-y-5">
              {groupedRunSections.map(([groupName, groupItems]) => (
                <section key={groupName} className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h4 className="min-w-0 break-words text-sm font-black uppercase tracking-[0.16em] text-ui-muted">{groupName}</h4>
                    <span className="rounded-full bg-ui-soft px-2 py-1 text-xs font-bold text-ui-muted">{groupItems.length} items</span>
                  </div>
                  <ul className="space-y-3">
                    {groupItems.map((item) => (
                      <li key={`${groupName}-${item.id}`} className="flex items-start gap-3 rounded-2xl border border-ui bg-ui-soft px-4 py-3">
                        <label className="mt-[-0.375rem] ml-[-0.375rem] flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus-within:ring-2 focus-within:ring-ui-primary focus-within:ring-offset-2">
                          <input
                            type="checkbox"
                            checked={item.completed === 1}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              item.originalIds.forEach((id: string) => void toggleItem(id, checked));
                            }}
                            className="h-5 w-5 rounded border-ui text-sky-600 focus:outline-none"
                            aria-label={`Mark ${item.text} complete`}
                          />
                        </label>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-ui-primary">{item.text}</p>
                            <span className="rounded-full bg-white px-2 py-1 text-xs font-black uppercase tracking-wide text-ui-muted">
                              {item.allListIds.map((id: string) => listTitlesById.get(id)).filter(Boolean).join(', ') || 'Shopping'}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <ul className="space-y-3">
              {filteredItems.map((item) => (
                <li key={item.id} className="flex flex-col gap-3 rounded-2xl border border-ui bg-ui-soft px-4 py-3 sm:flex-row sm:items-start">
                  <div className="flex items-start gap-3">
                  <label className="mt-[-0.375rem] ml-[-0.375rem] flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus-within:ring-2 focus-within:ring-ui-primary focus-within:ring-offset-2">
                    <input
                      type="checkbox"
                      checked={item.completed === 1}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        item.originalIds.forEach((id: string) => void toggleItem(id, checked));
                      }}
                      className="h-5 w-5 rounded border-ui text-sky-600 focus:outline-none"
                      aria-label={`Mark ${item.text} complete`}
                    />
                  </label>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ui-primary">{item.text}</p>
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-black uppercase tracking-wide text-ui-muted">
                        {item.allListIds.map((id: string) => listTitlesById.get(id)).filter(Boolean).join(', ') || 'Shopping'}
                      </span>
                      {item.allStoreNames.map((storeName: string) => (
                        <span key={storeName} className="rounded-full bg-blue-100 px-2 py-1 text-xs font-black uppercase tracking-wide text-blue-700">
                          {storeName}
                        </span>
                      ))}
                      {item.allLocationNames.map((locName: string) => (
                        <span key={locName} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black uppercase tracking-wide text-slate-600">
                          {locName}
                        </span>
                      ))}
                    </div>
                    {getTransferOptions(item.allListIds).length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <select
                          value={transferTargets[item.id] ?? getTransferOptions(item.allListIds)[0]?.id ?? ''}
                          onChange={(e) => setTransferTargets((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          className="min-h-11 min-w-0 max-w-full flex-1 rounded-md border border-ui bg-white px-3 py-2 text-xs font-bold text-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary sm:max-w-36 sm:flex-none"
                        >
                          {getTransferOptions(item.allListIds).map((list) => (
                            <option key={list.id} value={list.id}>{list.title}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const target = transferTargets[item.id] ?? getTransferOptions(item.allListIds)[0]?.id;
                            if (target) {
                              item.originalIds.forEach((id: string) => void copyItemToLists(id, [target]));
                            }
                          }}
                          className="min-h-11 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-primary focus-visible:ring-offset-2"
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const target = transferTargets[item.id] ?? getTransferOptions(item.allListIds)[0]?.id;
                            if (target) {
                              item.originalIds.forEach((id: string) => void moveItemToList(id, target));
                            }
                          }}
                          className="min-h-11 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-primary focus-visible:ring-offset-2"
                        >
                          Move
                        </button>
                      </div>
                    )}
                  </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      item.originalIds.forEach((id: string) => void deleteItem(id));
                    }}
                    className="self-end rounded-full p-2 text-ui-muted transition-colors hover:bg-red-50 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-primary focus-visible:ring-offset-2 sm:self-auto"
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
