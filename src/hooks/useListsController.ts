import { useCallback, useEffect, useMemo, useState } from 'react';
import { removeEntityById, upsertEntityById } from '../lib/entity-list';
import { listsClientService } from '../services/lists';
import { AppList, AppListItem } from '../types';

interface UseListsControllerOptions {
  parentId: string;
}

export function useListsController({ parentId }: UseListsControllerOptions) {
  const [lists, setLists] = useState<AppList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [items, setItems] = useState<AppListItem[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);

  const loadLists = useCallback(async () => {
    setLoadingLists(true);
    try {
      const nextLists = (await listsClientService.getLists(parentId)) || [];
      setLists(nextLists);
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
      setItems(nextItems || []);
    } finally {
      setLoadingItems(false);
    }
  }, [selectedListId]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const createList = async (title: string) => {
    const created = await listsClientService.createList(title);
    setLists((prev) => [...prev, created]);
    setSelectedListId(created.id);
    setItems([]);
    return created;
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
  };

  const addItem = async (text: string) => {
    if (!selectedListId) return null;
    const created = await listsClientService.addItem(selectedListId, text);
    setItems((prev) => [...prev, created]);
    return created;
  };

  const toggleItem = async (itemId: string, completed: boolean) => {
    await listsClientService.toggleItem(itemId, completed);
    setItems((prev) => prev.map((item) => (
      item.id === itemId ? { ...item, completed: completed ? 1 : 0 } : item
    )));
  };

  const deleteItem = async (itemId: string) => {
    await listsClientService.deleteItem(itemId);
    setItems((prev) => removeEntityById(prev, itemId));
  };

  const selectedList = useMemo(
    () => lists.find((list) => list.id === selectedListId) ?? null,
    [lists, selectedListId],
  );

  const updateSelectedList = useCallback((listId: string) => {
    setSelectedListId(listId);
  }, []);

  return {
    lists,
    items,
    selectedList,
    selectedListId,
    loadingLists,
    loadingItems,
    loadLists,
    loadItems,
    setSelectedListId: updateSelectedList,
    createList,
    deleteList,
    addItem,
    toggleItem,
    deleteItem,
    setLists,
    setItems,
  };
}
