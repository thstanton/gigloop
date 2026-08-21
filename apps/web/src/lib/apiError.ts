// A real error type for a failed API response (#768), replacing the bare `Response` that
// api.ts/portalApi.ts used to throw. `Response` has no `.message`, so callers could only branch
// on `.status` and hand-roll their own copy — this reads the API's own JSON error body (NestJS's
// `{ message: string | string[] }` shape) so `err.message` carries something true, falling back
// to `res.statusText` when the body isn't JSON or carries no message.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function extractMessage(body: unknown, fallback: string): string {
  const rawMessage =
    body && typeof body === 'object' && 'message' in body
      ? (body as { message?: unknown }).message
      : undefined;

  if (Array.isArray(rawMessage)) return rawMessage.join(', ') || fallback;
  if (typeof rawMessage === 'string' && rawMessage) return rawMessage;
  return fallback;
}

export async function toApiError(res: Response): Promise<ApiError> {
  const body: unknown = await res.json().catch(() => null);
  // HTTP/2 (Vercel, Railway) drops the reason phrase, so statusText is '' for a non-API failure
  // (platform 502, proxy 401) that never reaches NestJS's exception filter to set a real message.
  const fallback = res.statusText || `Request failed (${res.status})`;
  return new ApiError(res.status, extractMessage(body, fallback), body);
}
