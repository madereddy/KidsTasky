import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useListsController } from './useListsController';
import { listsClientService } from '../services/lists';

vi.mock('../services/lists', () => ({
  listsClientService: {
    getLists: vi.fn(),
    createList: vi.fn(),
    updateList: vi.fn(),
    deleteList: vi.fn(),
    getItems: vi.fn(),
    addItem: vi.fn(),
    addItemsToLists: vi.fn(),
    copyItemToLists: vi.fn(),
    moveItemToList: vi.fn(),
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
    vi.mocked(listsClientService.getItems).mockResolvedValueOnce([]);
    vi.mocked(listsClientService.getParentItems).mockResolvedValueOnce([
      { id: 'i1', listId: 'l1', text: 'Milk', completed: 0 },
      { id: 'i2', listId: 'l1', text: 'Eggs', completed: 1 },
      { id: 'i3', listId: 'l2', text: 'Nails', completed: 0 },
      { id: 'i4', listId: 'l3', text: 'Brush Teeth', completed: 0 },
    ]);

    const { result } = renderHook(() => useListsController({ parentId: 'p1' }));

    await waitFor(() => expect(result.current.loadingLists).toBe(false));

    expect(result.current.shoppingItems).toHaveLength(2);
    expect(result.current.shoppingItems.map(i => i.text)).toContain('Milk');
    expect(result.current.shoppingItems.map(i => i.text)).toContain('Nails');
  });

  it('scopes frequentItems to the active category so routines do not suggest shopping history', async () => {
    const completedAt = new Date('2026-06-10T12:00:00.000Z').getTime();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-06-17T12:00:00.000Z').getTime());
    vi.mocked(listsClientService.getLists).mockResolvedValueOnce([
      { id: 'shop-1', parentId: 'p1', title: 'Groceries', category: 'shopping', isRoutine: 0, createdAt: '', updatedAt: '' },
      { id: 'routine-1', parentId: 'p1', title: 'Morning', category: 'routine', isRoutine: 1, createdAt: '', updatedAt: '' },
    ]);
    vi.mocked(listsClientService.getItems).mockResolvedValueOnce([]);
    vi.mocked(listsClientService.getParentItems).mockResolvedValueOnce([
      { id: 'i1', listId: 'shop-1', text: 'Milk', completed: 1, completedAt },
      { id: 'i2', listId: 'routine-1', text: 'Brush Teeth', completed: 1, completedAt },
    ]);

    const { result } = renderHook(() => useListsController({ parentId: 'p1', preferredCategory: 'routine' }));

    await waitFor(() => expect(result.current.loadingLists).toBe(false));

    expect(result.current.frequentItems.map((item) => item.text)).toEqual(['Brush Teeth']);
    nowSpy.mockRestore();
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

  it('prefers the requested category when choosing the initial list', async () => {
    vi.mocked(listsClientService.getLists).mockResolvedValueOnce([
      { id: 'routine-1', parentId: 'p1', title: 'Morning', category: 'routine', isRoutine: 1, createdAt: '', updatedAt: '' },
      { id: 'shop-1', parentId: 'p1', title: 'Groceries', category: 'shopping', isRoutine: 0, createdAt: '', updatedAt: '' },
    ]);
    vi.mocked(listsClientService.getParentItems).mockResolvedValueOnce([]);
    vi.mocked(listsClientService.getItems).mockResolvedValueOnce([]);

    const { result } = renderHook(() => useListsController({ parentId: 'p1', preferredCategory: 'shopping' }));

    await waitFor(() => expect(result.current.selectedListId).toBe('shop-1'));
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

  it('moves selection when the selected list changes category out of the active tab', async () => {
    vi.mocked(listsClientService.getLists).mockResolvedValueOnce([
      { id: 'routine-1', parentId: 'p1', title: 'Morning', category: 'routine', isRoutine: 1, createdAt: '', updatedAt: '' },
      { id: 'routine-2', parentId: 'p1', title: 'Evening', category: 'routine', isRoutine: 0, createdAt: '', updatedAt: '' },
      { id: 'shop-1', parentId: 'p1', title: 'Groceries', category: 'shopping', isRoutine: 0, createdAt: '', updatedAt: '' },
    ]);
    vi.mocked(listsClientService.getParentItems).mockResolvedValueOnce([]);
    vi.mocked(listsClientService.getItems).mockResolvedValue([]);
    vi.mocked(listsClientService.updateList).mockResolvedValue({
      id: 'routine-1', parentId: 'p1', title: 'Morning', category: 'shopping', isRoutine: 0, createdAt: '', updatedAt: '',
    });

    const { result } = renderHook(() => useListsController({ parentId: 'p1', preferredCategory: 'routine' }));

    await waitFor(() => expect(result.current.selectedListId).toBe('routine-1'));

    await act(async () => {
      await result.current.updateList('routine-1', 'Morning', 'shopping', 0);
    });

    expect(result.current.selectedListId).toBe('routine-2');
  });

  it('does not fetch lists when parentId is empty', async () => {
    const { result } = renderHook(() => useListsController({ parentId: '' }));

    await waitFor(() => expect(result.current.loadingLists).toBe(false));
    expect(listsClientService.getLists).not.toHaveBeenCalled();
    expect(result.current.lists).toEqual([]);
    expect(result.current.selectedListId).toBeNull();
  });
});

describe('useListsController - Structured Metadata', () => {
  it('parses storeName and completedAt from separate columns', async () => {
    vi.mocked(listsClientService.getLists).mockResolvedValue([{ id: 'list-1', parentId: 'parent-1', title: 'Groceries', category: 'shopping', isRoutine: 0, createdAt: '', updatedAt: '' }]);
    vi.mocked(listsClientService.getItems).mockResolvedValue([
      { id: 'item-1', listId: 'list-1', text: 'Milk', completed: 1, storeName: 'Costco', completedAt: 1700000000000 }
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
      id: 'item-2', listId: 'list-1', text: 'Eggs', completed: 0, storeName: 'Costco'
    });

    const { result } = renderHook(() => useListsController({ parentId: 'parent-1' }));
    
    await waitFor(() => expect(result.current.selectedListId).toBe('list-1'));

    await act(async () => {
      await result.current.addItem('Eggs @ Costco');
    });

    expect(listsClientService.addItem).toHaveBeenCalledWith('list-1', 'Eggs', 'Costco', undefined);
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].text).toBe('Eggs');
    expect(result.current.items[0].storeName).toBe('Costco');
  });

  it('can add one item to multiple lists with metadata preserved', async () => {
    vi.mocked(listsClientService.getLists).mockResolvedValue([
      { id: 'list-1', parentId: 'parent-1', title: 'Morning', category: 'routine', isRoutine: 1, createdAt: '', updatedAt: '' },
      { id: 'list-2', parentId: 'parent-1', title: 'Soccer', category: 'routine', isRoutine: 0, createdAt: '', updatedAt: '' },
    ]);
    vi.mocked(listsClientService.getItems).mockResolvedValue([]);
    vi.mocked(listsClientService.addItemsToLists).mockResolvedValue([
      { id: 'item-1', listId: 'list-1', text: 'Water Bottle', completed: 0, locationName: 'School' },
      { id: 'item-2', listId: 'list-2', text: 'Water Bottle', completed: 0, locationName: 'School' },
    ]);

    const { result } = renderHook(() => useListsController({ parentId: 'parent-1', preferredCategory: 'routine' }));

    await waitFor(() => expect(result.current.selectedListId).toBe('list-1'));

    await act(async () => {
      await result.current.addItemToLists(['list-1', 'list-2'], 'Water Bottle', undefined, 'School');
    });

    expect(listsClientService.addItemsToLists).toHaveBeenCalledWith(
      ['list-1', 'list-2'],
      'Water Bottle',
      undefined,
      'School'
    );
    expect(result.current.items.map((item) => item.text)).toContain('Water Bottle');
  });

  it('keeps metadata out of visible text after checking an item', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1780588800000);
    vi.mocked(listsClientService.getLists).mockResolvedValue([{ id: 'list-1', parentId: 'parent-1', title: 'Groceries', category: 'shopping', isRoutine: 0, createdAt: '', updatedAt: '' }]);
    vi.mocked(listsClientService.getItems).mockResolvedValue([
      { id: 'item-1', listId: 'list-1', text: 'Milk', completed: 0, storeName: 'Costco' }
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
      'Milk',
      'Costco',
      undefined
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

  it('can toggle an aggregated shopping item that is not in the selected list items', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1780588800000);
    vi.mocked(listsClientService.getLists).mockResolvedValueOnce([
      { id: 'list-1', parentId: 'parent-1', title: 'Groceries', category: 'shopping', isRoutine: 0, createdAt: '', updatedAt: '' },
      { id: 'list-2', parentId: 'parent-1', title: 'Hardware', category: 'shopping', isRoutine: 0, createdAt: '', updatedAt: '' },
    ]);
    vi.mocked(listsClientService.getParentItems).mockResolvedValueOnce([
      { id: 'item-2', listId: 'list-2', text: 'Batteries', completed: 0, storeName: 'Target' },
    ]);
    vi.mocked(listsClientService.getItems).mockResolvedValueOnce([]);
    vi.mocked(listsClientService.toggleItem).mockResolvedValue(undefined);

    const { result } = renderHook(() => useListsController({ parentId: 'parent-1', preferredCategory: 'shopping' }));

    await waitFor(() => expect(result.current.shoppingItems[0]?.text).toBe('Batteries'));

    await act(async () => {
      await result.current.toggleItem('item-2', true);
    });

    expect(listsClientService.toggleItem).toHaveBeenCalledWith(
      'item-2',
      true,
      'Batteries',
      'Target',
      undefined
    );
    expect(result.current.shoppingItems).toHaveLength(0);
    nowSpy.mockRestore();
  });
});
