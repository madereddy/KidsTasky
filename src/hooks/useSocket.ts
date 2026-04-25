import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let listeners: Array<(data: any) => void> = [];

export const initSocket = (parentId: string) => {
  if (!socket) {
    socket = io(window.location.origin);
    socket.on('connect', () => {
      socket?.emit('join-room', parentId);
    });

    socket.on('stale-data', (data) => {
      console.log('Received stale-data event:', data);
      listeners.forEach(fn => fn(data));
    });
  }
};

export const useSocketStaleData = (onStaleData: (data: { entity: string, timestamp: number }) => void) => {
  useEffect(() => {
    listeners.push(onStaleData);
    return () => {
      listeners = listeners.filter(fn => fn !== onStaleData);
    };
  }, [onStaleData]);
};
