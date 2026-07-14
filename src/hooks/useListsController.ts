import { useCallback, useEffect, useMemo, useState } from 'react';
import { removeEntityById, upsertEntityById } from '../lib/entity-list';
import { extractHouseholdTagFromText, getDefaultLocationOptions, getDefaultStoreNames } from '../lib/householdListPreferences';
import { listsClientService } from '../services/lists';
import { HttpError } from '../services/http';
import { AppList, AppListItem } from '../types';
import { useSocketStaleData } from './useSocket';

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
      setLists(nextLists || []);
      setGlobalHistory(nextGlobal || []);
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
      setItems(nextItems || []);
    } finally {
      setLoadingItems(false);
    }
  }, [selectedListId]);

  const refreshGlobalHistory = useCallback(async () => {
    if (!parentId) return;
    const nextGlobal = await listsClientService.getParentItems(parentId);
    setGlobalHistory(nextGlobal || []);
  }, [parentId]);

  const refreshSelectedListItems = useCallback(async () => {
    if (!selectedListId) {
      setItems([]);
      return;
    }
    const nextItems = await listsClientService.getItems(selectedListId);
    setItems(nextItems || []);
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
    let created: AppList;
    try {
      created = await listsClientService.createList(title, category, isRoutine, locationName);
    } catch (error) {
      if (!isQueuedNetworkError(error)) throw error;
      created = {
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
    setLists((prev) => [...prev, created]);
    setSelectedListId(created.id);
    setItems([]);
    return created;
  };

  const updateList = async (
    id: string,
    title: string,
    category: 'shopping' | 'routine' = preferredCategory ?? 'shopping',
    isRoutine?: number,
    locationName?: string,
  ) => {
    const updated = await listsClientService.updateList(id, title, category, isRoutine, locationName);
    setLists((prev) => {
      const nextLists = prev.map((list) => list.id === id ? updated : list);
      setSelectedListId((currentId) => {
        if (currentId !== id) return currentId;
        return chooseInitialListId(nextLists, currentId, preferredCategory);
      });
      return nextLists;
    });
    return updated;
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
    
    const finalStore = explicitStore || parsedStore || list?.title;
    const finalLocation = explicitLocation || parsedLocation;

    let created: AppListItem;
    try {
      created = await listsClientService.addItem(selectedListId, cleanText, finalStore, finalLocation);
    } catch (error) {
      if (!isQueuedNetworkError(error)) throw error;
      created = {
        id: makeQueuedId('item'),
        listId: selectedListId,
        text: cleanText,
        completed: 0,
        storeName: finalStore,
        locationName: finalLocation,
      };
    }
    setItems((prev) => [...prev, created]);
    void refreshGlobalHistory();
    return created;
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
    
    const finalStore = explicitStore || parsedStore;
    const finalLocation = explicitLocation || parsedLocation;

    let createdItems: AppListItem[];
    try {
      createdItems = await listsClientService.addItemsToLists(uniqueListIds, cleanText, finalStore, finalLocation);
    } catch (error) {
      if (!isQueuedNetworkError(error)) throw error;
      createdItems = uniqueListIds.map((listId) => ({
        id: makeQueuedId('item'),
        listId,
        text: cleanText,
        completed: 0,
        storeName: finalStore,
        locationName: finalLocation,
      }));
    }

    setItems((prev) => {
      const selectedCreations = createdItems.filter((item) => item.listId === selectedListId);
      return selectedCreations.length > 0 ? [...prev, ...selectedCreations] : prev;
    });
    void refreshGlobalHistory();
    return createdItems;
  };

  const toggleItem = async (itemId: string, completed: boolean) => {
    const item = items.find(i => i.id === itemId) ?? globalHistory.find(i => i.id === itemId);
    if (!item) return;

    try {
      await listsClientService.toggleItem(itemId, completed, item.text, item.storeName, item.locationName);
    } catch (error) {
      if (!isQueuedNetworkError(error)) throw error;
    }
    const completedAt = completed ? Date.now() : undefined;
    setItems((prev) => prev.map((i) => (
      i.id === itemId
        ? {
            ...i,
            completed: completed ? 1 : 0,
            completedAt,
          }
        : i
    )));
    setGlobalHistory((prev) => prev.map((i) => (
      i.id === itemId
        ? {
            ...i,
            completed: completed ? 1 : 0,
            completedAt,
          }
        : i
    )));
  };

  const deleteItem = async (itemId: string) => {
    try {
      await listsClientService.deleteItem(itemId);
    } catch (error) {
      if (!isQueuedNetworkError(error)) throw error;
    }
    setItems((prev) => removeEntityById(prev, itemId));
    setGlobalHistory((prev) => removeEntityById(prev, itemId));
  };

  const copyItemToLists = async (itemId: string, listIds: string[]) => {
    const uniqueListIds = Array.from(new Set(listIds.filter(Boolean)));
    if (uniqueListIds.length === 0) return [];
    const created = await listsClientService.copyItemToLists(itemId, uniqueListIds);
    await Promise.all([refreshSelectedListItems(), refreshGlobalHistory()]);
    return created;
  };

  const moveItemToList = async (itemId: string, targetListId: string) => {
    const moved = await listsClientService.moveItemToList(itemId, targetListId);
    await Promise.all([refreshSelectedListItems(), refreshGlobalHistory()]);
    return moved;
  };

  const listCategoryById = useMemo(
    () => new Map(lists.map((list) => [list.id, list.category])),
    [lists],
  );

  const categoryScopedHistory = useMemo(() => {
    if (!preferredCategory) return globalHistory;
    return globalHistory.filter((item) => listCategoryById.get(item.listId) === preferredCategory);
  }, [globalHistory, listCategoryById, preferredCategory]);

  const frequentItems = useMemo(() => {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const activeTexts = new Set(
      categoryScopedHistory
        .filter((item) => item.completed === 0)
        .map((item) => item.text.toLowerCase())
    );

    const counts = new Map<string, { 
      count: number, 
      text: string,
      listIds: Set<string>,
      storeNames: Set<string>,
      locationNames: Set<string>
    }>();

    categoryScopedHistory.forEach(item => {
      if (item.completed === 1 && item.completedAt && (now - item.completedAt) <= THIRTY_DAYS_MS) {
        const textKey = item.text.toLowerCase();
        if (!activeTexts.has(textKey)) {
          const existing = counts.get(textKey);
          if (existing) {
            existing.count += 1;
            existing.listIds.add(item.listId);
            if (item.storeName) existing.storeNames.add(item.storeName);
            if (item.locationName) existing.locationNames.add(item.locationName);
          } else {
            counts.set(textKey, { 
              count: 1, 
              text: item.text,
              listIds: new Set([item.listId]),
              storeNames: new Set(item.storeName ? [item.storeName] : []),
              locationNames: new Set(item.locationName ? [item.locationName] : [])
            });
          }
        }
      }
    });

    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .map(entry => ({ 
        text: entry.text, 
        listIds: Array.from(entry.listIds),
        storeNames: Array.from(entry.storeNames), 
        locationNames: Array.from(entry.locationNames) 
      }));
  }, [categoryScopedHistory]);

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
