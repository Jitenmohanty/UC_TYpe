import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../common/utils/logger';
import { UserRole } from '../common/constants/roles';

let io: SocketIOServer | null = null;

// Map userId → socket IDs for targeted emission
const userSocketMap = new Map<string, Set<string>>();

interface SocketUser {
  userId: string;
  role: UserRole;
  email: string;
}

declare module 'socket.io' {
  interface Socket {
    user?: SocketUser;
  }
}

export function initializeSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN.split(','),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // JWT auth middleware for all socket connections
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth['token'] as string | undefined;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
        userId: string;
        role: UserRole;
        email: string;
        type: string;
      };

      if (payload.type !== 'access') {
        return next(new Error('Invalid token type'));
      }

      socket.user = {
        userId: payload.userId,
        role: payload.role,
        email: payload.email,
      };

      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.user?.userId;
    if (!userId) {
      socket.disconnect();
      return;
    }

    // Register user → socket mapping
    if (!userSocketMap.has(userId)) {
      userSocketMap.set(userId, new Set());
    }
    userSocketMap.get(userId)!.add(socket.id);

    logger.info({ msg: 'Socket connected', userId, socketId: socket.id });

    socket.on('disconnect', () => {
      const sockets = userSocketMap.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSocketMap.delete(userId);
        }
      }
      logger.info({ msg: 'Socket disconnected', userId, socketId: socket.id });
    });
  });

  return io;
}

/**
 * Emit an event to a specific user (all their connected sockets)
 * Can be called from workers and services
 */
export function emitToUser(userId: string, event: string, data: unknown): void {
  if (!io) return;

  const socketIds = userSocketMap.get(userId);
  if (!socketIds || socketIds.size === 0) return;

  socketIds.forEach((socketId) => {
    io!.to(socketId).emit(event, data);
  });
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}
