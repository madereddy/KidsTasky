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

    socket.on('stale-data', (data) => {
      listeners.forEach(ref => ref.current(data));
    });
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
