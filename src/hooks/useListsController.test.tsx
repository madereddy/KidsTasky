import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useListsController } from './useListsController';
import { listsClientService } from '../services/lists';

vi.mock('../services/lists', () => ({
  listsClientService: {
    getLists: vi.fn(),
    createList: vi.fn(),
    deleteList: vi.fn(),
    getItems: vi.fn(),
    addItem: vi.fn(),
    toggleItem: vi.fn(),
    deleteItem: vi.fn(),
    getParentItems: vi.fn(),
  },
}));

describe('useListsController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides routineLists and shoppingLists correctly', async () => {
    vi.mocked(listsClientService.getLists).mockResolvedValueOnce([
      { id: 'l1', parentId: 'p1', title: 'Groceries', category: 'shopping', isRoutine: 0, createdAt: '', updatedAt: '' },
      { id: 'l2', parentId: 'p1', title: 'Hardware', category: 'shopping', isRoutine: 0, createdAt: '', updatedAt: '' },
      { id: 'l3', parentId: 'p1', title: 'Morning Routine', category: 'routine', isRoutine: 1, createdAt: '', updatedAt: '' },
    ]);
    vi.mocked(listsClientService.getItems).mockResolvedValueOnce([]);

    const { result } = renderHook(() => useListsController({ parentId: 'p1' }));

    await waitFor(() => expect(result.current.loadingLists).toBe(false));
    
    expect(result.current.shoppingLists).toHaveLength(2);
    expect(result.current.routineLists).toHaveLength(1);
    expect(result.current.routineLists[0].id).toBe('l3');
  });

  it('provides shoppingItems aggregate using globalHistory', async () => {
    vi.mocked(listsClientService.getLists).mockResolvedValueOnce([
      { id: 'l1', parentId: 'p1', title: 'Groceries', category: 'shopping', isRoutine: 0, createdAt: '', updatedAt: '' },
      { id: 'l2', parentId: 'p1', title: 'Hardware', category: 'shopping', isRoutine: 0, createdAt: '', updatedAt: '' },
      { id: 'l3', parentId: 'p1', title: 'Morning', category: 'routine', isRoutine: 1, createdAt: '', updatedAt: '' },
    ]);
    // selected list items
    vi.mocked(listsClientService.getItems).mockResolvedValueOnce([]);
    // getParentItems for globalHistory
    vi.mocked(listsClientService.getParentItems).mockResolvedValueOnce([
      { id: 'i1', listId: 'l1', text: 'Milk', completed: 0 },
      { id: 'i2', listId: 'l1', text: 'Eggs', completed: 1 },
      { id: 'i3', listId: 'l2', text: 'Nails', completed: 0 },
      { id: 'i4', listId: 'l3', text: 'Brush Teeth', completed: 0 },
    ]);

    const { result } = renderHook(() => useListsController({ parentId: 'p1' }));

    await waitFor(() => expect(result.current.loadingLists).toBe(false));

    // Should include items from l1 and l2, but only uncompleted ones? Or all? 
    // Usually aggregates are active items. Let's assume uncompleted items.
    expect(result.current.shoppingItems).toHaveLength(2);
    expect(result.current.shoppingItems.map(i => i.text)).toContain('Milk');
    expect(result.current.shoppingItems.map(i => i.text)).toContain('Nails');
  });

  it('selects the first list on initial load', async () => {
    vi.mocked(listsClientService.getLists).mockResolvedValueOnce([
      { id: 'l1', parentId: 'p1', title: 'Groceries', category: 'shopping', isRoutine: 0, createdAt: '', updatedAt: '' },
      { id: 'l2', parentId: 'p1', title: 'Hardware', category: 'shopping', isRoutine: 0, createdAt: '', updatedAt: '' },
    ]);
    vi.mocked(listsClientService.getItems).mockResolvedValueOnce([{ id: 'i1', listId: 'l1', text: 'Milk', completed: 0 }]);

    const { result } = renderHook(() => useListsController({ parentId: 'p1' }));

    await waitFor(() => expect(result.current.selectedListId).toBe('l1'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
  });

  it('deleting the selected list moves selection to the next list', async () => {
    vi.mocked(listsClientService.getLists).mockResolvedValueOnce([
      { id: 'l1', parentId: 'p1', title: 'Groceries', category: 'shopping', isRoutine: 0, createdAt: '', updatedAt: '' },
      { id: 'l2', parentId: 'p1', title: 'Hardware', category: 'shopping', isRoutine: 0, createdAt: '', updatedAt: '' },
    ]);
    vi.mocked(listsClientService.getItems).mockResolvedValueOnce([]);
    vi.mocked(listsClientService.deleteList).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useListsController({ parentId: 'p1' }));

    await waitFor(() => expect(result.current.selectedListId).toBe('l1'));

    await act(async () => {
      await result.current.deleteList('l1');
    });

    expect(result.current.lists.map((list) => list.id)).toEqual(['l2']);
    expect(result.current.selectedListId).toBe('l2');
  });

  it('does not fetch lists when parentId is empty', async () => {
    const { result } = renderHook(() => useListsController({ parentId: '' }));

    await waitFor(() => expect(result.current.loadingLists).toBe(false));
    expect(listsClientService.getLists).not.toHaveBeenCalled();
    expect(result.current.lists).toEqual([]);
    expect(result.current.selectedListId).toBeNull();
  });
});

describe('useListsController - Smart Metadata', () => {
  it('parses storeName and completedAt from text field', async () => {
    vi.mocked(listsClientService.getLists).mockResolvedValue([{ id: 'list-1', parentId: 'parent-1', title: 'Groceries', category: 'shopping', isRoutine: 0, createdAt: '', updatedAt: '' }]);
    vi.mocked(listsClientService.getItems).mockResolvedValue([
      { id: 'item-1', listId: 'list-1', text: 'Milk |META:{"storeName":"Costco","completedAt":1700000000000}|', completed: 1 }
    ]);

    const { result } = renderHook(() => useListsController({ parentId: 'parent-1' }));
    
    await act(async () => {
      await result.current.loadLists();
    });
    
    await act(async () => {
      await result.current.loadItems('list-1');
    });

    expect(result.current.items[0].text).toBe('Milk');
    expect(result.current.items[0].storeName).toBe('Costco');
    expect(result.current.items[0].completedAt).toBe(1700000000000);
  });

  it('adds item with explicit store parsing', async () => {
    vi.mocked(listsClientService.getLists).mockResolvedValue([{ id: 'list-1', parentId: 'parent-1', title: 'Groceries', category: 'shopping', isRoutine: 0, createdAt: '', updatedAt: '' }]);
    vi.mocked(listsClientService.getItems).mockResolvedValue([]);
    vi.mocked(listsClientService.addItem).mockResolvedValue({
      id: 'item-2', listId: 'list-1', text: 'Eggs |META:{"storeName":"Costco"}|', completed: 0
    });

    const { result } = renderHook(() => useListsController({ parentId: 'parent-1' }));
    
    await waitFor(() => expect(result.current.selectedListId).toBe('list-1'));

    await act(async () => {
      await result.current.addItem('Eggs @ Costco');
    });

    expect(listsClientService.addItem).toHaveBeenCalledWith('list-1', 'Eggs |META:{"storeName":"Costco"}|');
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].text).toBe('Eggs');
    expect(result.current.items[0].storeName).toBe('Costco');
  });

  it('keeps metadata out of visible text after checking an item', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1780588800000);
    vi.mocked(listsClientService.getLists).mockResolvedValue([{ id: 'list-1', parentId: 'parent-1', title: 'Groceries', category: 'shopping', isRoutine: 0, createdAt: '', updatedAt: '' }]);
    vi.mocked(listsClientService.getItems).mockResolvedValue([
      { id: 'item-1', listId: 'list-1', text: 'Milk |META:{"storeName":"Costco"}|', completed: 0 }
    ]);
    vi.mocked(listsClientService.toggleItem).mockResolvedValue(undefined);

    const { result } = renderHook(() => useListsController({ parentId: 'parent-1' }));

    await waitFor(() => expect(result.current.selectedListId).toBe('list-1'));
    await waitFor(() => expect(result.current.items[0]?.text).toBe('Milk'));

    await act(async () => {
      await result.current.toggleItem('item-1', true);
    });

    expect(listsClientService.toggleItem).toHaveBeenCalledWith(
      'item-1',
      true,
      'Milk |META:{"storeName":"Costco","completedAt":1780588800000}|'
    );
    expect(result.current.items[0]).toMatchObject({
      id: 'item-1',
      text: 'Milk',
      storeName: 'Costco',
      completed: 1,
      completedAt: 1780588800000,
    });
    nowSpy.mockRestore();
  });
});
