// src/lib/offline-queue.ts
import { clientLogger } from '../services/clientLogger';

export interface OfflineAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'TOGGLE';
  entity: 'task' | 'list_item' | 'completion';
  endpoint: string;
  method: string;
  body: string;
  timestamp: number;
  description: string;
}

const STORAGE_KEY = 'kidtasker_offline_queue';

export function getOfflineQueue(): OfflineAction[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (error) {
    clientLogger.error('Failed to parse offline queue', { error: error instanceof Error ? error.message : String(error) });
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

export function pushOfflineAction(action: Omit<OfflineAction, 'id' | 'timestamp'>) {
  const queue = getOfflineQueue();
  const newAction: OfflineAction = {
    ...action,
    id: crypto.randomUUID(),
    timestamp: Date.now()
  };
  queue.push(newAction);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function popOfflineAction(): OfflineAction | undefined {
  const queue = getOfflineQueue();
  const action = queue.shift();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  return action;
}

export function clearOfflineQueue() {
  localStorage.removeItem(STORAGE_KEY);
}
