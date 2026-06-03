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
  },
}));

describe('useListsController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects the first list on initial load', async () => {
    vi.mocked(listsClientService.getLists).mockResolvedValueOnce([
      { id: 'l1', parentId: 'p1', title: 'Groceries' },
      { id: 'l2', parentId: 'p1', title: 'Hardware' },
    ]);
    vi.mocked(listsClientService.getItems).mockResolvedValueOnce([{ id: 'i1', listId: 'l1', text: 'Milk', completed: 0 }]);

    const { result } = renderHook(() => useListsController({ parentId: 'p1' }));

    await waitFor(() => expect(result.current.selectedListId).toBe('l1'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
  });

  it('deleting the selected list moves selection to the next list', async () => {
    vi.mocked(listsClientService.getLists).mockResolvedValueOnce([
      { id: 'l1', parentId: 'p1', title: 'Groceries' },
      { id: 'l2', parentId: 'p1', title: 'Hardware' },
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
});
