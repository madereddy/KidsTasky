import { fetchAPI } from './http';
import { FamilySettings } from '../types';

export const settingsClientService = {
  getSettings: (parentId: string): Promise<FamilySettings> =>
    fetchAPI(`/settings/${parentId}`),
  saveSettings: (parentId: string, data: Partial<FamilySettings>): Promise<{ success: boolean }> =>
    fetchAPI(`/settings/${parentId}`, { method: 'PUT', body: JSON.stringify(data) }),
};
