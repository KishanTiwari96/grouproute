import { io } from 'socket.io-client';

const SOCKET_URL = 
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL)) || 
  'http://localhost:5000';

let socketInstance = null;

export function getSocket() {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      auth: (cb) => {
        const token = localStorage.getItem('grouproute_token');
        cb({ token });
      },
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketInstance.on('connect', () => {
      console.log('[Socket] Connected to server with ID:', socketInstance.id);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected from server:', reason);
    });

    socketInstance.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });
  }

  const currentToken = localStorage.getItem('grouproute_token');
  if (currentToken && socketInstance) {
    socketInstance.auth = { token: currentToken };
  }

  return socketInstance;
}

export function connectSocket() {
  const socket = getSocket();
  const token = localStorage.getItem('grouproute_token');
  if (token) {
    socket.auth = { token };
  }
  if (!socket.connected) {
    socket.connect();
  }
  return socket;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
  }
}

export default { getSocket, connectSocket, disconnectSocket };
