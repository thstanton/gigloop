import { resolveApiBaseUrl } from './apiBaseUrl';

// Clerk sets window.Clerk when ClerkProvider initialises. Loaders use this
// to attach auth tokens without requiring React hooks.
declare global {
  interface Window {
    Clerk?: { session?: { getToken(): Promise<string | null> } };
  }
}

const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

async function getToken(): Promise<string | null> {
  return window.Clerk?.session?.getToken() ?? null;
}

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getToken();
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await authedFetch(path);
  if (!res.ok) throw new Response(res.statusText, { status: res.status });
  return res.json() as Promise<T>;
}

export async function apiGetBlob(path: string): Promise<Blob> {
  const res = await authedFetch(path);
  if (!res.ok) throw new Response(res.statusText, { status: res.status });
  return res.blob();
}

export async function apiGetNullable<T>(path: string): Promise<T | null> {
  const res = await authedFetch(path);
  if (res.status === 404) return null;
  if (!res.ok) throw new Response(res.statusText, { status: res.status });
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await authedFetch(path, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw new Response(res.statusText, { status: res.status });
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await authedFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
  if (!res.ok) throw new Response(res.statusText, { status: res.status });
  return res.json() as Promise<T>;
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await authedFetch(path, { method: 'PUT', body: JSON.stringify(body) });
  if (!res.ok) throw new Response(res.statusText, { status: res.status });
  return res.json() as Promise<T>;
}

export async function apiPostVoid(path: string, body: unknown): Promise<void> {
  const res = await authedFetch(path, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw new Response(res.statusText, { status: res.status });
}

export async function apiDelete(path: string): Promise<void> {
  const res = await authedFetch(path, { method: 'DELETE' });
  if (!res.ok) throw new Response(res.statusText, { status: res.status });
}

export async function apiPostFormData<T>(path: string, formData: FormData): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Response(res.statusText, { status: res.status });
  return res.json() as Promise<T>;
}
