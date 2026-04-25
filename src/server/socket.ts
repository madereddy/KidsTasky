import { Server } from "socket.io";

let io: Server;

export const socketWrapper = {
  init: (serverIo: Server) => {
    io = serverIo;
    io.on('connection', (socket) => {
      // Client must emit 'join-room' with their parentId
      socket.on('join-room', (parentId: string) => {
        socket.join(parentId);
        console.log(`Socket ${socket.id} joined room for parent: ${parentId}`);
      });
    });
  },

  emitStaleData: (parentId: string, entityType: string) => {
    if (io) {
      io.to(parentId).emit('stale-data', { entity: entityType, timestamp: Date.now() });
    }
  }
};
