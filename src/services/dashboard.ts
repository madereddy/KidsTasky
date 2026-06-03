import { fetchAPI } from './http';
import { CalendarEvent, Homework, Task, TaskCompletion } from '../types';

export interface FamilyDashboardData {
  tasks: Task[];
  completions: TaskCompletion[];
  events: CalendarEvent[];
  homework: Homework[];
}

const DASHBOARD_TTL_MS = 10_000;
let dashboardCache: { data: FamilyDashboardData; expiresAt: number; parentId: string; dateString: string } | null = null;
let dashboardInflight: Promise<FamilyDashboardData> | null = null;

export const dashboardClientService = {
  getFamilyDashboardData: async (parentId: string, dateString: string): Promise<FamilyDashboardData> => {
    // SWR pattern: return cached if valid, otherwise fetch
    if (dashboardCache && 
        dashboardCache.parentId === parentId && 
        dashboardCache.dateString === dateString && 
        dashboardCache.expiresAt > Date.now()) {
      return dashboardCache.data;
    }

    if (dashboardInflight) return dashboardInflight;

    dashboardInflight = fetchAPI(`/parents/${parentId}/family-dashboard-data?dateString=${dateString}`)
      .then((data) => {
        dashboardCache = {
          data,
          expiresAt: Date.now() + DASHBOARD_TTL_MS,
          parentId,
          dateString
        };
        return data;
      })
      .finally(() => {
        dashboardInflight = null;
      });

    return dashboardInflight;
  },

  clearCache: () => {
    dashboardCache = null;
  }
};
