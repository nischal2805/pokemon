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
  // Disconnect existing socket first (prevents duplicates on re-auth)
  const existing = get(socket);
  if (existing) {
    existing.disconnect();
    socket.set(null);
  }

  const u = get(user);
  if (!u) return;

  const s = io(API || undefined, {
    withCredentials: true,
    auth: { token: document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, '$1') },
  });

  s.on('connect', () => connected.set(true));
  s.on('disconnect', () => connected.set(false));
  s.on('onlineList', (users) => onlineUsers.set(users));

  // Eagerly disconnect on tab close / navigation so the server removes us immediately
  // instead of waiting for the ping timeout
  const onBeforeUnload = () => {
    s.disconnect();
  };
  window.addEventListener('beforeunload', onBeforeUnload);

  // Clean up the listener when the socket is eventually disconnected programmatically
  s.on('disconnect', () => {
    window.removeEventListener('beforeunload', onBeforeUnload);
  });

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
