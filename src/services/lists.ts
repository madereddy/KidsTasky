import { fetchAPI } from './http';
import { AppList, AppListItem } from '../types';

export const listsClientService = {
  getLists: (parentId: string): Promise<AppList[]> =>
    fetchAPI(`/parents/${parentId}/lists`),
  createList: (title: string): Promise<AppList> =>
    fetchAPI('/lists', { method: 'POST', body: JSON.stringify({ title }) }),
  deleteList: (id: string): Promise<void> =>
    fetchAPI(`/lists/${id}`, { method: 'DELETE' }),
  getItems: (listId: string): Promise<AppListItem[]> =>
    fetchAPI(`/lists/${listId}/items`),
  addItem: (listId: string, text: string): Promise<AppListItem> =>
    fetchAPI(`/lists/${listId}/items`, { method: 'POST', body: JSON.stringify({ text }) }),
  toggleItem: (itemId: string, completed: boolean): Promise<void> =>
    fetchAPI(`/list-items/${itemId}`, { method: 'PUT', body: JSON.stringify({ completed }) }),
  deleteItem: (itemId: string): Promise<void> =>
    fetchAPI(`/list-items/${itemId}`, { method: 'DELETE' }),
};
