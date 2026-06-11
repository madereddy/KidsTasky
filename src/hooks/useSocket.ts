import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let listeners: Array<{ current: (data: any) => void }> = [];

export const initSocket = (parentId: string) => {
  if (!socket) {
    socket = io(window.location.origin);
    socket.on('connect', () => {
      const token = localStorage.getItem('kidtasker_token');
      socket?.emit('join-room', parentId, token);
    });

    const pendingByEntity = new Map<string, ReturnType<typeof setTimeout>>();
    const CLIENT_DEBOUNCE_MS = 150;

    socket.on('stale-data', (data) => {
      const key = data?.entity ?? data?.type ?? 'all';
      const existing = pendingByEntity.get(key);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        pendingByEntity.delete(key);
        listeners.forEach(ref => ref.current(data));
      }, CLIENT_DEBOUNCE_MS);
      pendingByEntity.set(key, timer);
    });
  } else if (socket.connected) {
    const token = localStorage.getItem('kidtasker_token');
    socket.emit('join-room', parentId, token);
  }
};

export type StaleDataEvent = {
  entity?: string;
  type?: string;
  timestamp?: number;
};

export function matchesEntityFilter(entities: string[], data: StaleDataEvent): boolean {
  const entity = data.entity ?? data.type ?? 'all';
  return entities.includes('all') || entity === 'all' || entities.includes(entity);
}

export function getSocket(): Socket | null {
  return socket;
}

export const useSocketStaleData = (
  entities: string[],
  onStaleData: (data: StaleDataEvent) => void
) => {
  const callbackRef = useRef(onStaleData);
  callbackRef.current = onStaleData;

  useEffect(() => {
    const wrappedRef = {
      current: (data: StaleDataEvent) => {
        if (matchesEntityFilter(entities, data)) {
          callbackRef.current(data);
        }
      }
    };
    listeners.push(wrappedRef);
    return () => {
      listeners = listeners.filter(r => r !== wrappedRef);
    };
  }, [entities.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
};
