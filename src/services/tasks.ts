import { fetchAPI } from './http';
import { Task, TaskCompletion } from '../types';

export const tasksClientService = {
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

  async updateTask(taskId: string, patch: Partial<Task>): Promise<void> {
    await fetchAPI('/tasks/' + taskId, { method: 'PATCH', body: JSON.stringify(patch) });
  },

  async completeTask(
    taskId: string,
    kidId: string,
    dateString: string,
    count?: number,
    proofAnswers?: Array<{ question: string; answer: string }>
  ): Promise<void> {
    await fetchAPI('/completions', {
      method: "POST",
      body: JSON.stringify({ taskId, kidId, dateString, count, proofAnswers })
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

  async getPendingCompletions(parentId: string): Promise<any[]> {
    return await fetchAPI(`/parents/${parentId}/pending-completions`);
  },

  async approveCompletion(completionId: string): Promise<void> {
    await fetchAPI(`/completions/${completionId}/approve`, { method: 'PATCH' });
  },

  async rejectCompletion(completionId: string): Promise<void> {
    await fetchAPI(`/completions/${completionId}/reject`, { method: 'PATCH' });
  },

  async skipTask(taskId: string, kidId: string, dateString: string, count?: number): Promise<void> {
    await fetchAPI(`/tasks/${taskId}/skip`, {
      method: 'POST',
      body: JSON.stringify({ kidId, dateString, count }),
    });
  }
};
