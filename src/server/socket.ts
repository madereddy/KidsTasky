import { Server } from "socket.io";
import jwt from 'jsonwebtoken';
import { getJwtSecret } from './config.js';

let io: Server;
const userSocketMap = new Map<string, Set<string>>();
const socketToUid = new Map<string, string>(); // reverse map for O(1) disconnect
const staleEmitTimers = new Map<string, ReturnType<typeof setTimeout>>();
const STALE_EMIT_COALESCE_MS = 200;

export const socketWrapper = {
  init: (serverIo: Server) => {
    io = serverIo;
    io.on('connection', (socket) => {
      socket.on('join-room', (parentId: string, token?: string) => {
        try {
          if (!token) {
            console.warn(`Socket ${socket.id} join-room rejected: no token`);
            return;
          }
          const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as { uid: string; role: string; parentId: string };
          const expectedParentId = payload.parentId || payload.uid;
          if (expectedParentId !== parentId) {
            console.warn(`Socket ${socket.id} join-room rejected: parentId mismatch`);
            return;
          }
          socket.join(parentId);

          const uid = payload.uid;
          if (!userSocketMap.has(uid)) userSocketMap.set(uid, new Set());
          userSocketMap.get(uid)!.add(socket.id);
          socketToUid.set(socket.id, uid);

          console.log(`Socket ${socket.id} joined room for parent: ${parentId}`);
        } catch (err) {
          console.warn(`Socket ${socket.id} join-room rejected: invalid token`);
        }
      });

      socket.on('disconnect', () => {
        const uid = socketToUid.get(socket.id);
        socketToUid.delete(socket.id);
        if (uid) {
          const ids = userSocketMap.get(uid);
          if (ids) {
            ids.delete(socket.id);
            if (ids.size === 0) userSocketMap.delete(uid);
          }
        }
      });
    });
  },

  emitStaleData: (parentId: string, entityType: string) => {
    if (!io) return;
    const key = `${parentId}:${entityType || 'general'}`;
    if (staleEmitTimers.has(key)) return;
    const timer = setTimeout(() => {
      staleEmitTimers.delete(key);
      io.to(parentId).emit('stale-data', { entity: entityType, timestamp: Date.now() });
    }, STALE_EMIT_COALESCE_MS);
    staleEmitTimers.set(key, timer);
  },

  emitToUser: (uid: string, event: string, data?: any) => {
    const socketIds = userSocketMap.get(uid);
    if (socketIds && io) {
      socketIds.forEach(socketId => io.to(socketId).emit(event, data));
    }
  }
};
