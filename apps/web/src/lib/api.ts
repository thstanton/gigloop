import { resolveApiBaseUrl } from './apiBaseUrl';
import { toApiError } from './apiError';

export { ApiError } from './apiError';

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
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}

export async function apiGetBlob(path: string): Promise<Blob> {
  const res = await authedFetch(path);
  if (!res.ok) throw await toApiError(res);
  return res.blob();
}

// Open a PDF the API *generates on demand* (an invoice preview) in a new tab. The endpoint
// streams bytes and needs the Clerk bearer token, so a raw window.open() to it 401s: fetch the
// PDF with auth, then point the tab at an object URL. The blank tab is opened synchronously to
// preserve the user gesture, so the popup blocker doesn't eat it during the async fetch.
//
// This is the generated-PDF twin of {@link openDocument}, which resolves a *stored* document.
// Shared by the booking and series invoice surfaces (#830) — it was previously inline in
// InvoiceSection, and copying it to the series card is what this exists to prevent.
export function openGeneratedPdf(path: string, onError?: () => void): void {
  const win = window.open('', '_blank');
  apiGetBlob(path)
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      if (win) win.location.href = url;
      else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    })
    .catch(() => {
      win?.close();
      onError?.();
    });
}

// Open an access-controlled document (ADR-0059, #654). A document's `url` is now
// an app route, not a public URL — we fetch it WITH the Clerk JWT to resolve the
// real storage URL, then navigate the browser to it. A blank tab is opened
// synchronously first so the navigation survives the async resolve without
// tripping the popup blocker (mirrors the invoice-preview flow). `onError` lets
// the caller surface a toast on failure.
export function openDocument(appRoute: string, onError?: () => void): void {
  const win = window.open('', '_blank');
  apiGet<{ url: string }>(appRoute)
    .then(({ url }) => {
      if (win) win.location.href = url;
      else window.open(url, '_blank', 'noopener,noreferrer');
    })
    .catch(() => {
      win?.close();
      onError?.();
    });
}

export async function apiGetNullable<T>(path: string): Promise<T | null> {
  const res = await authedFetch(path);
  if (res.status === 404) return null;
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await authedFetch(path, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await authedFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await authedFetch(path, { method: 'PUT', body: JSON.stringify(body) });
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}

export async function apiPostVoid(path: string, body: unknown): Promise<void> {
  const res = await authedFetch(path, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw await toApiError(res);
}

export async function apiDelete(path: string): Promise<void> {
  const res = await authedFetch(path, { method: 'DELETE' });
  if (!res.ok) throw await toApiError(res);
}

export async function apiPostFormData<T>(path: string, formData: FormData): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}
