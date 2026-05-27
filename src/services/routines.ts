import { RoutineTemplate } from '../types';
import { fetchAPI } from './http';

export const routinesClientService = {
  getTemplates: (parentId: string): Promise<RoutineTemplate[]> =>
    fetchAPI(`/parents/${parentId}/routines`),

  createTemplate: (parentId: string, data: Partial<RoutineTemplate>): Promise<{ id: string }> =>
    fetchAPI(`/parents/${parentId}/routines`, { method: 'POST', body: JSON.stringify(data) }),

  deleteTemplate: (id: string): Promise<{ success: boolean }> =>
    fetchAPI(`/routines/${id}`, { method: 'DELETE' }),

  reorderTemplates: (parentId: string, ids: string[]): Promise<{ success: boolean }> =>
    fetchAPI(`/parents/${parentId}/routines/reorder`, { method: 'PUT', body: JSON.stringify({ ids }) }),
};
