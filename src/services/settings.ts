import { fetchAPI } from './http';
import { FamilySettings } from '../types';
import { SyncCalendar } from '../types';

export const settingsClientService = {
  getSettings: (parentId: string): Promise<FamilySettings> =>
    fetchAPI(`/settings/${parentId}`),
  saveSettings: (parentId: string, data: Partial<FamilySettings>): Promise<{ success: boolean }> =>
    fetchAPI(`/settings/${parentId}`, { method: 'PUT', body: JSON.stringify(data) }),
  getCalendars: (parentId: string): Promise<SyncCalendar[]> =>
    fetchAPI(`/settings/${parentId}/calendars`),
  lockDisplay: (parentId: string): Promise<{ success: boolean }> =>
    fetchAPI(`/settings/${parentId}/lock`, { method: "POST" }),
  unlockDisplay: (parentId: string, pin: string): Promise<{ success: boolean }> =>
    fetchAPI(`/settings/${parentId}/unlock`, { method: "POST", body: JSON.stringify({ pin }) }),
  getCalendarVisibility: (): Promise<Array<{ calendarId: string; isVisible: number }>> =>
    fetchAPI('/settings/visibility'),
  setCalendarVisibility: (calendarId: string, isVisible: boolean): Promise<{ success: boolean }> =>
    fetchAPI('/settings/visibility', { 
      method: 'POST', 
      body: JSON.stringify({ calendarId, isVisible: isVisible ? 1 : 0 }) 
    }),
};
