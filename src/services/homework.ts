import { Homework } from '../types';
import { fetchAPI } from './http';

const HOMEWORK_TTL_MS = 10_000;
const homeworkCache = new Map<string, { value: Homework[]; expiresAt: number }>();
const homeworkInflight = new Map<string, Promise<Homework[]>>();

export const homeworkClientService = {
  getHomework(parentId: string): Promise<Homework[]> {
    const cached = homeworkCache.get(parentId);
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
    const inflight = homeworkInflight.get(parentId);
    if (inflight) return inflight;
    const req = fetchAPI(`/parents/${parentId}/homework`)
      .then((res) => {
        homeworkCache.set(parentId, { value: res, expiresAt: Date.now() + HOMEWORK_TTL_MS });
        return res;
      })
      .finally(() => homeworkInflight.delete(parentId));
    homeworkInflight.set(parentId, req);
    return req;
  },
  createHomework(data: Omit<Homework, 'id' | 'createdAt'>): Promise<Homework> {
    return fetchAPI('/homework', { method: 'POST', body: JSON.stringify(data) }).then((res) => {
      homeworkCache.delete(data.parentId);
      homeworkInflight.clear();
      return res;
    });
  },
  updateHomework(id: string, data: Partial<Homework>): Promise<{ success: boolean }> {
    return fetchAPI(`/homework/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((res) => {
      homeworkCache.clear();
      homeworkInflight.clear();
      return res;
    });
  },
  deleteHomework(id: string): Promise<{ success: boolean }> {
    return fetchAPI(`/homework/${id}`, { method: 'DELETE' }).then((res) => {
      homeworkCache.clear();
      homeworkInflight.clear();
      return res;
    });
  },
};
