import { useCallback, useEffect, useMemo, useState } from 'react';
import { removeEntityById, upsertEntityById } from '../lib/entity-list';
import { listsClientService } from '../services/lists';
import { AppList, AppListItem } from '../types';

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

function extractStoreFromText(rawText: string): { cleanText: string, storeName?: string, locationName?: string } {
  const storeMatch = rawText.match(/(.+?)(?:\s+@\s+|\s+at\s+)(Costco|Walmart|Target|Trader Joe's|Aldi|Whole Foods)$/i);
  if (storeMatch) {
    return { cleanText: storeMatch[1].trim(), storeName: storeMatch[2].trim() };
  }
  const locMatch = rawText.match(/(.+?)(?:\s+@\s+|\s+at\s+)(Home|Car|School|Soccer Field)$/i);
  if (locMatch) {
    return { cleanText: locMatch[1].trim(), locationName: locMatch[2].trim() };
  }
  return { cleanText: rawText.trim() };
}

interface UseListsControllerOptions {
  parentId: string;
}

export function useListsController({ parentId }: UseListsControllerOptions) {
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
        if (nextLists.length === 0) return null;
        if (currentId && nextLists.some((list) => list.id === currentId)) return currentId;
        return nextLists[0].id;
      });
    } finally {
      setLoadingLists(false);
    }
  }, [parentId]);

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

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const createList = async (title: string, category: 'shopping' | 'routine' = 'shopping', locationName?: string, isRoutine?: number) => {
    const rawTitle = stringifyListMetadata(title, locationName, isRoutine);
    const created = await listsClientService.createList(rawTitle, category, isRoutine, locationName);
    const parsed = parseListMetadata(created);
    setLists((prev) => [...prev, parsed]);
    setSelectedListId(parsed.id);
    setItems([]);
    return parsed;
  };

  const updateList = async (id: string, title: string, category: 'shopping' | 'routine' = 'shopping', locationName?: string, isRoutine?: number) => {
    const rawTitle = stringifyListMetadata(title, locationName, isRoutine);
    const updated = await listsClientService.updateList(id, rawTitle, category, isRoutine, locationName);
    const parsed = parseListMetadata(updated);
    setLists((prev) => prev.map(l => l.id === id ? parsed : l));
    return parsed;
  };

  const deleteList = async (id: string) => {
    await listsClientService.deleteList(id);
    setLists((prev) => {
      const remaining = removeEntityById(prev, id);
      setSelectedListId((currentId) => {
        if (currentId !== id) return currentId;
        return remaining[0]?.id ?? null;
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

    const { cleanText, storeName: parsedStore, locationName: parsedLocation } = extractStoreFromText(text);
    const finalStore = explicitStore || parsedStore;
    const finalLocation = explicitLocation || parsedLocation;

    const rawText = stringifyItemMetadata(cleanText, finalStore, undefined, finalLocation);
    const created = await listsClientService.addItem(selectedListId, rawText);

    const parsedCreated = parseItemMetadata(created);
    setItems((prev) => [...prev, parsedCreated]);
    void refreshGlobalHistory();
    return parsedCreated;
  };

  const toggleItem = async (itemId: string, completed: boolean) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const completedAt = completed ? Date.now() : undefined;
    const displayText = item.text.replace(/\s*\|META:.*?\|$/, '');
    const serializedText = stringifyItemMetadata(
      displayText,
      item.storeName,
      completedAt,
      item.locationName
    );

    await listsClientService.toggleItem(itemId, completed, serializedText);
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
    void refreshGlobalHistory();
  };

  const deleteItem = async (itemId: string) => {
    await listsClientService.deleteItem(itemId);
    setItems((prev) => removeEntityById(prev, itemId));
    void refreshGlobalHistory();
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
    toggleItem,
    deleteItem,
    frequentItems,
    setLists,
    setItems,
  };
}
