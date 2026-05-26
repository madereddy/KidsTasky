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
      console.log('Received stale-data event:', data);
      listeners.forEach(ref => ref.current(data));
    });
  }
};

export const useSocketStaleData = (onStaleData: (data: { entity: string, timestamp: number }) => void) => {
  const callbackRef = useRef(onStaleData);
  callbackRef.current = onStaleData;

  useEffect(() => {
    listeners.push(callbackRef);
    return () => {
      listeners = listeners.filter(ref => ref !== callbackRef);
    };
  }, []);
};
