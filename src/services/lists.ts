import { fetchAPI } from './http';
import { AppList, AppListItem } from '../types';

export const listsClientService = {
  getLists: (parentId: string): Promise<AppList[]> =>
    fetchAPI(`/parents/${parentId}/lists`),
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
  addItem: (listId: string, text: string): Promise<AppListItem> =>
    fetchAPI(`/lists/${listId}/items`, { method: 'POST', body: JSON.stringify({ text }) }),
  toggleItem: (itemId: string, completed: boolean, text?: string): Promise<void> =>
    fetchAPI(`/list-items/${itemId}`, { method: 'PUT', body: JSON.stringify({ completed, text }) }),
  deleteItem: (itemId: string): Promise<void> =>
    fetchAPI(`/list-items/${itemId}`, { method: 'DELETE' }),
};
