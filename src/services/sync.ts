import { SyncCalendar } from '../types';
import { fetchAPI } from './http';

export type SyncNowResponse = {
  success: boolean;
  imported: number;
  updated: number;
  successCount: number;
  failureCount: number;
  errors: Array<{ connectionId: string; calendarId: string; message: string }>;
  connections: number;
  startedAt: number;
  finishedAt: number;
};

export const syncClientService = {
  getCalendars: (parentId: string): Promise<SyncCalendar[]> =>
    fetchAPI(`/settings/${parentId}/calendars`),

  toggleCalendar: (id: string, enabled: boolean): Promise<{ success: boolean }> =>
    fetchAPI(`/settings/calendars/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),

  syncNow: (parentId: string): Promise<SyncNowResponse> =>
    fetchAPI(`/settings/${parentId}/sync-now`, {
      method: 'POST',
    }),
};
