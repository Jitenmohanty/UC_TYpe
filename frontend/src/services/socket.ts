import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket | null => socket;

export const connectSocket = (token: string): Socket => {
  if (socket) return socket;

  const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

  socket = io(socketUrl, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
  });

  socket.on('connect', () => {
    console.log('⚡ Connected to Real-time Socket Server:', socket?.id);
  });

  socket.on('disconnect', () => {
    console.log('⚡ Disconnected from Socket Server');
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
