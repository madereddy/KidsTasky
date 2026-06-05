// src/components/lists/ListSidebar.tsx
import React, { useMemo, useState } from 'react';
import { X, Plus, Trash2, MapPin } from 'lucide-react';
import { AppList, AppListItem } from '../../types';
import { cn } from '../../lib/utils';
import { getDefaultLocationOptions, getDefaultStoreNames, HouseholdLocationOption } from '../../lib/householdListPreferences';
import { analyzeQuickListInput } from '../../lib/quickListInput';
import { useQuickItemTemplates } from '../../hooks/useQuickItemTemplates';
import { QuickItemTemplatesPanel } from './QuickItemTemplatesPanel';
import { ProofTemplateKind } from '../../services/proofTemplates';

interface Props {
  listTitle: string;
  items: AppListItem[];
  frequentItems?: { text: string; storeName?: string; locationName?: string }[];
  availableLists?: Pick<AppList, 'id' | 'title' | 'category'>[];
  primaryListId?: string;
  isOpen: boolean;
  onToggleItem: (id: string, isCompleted: boolean) => void;
  onClose?: () => void;
  onAddItem?: (text: string, store?: string, location?: string) => void;
  onAddItemToLists?: (listIds: string[], text: string, store?: string, location?: string) => void;
  onCopyItem?: (itemId: string, listIds: string[]) => void;
  onMoveItem?: (itemId: string, targetListId: string) => void;
  onDeleteItem?: (id: string) => void;
  onDeleteList?: () => void;
  inline?: boolean;
  templateKind?: ProofTemplateKind;
  storeNames?: string[];
  locationOptions?: HouseholdLocationOption[];
  hideShoppingElements?: boolean;
}

export function ListSidebar({
  listTitle,
  items,
  frequentItems,
  availableLists = [],
  primaryListId,
  isOpen,
  onToggleItem,
  onClose,
  onAddItem,
  onAddItemToLists,
  onCopyItem,
  onMoveItem,
  onDeleteItem,
  onDeleteList,
  inline,
  templateKind = 'routine',
  storeNames = getDefaultStoreNames(),
  locationOptions = getDefaultLocationOptions(),
  hideShoppingElements = false,
}: Props) {
  const [newItemText, setNewItemText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedStoreChip, setSelectedStoreChip] = useState<string | null>(null);
  const [selectedLocationChip, setSelectedLocationChip] = useState<string | null>(null);
  const [extraTargetListIds, setExtraTargetListIds] = useState<string[]>([]);
  const [transferTargets, setTransferTargets] = useState<Record<string, string>>({});
  const { templates, saveTemplate, removeTemplate, pinTemplate } = useQuickItemTemplates(templateKind);

  if (!isOpen) return null;

  const containerClass = inline
    ? 'flex flex-col h-full'
    : 'fixed inset-y-0 right-0 w-80 bg-white shadow-2xl border-l z-40 transform transition-transform duration-300 flex flex-col';

  const quickInputAnalysis = useMemo(
    () => analyzeQuickListInput(newItemText, availableLists as AppList[], primaryListId, {
      storeNames,
      locationNames: locationOptions.map((option) => option.label),
    }),
    [newItemText, availableLists, primaryListId, storeNames, locationOptions],
  );

  const suggestions = useMemo(() => {
    if (!newItemText.trim() || !frequentItems) return [];
    const search = quickInputAnalysis.cleanText.toLowerCase();
    return frequentItems.filter((item) =>
      item.text.toLowerCase().includes(search) &&
      item.text.toLowerCase() !== search
    ).slice(0, 5);
  }, [newItemText, frequentItems, quickInputAnalysis.cleanText]);

  const secondaryLists = useMemo(
    () => availableLists.filter((list) => list.id !== primaryListId),
    [availableLists, primaryListId],
  );

  const resolvedExtraListIds = useMemo(() => {
    const listNamesAsLocations = new Set(
      quickInputAnalysis.inferredLocationNames.map((n) => n.toLowerCase())
    );
    const matchedListIdsFromLocations = availableLists
      .filter((list) => listNamesAsLocations.has(list.title.toLowerCase()))
      .map((list) => list.id);

    return Array.from(
      new Set([
        ...extraTargetListIds,
        ...quickInputAnalysis.inferredExtraListIds,
        ...matchedListIdsFromLocations,
      ])
    ).filter((id) => id !== primaryListId);
  }, [
    extraTargetListIds,
    quickInputAnalysis.inferredExtraListIds,
    quickInputAnalysis.inferredLocationNames,
    availableLists,
    primaryListId,
  ]);

  const getTransferOptions = (itemListId?: string) => (
    availableLists.filter((list) => list.id !== (itemListId ?? primaryListId))
  );

  const submitFrequentItem = (item: { text: string; storeName?: string; locationName?: string }) => {
    const targetListIds = primaryListId
      ? [primaryListId, ...resolvedExtraListIds]
      : resolvedExtraListIds;

    if (onAddItemToLists && targetListIds.length > 1) {
      onAddItemToLists(targetListIds, item.text, item.storeName, item.locationName);
    } else if (onAddItem) {
      onAddItem(item.text, item.storeName, item.locationName);
    }

    setNewItemText('');
    setExtraTargetListIds([]);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInputAnalysis.cleanText.trim() || (!onAddItem && !onAddItemToLists)) return;
    const targetListIds = primaryListId
      ? [primaryListId, ...resolvedExtraListIds]
      : resolvedExtraListIds;
    
    const inferredStore = quickInputAnalysis.inferredStoreNames[quickInputAnalysis.inferredStoreNames.length - 1];
    const inferredLocation = quickInputAnalysis.inferredLocationNames[quickInputAnalysis.inferredLocationNames.length - 1];
    
    const finalStore = selectedStoreChip || inferredStore;
    const finalLocation = selectedLocationChip || inferredLocation;

    if (onAddItemToLists && targetListIds.length > 1) {
      onAddItemToLists(targetListIds, quickInputAnalysis.cleanText, finalStore || undefined, finalLocation || undefined);
    } else if (onAddItem) {
      onAddItem(quickInputAnalysis.cleanText, finalStore || undefined, finalLocation || undefined);
    }
    setNewItemText('');
    setSelectedStoreChip(null);
    setSelectedLocationChip(null);
    setExtraTargetListIds([]);
  };

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
            {items.map((item) => (
              <li key={item.id} className="rounded-xl border border-ui bg-white px-3 py-2">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={item.completed === 1}
                    onChange={(e) => onToggleItem(item.id, e.target.checked)}
                    className="w-5 h-5 rounded border-ui text-blue-600 focus:ring-blue-500 shrink-0"
                  />
                  <span className={cn('text-sm font-medium break-words flex-1', item.completed === 1 ? 'text-ui-muted line-through' : 'text-ui-primary')}>
                    {item.text}
                  </span>
                  {onDeleteItem && (
                    <button onClick={() => onDeleteItem(item.id)} className="text-ui-muted-2 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {item.locationName && item.completed !== 1 && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold uppercase rounded border border-slate-200">
                      <MapPin size={8} /> {item.locationName}
                    </span>
                  )}
                  {item.storeName && !item.locationName && item.completed !== 1 && (
                    <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold uppercase rounded-sm border border-blue-200">
                      {item.storeName}
                    </span>
                  )}
                  {(onCopyItem || onMoveItem) && getTransferOptions(item.listId).length > 0 && (
                    <>
                      <select
                        value={transferTargets[item.id] ?? getTransferOptions(item.listId)[0]?.id ?? ''}
                        onChange={(e) => setTransferTargets((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        className="max-w-28 rounded-md border border-ui bg-white px-2 py-1 text-[10px] font-bold text-ui-primary"
                      >
                        {getTransferOptions(item.listId).map((list) => (
                          <option key={list.id} value={list.id}>{list.title}</option>
                        ))}
                      </select>
                      {onCopyItem && (
                        <button
                          type="button"
                          onClick={() => {
                            const target = transferTargets[item.id] ?? getTransferOptions(item.listId)[0]?.id;
                            if (target) onCopyItem(item.id, [target]);
                          }}
                          className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                        >
                          Copy
                        </button>
                      )}
                      {onMoveItem && (
                        <button
                          type="button"
                          onClick={() => {
                            const target = transferTargets[item.id] ?? getTransferOptions(item.listId)[0]?.id;
                            if (target) onMoveItem(item.id, target);
                          }}
                          className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-700 transition-colors hover:bg-sky-100"
                        >
                          Move
                        </button>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {onAddItem && (
        <div className="p-3 border-t border-ui bg-white flex flex-col gap-2 shrink-0">
          <QuickItemTemplatesPanel
            templates={templates}
            draftText={quickInputAnalysis.cleanText}
            onApply={(text) => submitFrequentItem({ text })}
            onSave={(name, text, pinned) => void saveTemplate(name, text, pinned)}
            onRemove={(id) => void removeTemplate(id)}
            onTogglePin={(id, pinned) => void pinTemplate(id, pinned)}
          />

          {secondaryLists.length > 0 && (
            <div className="space-y-1">
              <div className="px-1 text-[10px] font-black uppercase tracking-wider text-ui-muted">Also add to</div>
              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                {secondaryLists.map((list) => {
                  const manualSelected = extraTargetListIds.includes(list.id);
                  const inferredSelected = quickInputAnalysis.inferredExtraListIds.includes(list.id);
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
                        'px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border',
                        manualSelected || inferredSelected
                          ? 'border-sky-300 bg-sky-50 text-sky-700'
                          : 'border-ui bg-ui-soft text-ui-muted hover:bg-ui-soft-2',
                      )}
                    >
                      {list.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(quickInputAnalysis.inferredExtraListIds.length > 0 || 
            quickInputAnalysis.inferredStoreNames.length > 0 || 
            quickInputAnalysis.inferredLocationNames.length > 0) && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-semibold text-sky-800">
              <span>Quick match:</span>
              {quickInputAnalysis.inferredExtraListIds.length > 0 && (
                <span className="ml-2">lists {availableLists.filter((list) => quickInputAnalysis.inferredExtraListIds.includes(list.id)).map((list) => list.title).join(', ')}</span>
              )}
              {quickInputAnalysis.inferredStoreNames.length > 0 && (
                <span className="ml-2">stores {quickInputAnalysis.inferredStoreNames.join(', ')}</span>
              )}
              {quickInputAnalysis.inferredLocationNames.length > 0 && (
                <span className="ml-2">locations {quickInputAnalysis.inferredLocationNames.join(', ')}</span>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            {!hideShoppingElements && (
              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                {storeNames.map((store) => (
                  <button
                    key={store}
                    type="button"
                    onClick={() => {
                      setSelectedStoreChip((prev) => prev === store ? null : store);
                      setSelectedLocationChip(null);
                    }}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-[10px] font-bold whitespace-nowrap transition-all border flex items-center gap-1',
                      selectedStoreChip === store ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-ui-soft text-ui-muted border-transparent hover:bg-ui-soft-2',
                    )}
                  >
                    Store {store}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
              {locationOptions.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => {
                    setSelectedLocationChip((prev) => prev === loc.label ? null : loc.label);
                    setSelectedStoreChip(null);
                  }}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[10px] font-bold whitespace-nowrap transition-all border flex items-center gap-1',
                    selectedLocationChip === loc.label ? 'bg-sky-100 text-sky-800 border-sky-300' : 'bg-ui-soft text-ui-muted border-transparent hover:bg-ui-soft-2',
                  )}
                >
                  {loc.label}
                </button>
              ))}
            </div>
          </div>

          {suggestions.length > 0 && (
            <div className="bg-ui-soft rounded-lg border border-ui overflow-hidden mb-1">
              {suggestions.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => submitFrequentItem(item)}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-ui-primary hover:bg-white border-b border-ui last:border-0 flex items-center justify-between group"
                >
                  <span>{item.text}</span>
                  <span className="text-[10px] text-ui-muted group-hover:text-blue-500">Quick Add +</span>
                </button>
              ))}
            </div>
          )}

          {!hideShoppingElements && frequentItems && frequentItems.length > 0 && !newItemText && (
            <div className="space-y-1.5 mb-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black uppercase text-ui-muted tracking-wider">Frequent Items</span>
              </div>
              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                {frequentItems.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => submitFrequentItem(item)}
                    className="px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-all shadow-sm"
                  >
                    + {item.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleAddItem} className="flex gap-2">
            <input
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="Add item, try 'Water Bottle Soccer Home'"
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
