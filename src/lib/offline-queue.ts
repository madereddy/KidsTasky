// src/lib/offline-queue.ts
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
  return stored ? JSON.parse(stored) : [];
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
