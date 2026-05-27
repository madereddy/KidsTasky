import { fetchAPI } from './http';

export const notesClientService = {
  getNote: (parentId: string): Promise<{ content: string; updatedByName: string; updatedAt: number }> =>
    fetchAPI(`/family-notes/${parentId}`),

  saveNote: (parentId: string, content: string): Promise<void> =>
    fetchAPI(`/family-notes/${parentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),
};