import { Task, TaskCompletion, UserProfile, Category, Invite, EarnedBadge } from '../types';

const API_BASE = '/api';

async function fetchAPI(endpoint: string, options?: RequestInit) {
  const res = await fetch(API_BASE + endpoint, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options
  });
  if (!res.ok) {
    throw new Error('API Error: ' + res.status);
  }
  return await res.json();
}

export const taskService = {
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      return await fetchAPI('/users/' + uid);
    } catch (e) {
      return null;
    }
  },

  async createUserProfile(profile: UserProfile): Promise<void> {
    await fetchAPI('/users', {
      method: "POST",
      body: JSON.stringify(profile)
    });
  },

  async addBadge(uid: string, badgeId: string): Promise<void> {
    await fetchAPI('/users/' + uid + '/badge', {
      method: "POST",
      body: JSON.stringify({ badgeId })
    });
  },

  async updateUserXP(uid: string, xpChange: number): Promise<void> {
    await fetchAPI('/users/' + uid + '/xp', {
      method: "POST",
      body: JSON.stringify({ xpChange })
    });
  },

  async updateUserTheme(uid: string, themeId: string): Promise<void> {
    await fetchAPI('/users/' + uid + '/theme', {
      method: "POST",
      body: JSON.stringify({ themeId })
    });
  },

  async getKidsForParent(parentId: string): Promise<UserProfile[]> {
    return await fetchAPI('/parents/' + parentId + '/kids');
  },

  // Tasks
  async createTask(task: Omit<Task, 'id' | 'createdAt' | 'status'>): Promise<string> {
    const res = await fetchAPI('/tasks', {
      method: "POST",
      body: JSON.stringify(task)
    });
    return res.id;
  },

  async getTasksForKid(kidId: string): Promise<Task[]> {
    return await fetchAPI('/kids/' + kidId + '/tasks');
  },

  async getTasksForParent(parentId: string): Promise<Task[]> {
    return await fetchAPI('/parents/' + parentId + '/tasks');
  },

  async archiveTask(taskId: string): Promise<void> {
    await fetchAPI('/tasks/' + taskId + '/archive', { method: "PUT" });
  },

  // Completions
  async completeTask(taskId: string, kidId: string, dateString: string, count?: number): Promise<void> {
    await fetchAPI('/completions', {
      method: "POST",
      body: JSON.stringify({ taskId, kidId, dateString, count })
    });
  },

  async uncompleteTask(taskId: string, dateString: string, count?: number): Promise<void> {
    const id = taskId + '_' + dateString + '_' + (count || 1);
    await fetchAPI('/completions/' + id, { method: "DELETE" });
  },

  async getCompletionsForKid(kidId: string, dateString: string): Promise<TaskCompletion[]> {
    return await fetchAPI('/kids/' + kidId + '/completions?dateString=' + dateString);
  },

  async getCompletionsForDateRange(kidId: string, startDate: string, endDate: string): Promise<TaskCompletion[]> {
    return await fetchAPI('/kids/' + kidId + '/completions?startDate=' + startDate + '&endDate=' + endDate);
  },

  async getHistoryForKid(kidId: string, limitCount: number = 50): Promise<TaskCompletion[]> {
    return await fetchAPI('/kids/' + kidId + '/history?limit=' + limitCount);
  },

  // Categories
  async createCategory(category: Omit<Category, 'id'>): Promise<string> {
    const res = await fetchAPI('/categories', {
      method: "POST",
      body: JSON.stringify(category)
    });
    return res.id;
  },

  async updateCategory(category: Category): Promise<void> {
    await fetchAPI('/categories/' + category.id, {
      method: "PUT",
      body: JSON.stringify(category)
    });
  },

  async deleteCategory(categoryId: string): Promise<void> {
    await fetchAPI('/categories/' + categoryId, { method: "DELETE" });
  },

  async getCategories(parentId: string): Promise<Category[]> {
    return await fetchAPI('/parents/' + parentId + '/categories');
  },

  // Invites
  async createInvite(parentId: string, parentName: string): Promise<string> {
    const res = await fetchAPI('/invites', {
      method: "POST",
      body: JSON.stringify({ parentId, parentName })
    });
    return res.id;
  },

  async getActiveInvite(parentId: string): Promise<Invite | null> {
    return await fetchAPI('/parents/' + parentId + '/invites/active');
  },

  async validateInvite(code: string): Promise<Invite | null> {
    return await fetchAPI('/invites/' + code + '/validate');
  },

  // Notifications
  async getUnreadNotifications(parentId: string): Promise<any[]> {
    return await fetchAPI('/parents/' + parentId + '/notifications');
  },

  async markNotificationRead(notificationId: string): Promise<void> {
    await fetchAPI('/notifications/' + notificationId + '/read', { method: "PUT" });
  }
};
