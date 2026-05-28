import { Homework } from '../types';
import { fetchAPI } from './http';

export const homeworkClientService = {
  getHomework(parentId: string): Promise<Homework[]> {
    return fetchAPI(`/parents/${parentId}/homework`);
  },
  createHomework(data: Omit<Homework, 'id' | 'createdAt'>): Promise<Homework> {
    return fetchAPI('/homework', { method: 'POST', body: JSON.stringify(data) });
  },
  updateHomework(id: string, data: Partial<Homework>): Promise<{ success: boolean }> {
    return fetchAPI(`/homework/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  deleteHomework(id: string): Promise<{ success: boolean }> {
    return fetchAPI(`/homework/${id}`, { method: 'DELETE' });
  },
};
