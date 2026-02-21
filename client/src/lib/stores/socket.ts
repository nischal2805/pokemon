import { writable, get } from 'svelte/store';
import { io, type Socket } from 'socket.io-client';
import { user } from './auth';

// In Docker behind nginx, VITE_SERVER_URL is empty → connect to same origin.
// In dev, it falls back to localhost:3001.
const API = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

export const socket = writable<Socket | null>(null);
export const connected = writable(false);
export const onlineUsers = writable<{ id: string; username: string }[]>([]);

export function connectSocket() {
  const u = get(user);
  if (!u) return;

  const s = io(API || undefined, {
    withCredentials: true,
    auth: { token: document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, '$1') },
  });

  s.on('connect', () => connected.set(true));
  s.on('disconnect', () => connected.set(false));
  s.on('onlineList', (users) => onlineUsers.set(users));

  socket.set(s);
  return s;
}

export function disconnectSocket() {
  const s = get(socket);
  if (s) {
    s.disconnect();
    socket.set(null);
    connected.set(false);
  }
}
