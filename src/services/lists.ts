import { fetchAPI } from './http';
import { AppList, AppListItem } from '../types';

export const listsClientService = {
  getLists: (parentId: string): Promise<AppList[]> =>
    fetchAPI(`/parents/${parentId}/lists`),
  getFrequentItems: (parentId: string, limit = 5): Promise<string[]> =>
    fetchAPI(`/parents/${parentId}/frequent-items?limit=${limit}`),
  getParentItems: (parentId: string): Promise<AppListItem[]> =>
    fetchAPI(`/parents/${parentId}/list-items`),
  createList: (title: string, category?: 'shopping' | 'routine', isRoutine?: number, locationName?: string): Promise<AppList> =>
    fetchAPI('/lists', { method: 'POST', body: JSON.stringify({ title, category, isRoutine, locationName }) }),
  deleteList: (id: string): Promise<void> =>
    fetchAPI(`/lists/${id}`, { method: 'DELETE' }),
  updateList: (id: string, title?: string, category?: 'shopping' | 'routine', isRoutine?: number, locationName?: string): Promise<AppList> =>
    fetchAPI(`/lists/${id}`, { method: 'PUT', body: JSON.stringify({ title, category, isRoutine, locationName }) }),
  getItems: (listId: string): Promise<AppListItem[]> =>
    fetchAPI(`/lists/${listId}/items`),
  addItem: (listId: string, text: string, storeName?: string, locationName?: string): Promise<AppListItem> =>
    fetchAPI(`/lists/${listId}/items`, { method: 'POST', body: JSON.stringify({ text, storeName, locationName }) }),
  addItemsToLists: (listIds: string[], text: string, storeName?: string, locationName?: string): Promise<AppListItem[]> =>
    fetchAPI('/list-items/batch', { method: 'POST', body: JSON.stringify({ listIds, text, storeName, locationName }) }),
  copyItemToLists: (itemId: string, listIds: string[]): Promise<AppListItem[]> =>
    fetchAPI(`/list-items/${itemId}/copy`, { method: 'POST', body: JSON.stringify({ listIds }) }),
  moveItemToList: (itemId: string, targetListId: string): Promise<AppListItem> =>
    fetchAPI(`/list-items/${itemId}/move`, { method: 'POST', body: JSON.stringify({ targetListId }) }),
  toggleItem: (itemId: string, completed: boolean, text?: string, storeName?: string, locationName?: string): Promise<void> =>
    fetchAPI(`/list-items/${itemId}`, { method: 'PUT', body: JSON.stringify({ completed, text, storeName, locationName }) }),
  deleteItem: (itemId: string): Promise<void> =>
    fetchAPI(`/list-items/${itemId}`, { method: 'DELETE' }),
};
