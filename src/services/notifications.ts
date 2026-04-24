import { fetchAPI } from './http';

export const notificationService = {
  async getUnreadNotifications(parentId: string): Promise<any[]> {
    return await fetchAPI('/parents/' + parentId + '/notifications');
  },

  async markNotificationRead(notificationId: string): Promise<void> {
    await fetchAPI('/notifications/' + notificationId + '/read', { method: "PUT" });
  }
};
