import { useCallback, useEffect, useState } from 'react';
import { fetchAPI } from '../services/http';
import { getOfflineQueue, popOfflineAction } from '../lib/offline-queue';

export function useOfflineQueueSync() {
  const [syncing, setSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const flushQueue = useCallback(async () => {
    if (syncing || isOffline) return;
    const queue = getOfflineQueue();
    if (queue.length === 0) return;
    setSyncing(true);
    try {
      while (getOfflineQueue().length > 0) {
        const action = popOfflineAction();
        if (!action) break;
        try {
          await fetchAPI(action.endpoint, { method: action.method, body: action.body, skipQueue: true }, 0);
        } catch (e: any) {
          if (e.status === 0) {
            const currentQueue = getOfflineQueue();
            localStorage.setItem('kidtasker_offline_queue', JSON.stringify([action, ...currentQueue]));
            break;
          }
        }
      }
      window.dispatchEvent(new CustomEvent('kidtasker:offline-sync-complete'));
    } finally {
      setSyncing(false);
    }
  }, [syncing, isOffline]);

  useEffect(() => {
    if (!isOffline) void flushQueue();
  }, [isOffline, flushQueue]);

  return { isOffline, syncing, flushQueue };
}
