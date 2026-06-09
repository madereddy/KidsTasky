import { useCallback, useEffect, useMemo, useState } from 'react';
import { removeEntityById, upsertEntityById } from '../lib/entity-list';
import { extractHouseholdTagFromText, getDefaultLocationOptions, getDefaultStoreNames } from '../lib/householdListPreferences';
import { listsClientService } from '../services/lists';
import { HttpError } from '../services/http';
import { AppList, AppListItem } from '../types';
import { useSocketStaleData } from './useSocket';

function parseListMetadata(list: AppList): AppList {
  const match = list.title.match(/(.*?)\s*\|META:(.+?)\|$/);
  if (match) {
    try {
      const meta = JSON.parse(match[2]);
      return {
        ...list,
        title: match[1].trim(),
        locationName: meta.locationName,
        isRoutine: meta.isRoutine
      };
    } catch (e) {
      return list;
    }
  }
  return list;
}

function stringifyListMetadata(title: string, locationName?: string, isRoutine?: number): string {
  if (!locationName && !isRoutine) return title;
  return `${title} |META:${JSON.stringify({ locationName, isRoutine })}|`;
}

function parseItemMetadata(item: AppListItem): AppListItem {
  const match = item.text.match(/(.*?)\s*\|META:(.+?)\|$/);
  if (match) {
    try {
      const meta = JSON.parse(match[2]);
      return {
        ...item,
        text: match[1].trim(),
        storeName: meta.storeName,
        locationName: meta.locationName,
        completedAt: meta.completedAt
      };
    } catch (e) {
      return item;
    }
  }
  return item;
}

function stringifyItemMetadata(text: string, storeName?: string, completedAt?: number, locationName?: string): string {
  if (!storeName && !completedAt && !locationName) return text;
  return `${text} |META:${JSON.stringify({ storeName, completedAt, locationName })}|`;
}

const defaultStoreNames = getDefaultStoreNames();
const defaultLocationNames = getDefaultLocationOptions().map((option) => option.label);

const isQueuedNetworkError = (error: unknown) => error instanceof HttpError && error.status === 0;

function makeQueuedId(prefix: string) {
  return `${prefix}-queued-${crypto.randomUUID()}`;
}

interface UseListsControllerOptions {
  parentId: string;
  preferredCategory?: 'shopping' | 'routine';
}

function chooseInitialListId(
  nextLists: AppList[],
  currentId: string | null,
  preferredCategory?: 'shopping' | 'routine',
) {
  if (nextLists.length === 0) return null;

  const current = currentId ? nextLists.find((list) => list.id === currentId) : null;
  if (current && (!preferredCategory || current.category === preferredCategory)) {
    return current.id;
  }

  if (preferredCategory) {
    return nextLists.find((list) => list.category === preferredCategory)?.id ?? null;
  }

  return nextLists[0].id;
}

export function useListsController({ parentId, preferredCategory }: UseListsControllerOptions) {
  const [lists, setLists] = useState<AppList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [items, setItems] = useState<AppListItem[]>([]);
  const [globalHistory, setGlobalHistory] = useState<AppListItem[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);

  const loadLists = useCallback(async () => {
    if (!parentId) {
      setLists([]);
      setSelectedListId(null);
      setItems([]);
      setGlobalHistory([]);
      setLoadingLists(false);
      return;
    }

    setLoadingLists(true);
    try {
      const [nextLists, nextGlobal] = await Promise.all([
        listsClientService.getLists(parentId),
        listsClientService.getParentItems(parentId)
      ]);
      setLists((nextLists || []).map(parseListMetadata));
      setGlobalHistory((nextGlobal || []).map(parseItemMetadata));
      setSelectedListId((currentId) => {
        return chooseInitialListId(nextLists, currentId, preferredCategory);
      });
    } finally {
      setLoadingLists(false);
    }
  }, [parentId, preferredCategory]);

  const loadItems = useCallback(async (listId: string | null = selectedListId) => {
    if (!listId) {
      setItems([]);
      return;
    }

    setLoadingItems(true);
    try {
      const nextItems = await listsClientService.getItems(listId);
      setItems((nextItems || []).map(parseItemMetadata));
    } finally {
      setLoadingItems(false);
    }
  }, [selectedListId]);

  const refreshGlobalHistory = useCallback(async () => {
    if (!parentId) return;
    const nextGlobal = await listsClientService.getParentItems(parentId);
    setGlobalHistory((nextGlobal || []).map(parseItemMetadata));
  }, [parentId]);

  const refreshSelectedListItems = useCallback(async () => {
    if (!selectedListId) {
      setItems([]);
      return;
    }
    const nextItems = await listsClientService.getItems(selectedListId);
    setItems((nextItems || []).map(parseItemMetadata));
  }, [selectedListId]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useSocketStaleData(['lists', 'list_items', 'list-items'], () => {
    void Promise.all([loadLists(), loadItems()]);
  });

  useEffect(() => {
    const handleOfflineSync = () => {
      void Promise.all([loadLists(), loadItems()]);
    };
    window.addEventListener('kidtasker:offline-sync-complete', handleOfflineSync);
    return () => window.removeEventListener('kidtasker:offline-sync-complete', handleOfflineSync);
  }, [loadLists, loadItems]);

  const createList = async (
    title: string,
    category: 'shopping' | 'routine' = preferredCategory ?? 'shopping',
    isRoutine?: number,
    locationName?: string,
  ) => {
    const rawTitle = stringifyListMetadata(title, locationName, isRoutine);
    let parsed: AppList;
    try {
      parsed = parseListMetadata(await listsClientService.createList(rawTitle, category, isRoutine, locationName));
    } catch (error) {
      if (!isQueuedNetworkError(error)) throw error;
      parsed = {
        id: makeQueuedId('list'),
        parentId,
        title,
        category,
        isRoutine: isRoutine ?? 0,
        locationName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    setLists((prev) => [...prev, parsed]);
    setSelectedListId(parsed.id);
    setItems([]);
    return parsed;
  };

  const updateList = async (
    id: string,
    title: string,
    category: 'shopping' | 'routine' = preferredCategory ?? 'shopping',
    isRoutine?: number,
    locationName?: string,
  ) => {
    const rawTitle = stringifyListMetadata(title, locationName, isRoutine);
    const updated = await listsClientService.updateList(id, rawTitle, category, isRoutine, locationName);
    const parsed = parseListMetadata(updated);
    setLists((prev) => {
      const nextLists = prev.map((list) => list.id === id ? parsed : list);
      setSelectedListId((currentId) => {
        if (currentId !== id) return currentId;
        return chooseInitialListId(nextLists, currentId, preferredCategory);
      });
      return nextLists;
    });
    return parsed;
  };

  const deleteList = async (id: string) => {
    await listsClientService.deleteList(id);
    setLists((prev) => {
      const remaining = removeEntityById(prev, id);
      setSelectedListId((currentId) => {
        if (currentId !== id) return currentId;
        return chooseInitialListId(remaining, null, preferredCategory);
      });
      return remaining;
    });
    if (selectedListId === id) {
      setItems([]);
    }
    void refreshGlobalHistory();
  };

  const addItem = async (text: string, explicitStore?: string, explicitLocation?: string) => {
    if (!selectedListId) return null;

    const list = lists.find(l => l.id === selectedListId);
    const { cleanText, storeName: parsedStore, locationName: parsedLocation } = extractHouseholdTagFromText(
      text,
      defaultStoreNames,
      defaultLocationNames,
    );
    
    // If no explicit store is provided via @ tag or param, use the list title as the default storeName
    const finalStore = explicitStore || parsedStore || list?.title;
    const finalLocation = explicitLocation || parsedLocation;

    const rawText = stringifyItemMetadata(cleanText, finalStore, undefined, finalLocation);
    let parsedCreated: AppListItem;
    try {
      parsedCreated = parseItemMetadata(await listsClientService.addItem(selectedListId, rawText));
    } catch (error) {
      if (!isQueuedNetworkError(error)) throw error;
      parsedCreated = {
        id: makeQueuedId('item'),
        listId: selectedListId,
        text: cleanText,
        completed: 0,
        storeName: finalStore,
        locationName: finalLocation,
      };
    }
    setItems((prev) => [...prev, parsedCreated]);
    void refreshGlobalHistory();
    return parsedCreated;
  };

  const addItemToLists = async (
    listIds: string[],
    text: string,
    explicitStore?: string,
    explicitLocation?: string,
  ) => {
    const uniqueListIds = Array.from(new Set(listIds.filter(Boolean)));
    if (uniqueListIds.length === 0) return [];

    const { cleanText, storeName: parsedStore, locationName: parsedLocation } = extractHouseholdTagFromText(
      text,
      defaultStoreNames,
      defaultLocationNames,
    );
    
    // Note: When adding to multiple lists, the storeName for each instance 
    // is best handled by the server or individual add calls if we want list-specific defaults.
    // However, for this bulk API, we'll use the parsedStore or explicitStore.
    const finalStore = explicitStore || parsedStore;
    const finalLocation = explicitLocation || parsedLocation;

    const rawText = stringifyItemMetadata(cleanText, finalStore, undefined, finalLocation);
    let parsedCreated: AppListItem[];
    try {
      parsedCreated = (await listsClientService.addItemsToLists(uniqueListIds, rawText)).map(parseItemMetadata);
    } catch (error) {
      if (!isQueuedNetworkError(error)) throw error;
      parsedCreated = uniqueListIds.map((listId) => ({
        id: makeQueuedId('item'),
        listId,
        text: cleanText,
        completed: 0,
        storeName: finalStore,
        locationName: finalLocation,
      }));
    }

    setItems((prev) => {
      const selectedCreations = parsedCreated.filter((item) => item.listId === selectedListId);
      return selectedCreations.length > 0 ? [...prev, ...selectedCreations] : prev;
    });
    void refreshGlobalHistory();
    return parsedCreated;
  };

  const toggleItem = async (itemId: string, completed: boolean) => {
    const item = items.find(i => i.id === itemId) ?? globalHistory.find(i => i.id === itemId);
    if (!item) return;

    const completedAt = completed ? Date.now() : undefined;
    const displayText = item.text.replace(/\s*\|META:.*?\|$/, '');
    const serializedText = stringifyItemMetadata(
      displayText,
      item.storeName,
      completedAt,
      item.locationName
    );

    try {
      await listsClientService.toggleItem(itemId, completed, serializedText);
    } catch (error) {
      if (!isQueuedNetworkError(error)) throw error;
    }
    setItems((prev) => prev.map((i) => (
      i.id === itemId
        ? {
            ...i,
            completed: completed ? 1 : 0,
            completedAt,
            text: displayText,
          }
        : i
    )));
    setGlobalHistory((prev) => prev.map((i) => (
      i.id === itemId
        ? {
            ...i,
            completed: completed ? 1 : 0,
            completedAt,
            text: displayText,
          }
        : i
    )));
    void refreshGlobalHistory();
  };

  const deleteItem = async (itemId: string) => {
    try {
      await listsClientService.deleteItem(itemId);
    } catch (error) {
      if (!isQueuedNetworkError(error)) throw error;
    }
    setItems((prev) => removeEntityById(prev, itemId));
    setGlobalHistory((prev) => removeEntityById(prev, itemId));
    void refreshGlobalHistory();
  };

  const copyItemToLists = async (itemId: string, listIds: string[]) => {
    const uniqueListIds = Array.from(new Set(listIds.filter(Boolean)));
    if (uniqueListIds.length === 0) return [];
    const created = await listsClientService.copyItemToLists(itemId, uniqueListIds);
    const parsedCreated = created.map(parseItemMetadata);
    await Promise.all([refreshSelectedListItems(), refreshGlobalHistory()]);
    return parsedCreated;
  };

  const moveItemToList = async (itemId: string, targetListId: string) => {
    const moved = await listsClientService.moveItemToList(itemId, targetListId);
    const parsedMoved = parseItemMetadata(moved);
    await Promise.all([refreshSelectedListItems(), refreshGlobalHistory()]);
    return parsedMoved;
  };

  const frequentItems = useMemo(() => {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const activeTexts = new Set(
      items.filter(i => i.completed === 0).map(i => i.text.toLowerCase())
    );

    const counts = new Map<string, { count: number, storeName?: string, locationName?: string, text: string }>();

    globalHistory.forEach(item => {
      if (item.completed === 1 && item.completedAt && (now - item.completedAt) <= THIRTY_DAYS_MS) {
        const textKey = item.text.toLowerCase();
        if (!activeTexts.has(textKey)) {
          const existing = counts.get(textKey);
          if (existing) {
            existing.count += 1;
            if (!existing.storeName && item.storeName) {
              existing.storeName = item.storeName;
            }
            if (!existing.locationName && item.locationName) {
              existing.locationName = item.locationName;
            }
          } else {
            counts.set(textKey, { count: 1, storeName: item.storeName, locationName: item.locationName, text: item.text });
          }
        }
      }
    });

    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .map(entry => ({ text: entry.text, storeName: entry.storeName, locationName: entry.locationName }));
  }, [items, globalHistory]);

  const selectedList = useMemo(
    () => lists.find((list) => list.id === selectedListId) ?? null,
    [lists, selectedListId],
  );

  const shoppingLists = useMemo(() => lists.filter(l => l.category === 'shopping'), [lists]);
  const routineLists = useMemo(() => lists.filter(l => l.category === 'routine'), [lists]);

  const shoppingItems = useMemo(() => {
    const shoppingListIds = new Set(shoppingLists.map(l => l.id));
    return globalHistory.filter(item => shoppingListIds.has(item.listId) && item.completed === 0);
  }, [globalHistory, shoppingLists]);

  const updateSelectedList = useCallback((listId: string) => {
    setSelectedListId(listId);
  }, []);

  return {
    lists,
    routineLists,
    shoppingLists,
    shoppingItems,
    items,
    selectedList,
    selectedListId,
    loadingLists,
    loadingItems,
    loadLists,
    loadItems,
    setSelectedListId: updateSelectedList,
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
    setLists,
    setItems,
  };
}
