/**
 * Resolves the base URL prefixed to every API request.
 *
 * Fails closed. In a deployed (non-dev) build an empty `VITE_API_BASE_URL` is a
 * configuration failure, not a cue to fall back to the relative `/api` path.
 * That fallback used to route through a rewrite in the shared trunk pointing at
 * the **prod** Railway host, so an empty var in the preprod build would have
 * silently pointed the synthetic smoke-test stack at the production API — the
 * outcome ADR-0044 §3 calls non-negotiable to prevent. Vercel baking a
 * Sensitive var as `""` is documented precedent, not a hypothetical (#733).
 *
 * The relative `/api` default survives only in dev / test / Storybook, where the
 * Vite dev-server proxy (or a mock) backs it.
 *
 * `isDev` is a parameter rather than a direct `import.meta.env.DEV` read so the
 * spec can exercise both modes without stubbing the module environment.
 */
export function resolveApiBaseUrl(
  rawBaseUrl: string | undefined,
  isDev: boolean = import.meta.env.DEV,
): string {
  if (rawBaseUrl) return rawBaseUrl;

  if (isDev) return '/api';

  throw new Error(
    'VITE_API_BASE_URL is empty in a deployed build. Refusing to fall back to the ' +
      'relative "/api" path, which must never resolve to another environment\'s API. ' +
      'Set it per Vercel environment — see apps/web/.env.example and ADR-0044 §3.',
  );
}
