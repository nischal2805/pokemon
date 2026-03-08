import { writable, derived } from 'svelte/store';

interface User {
  id: string;
  username: string;
}

export const user = writable<User | null>(null);
export const isLoggedIn = derived(user, ($u) => $u !== null);

/** True while the initial fetchMe() is still in flight */
export const authLoading = writable(true);

// In Docker behind nginx, VITE_SERVER_URL is empty → same-origin requests.
// In dev, it falls back to localhost:3001.
const API = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

/**
 * Low-level fetch wrapper with credentials. Returns the raw Response.
 */
export async function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opts.headers as Record<string, string> },
    ...opts,
  });
}

/**
 * Fetch + parse JSON, throw on error. Used for auth routes.
 */
async function apiJson(path: string, opts: RequestInit = {}) {
  const res = await apiFetch(path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export async function login(username: string, password: string) {
  const data = await apiJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  user.set(data.user);
  return data;
}

export async function register(username: string, password: string, inviteCode?: string) {
  const data = await apiJson('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, inviteCode }),
  });
  user.set(data.user);
  return data;
}

export async function logout() {
  try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch {}
  user.set(null);
}

export async function fetchMe() {
  try {
    const data = await apiJson('/api/auth/me');
    user.set(data.user);
  } catch {
    user.set(null);
  } finally {
    authLoading.set(false);
  }
}
