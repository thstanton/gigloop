export function resolveApiBaseUrl(rawBaseUrl: string | undefined): string {
  return rawBaseUrl || '/api';
}
