import { SyncCalendar } from '../types';
import { fetchAPI } from './http';

export type SyncCalendarError = {
  calendarId: string;
  message: string;
};

export type SyncNowResult = {
  successCount: number;
  failureCount: number;
  errors: SyncCalendarError[];
  startedAt: number;
  finishedAt: number;
  imported: number;
  updated: number;
};

/**
 * @deprecated Use SyncNowResult
 */
export type SyncNowResponse = SyncNowResult & {
  success: boolean;
  connections: number;
};

export const syncClientService = {
  getCalendars: (parentId: string): Promise<SyncCalendar[]> =>
    fetchAPI(`/settings/${parentId}/calendars`),

  toggleCalendar: (id: string, enabled: boolean): Promise<{ success: boolean }> =>
    fetchAPI(`/settings/calendars/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),

  syncNow: (id: string): Promise<SyncNowResult> =>
    fetchAPI(`/sync/${id}/now`, {
      method: 'POST',
    }),
};
