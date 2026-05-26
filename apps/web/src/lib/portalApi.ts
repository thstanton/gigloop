import type { PortalData, PortalContractData } from '../types/api';

async function portalFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}

export async function portalGet<T>(path: string): Promise<T> {
  const res = await portalFetch(path);
  if (!res.ok) throw new Response(res.statusText, { status: res.status });
  return res.json() as Promise<T>;
}

export async function portalPost<T>(path: string, body: unknown): Promise<T> {
  const res = await portalFetch(path, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Response(text, { status: res.status });
  }
  return res.json() as Promise<T>;
}

export function getPortalData(token: string): Promise<PortalData> {
  return portalGet<PortalData>(`/booking/${token}`);
}

export function getContractContent(token: string): Promise<PortalContractData> {
  return portalGet<PortalContractData>(`/booking/${token}/contract`);
}

export async function signContract(token: string, signature: string): Promise<void> {
  const res = await portalFetch(`/booking/${token}/sign`, {
    method: 'POST',
    body: JSON.stringify({ signature }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Response(text, { status: res.status });
  }
  // 201 with empty body — no JSON to parse
}
