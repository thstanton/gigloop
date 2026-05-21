// Clerk sets window.Clerk when ClerkProvider initialises. Loaders use this
// to attach auth tokens without requiring React hooks.
declare global {
  interface Window {
    Clerk?: { session?: { getToken(): Promise<string | null> } };
  }
}

async function getToken(): Promise<string | null> {
  return window.Clerk?.session?.getToken() ?? null;
}

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getToken();
  return fetch(`/api${path}`, {
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

export async function apiDelete(path: string): Promise<void> {
  const res = await authedFetch(path, { method: 'DELETE' });
  if (!res.ok) throw new Response(res.statusText, { status: res.status });
}
