import type { PortalData, PortalContractData, PortalMusicFormData, SubmitMusicFormInput, BandPortalData } from '../types/api';
import { resolveApiBaseUrl } from './apiBaseUrl';
import { toApiError } from './apiError';

export { ApiError } from './apiError';

const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

async function portalFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}

export async function portalGet<T>(path: string): Promise<T> {
  const res = await portalFetch(path);
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}

export async function portalPost<T>(path: string, body: unknown): Promise<T> {
  const res = await portalFetch(path, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}

export function getPortalData(token: string): Promise<PortalData> {
  return portalGet<PortalData>(`/booking/${token}`);
}

export function getBandPortalData(token: string): Promise<BandPortalData> {
  return portalGet<BandPortalData>(`/band/${token}`);
}

export function respondToBandInvite(
  token: string,
  response: 'CONFIRMED' | 'DECLINED',
): Promise<BandPortalData> {
  return portalPost<BandPortalData>(`/band/${token}/respond`, { response });
}

// The call sheet (#893, ADR-0073 §4) is generated on demand and streamed directly — a plain link,
// not a fetch-then-blob dance, because the route is `@Public()` (the token in the path is the
// auth) and there is no stored object to resolve first.
export function getBandCallSheetUrl(token: string): string {
  return `${API_BASE_URL}/band/${token}/call-sheet`;
}

export function getContractContent(token: string): Promise<PortalContractData> {
  return portalGet<PortalContractData>(`/booking/${token}/contract`);
}

export function getMusicFormData(token: string): Promise<PortalMusicFormData> {
  return portalGet<PortalMusicFormData>(`/booking/${token}/music`);
}

export async function submitMusicForm(token: string, body: SubmitMusicFormInput): Promise<void> {
  const res = await portalFetch(`/booking/${token}/music`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await toApiError(res);
}

export async function signContract(token: string, signature: string): Promise<void> {
  const res = await portalFetch(`/booking/${token}/sign`, {
    method: 'POST',
    body: JSON.stringify({ signature }),
  });
  if (!res.ok) throw await toApiError(res);
  // 201 with empty body — no JSON to parse
}
