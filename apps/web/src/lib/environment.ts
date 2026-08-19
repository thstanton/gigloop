// Client-visible environment label — distinct from feature flags (lib/featureFlags.ts),
// which gate behaviour rather than identify where the app is running. Local dev is
// detected via Vite's own DEV flag; preprod via VITE_ENVIRONMENT, set only on the
// preprod Vercel project (see .env.example and docs/environments.md). Prod leaves
// VITE_ENVIRONMENT unset, so this resolves to null there and no label is shown.

export type EnvironmentLabel = 'Local' | 'PreProd';

export function getEnvironmentLabel(): EnvironmentLabel | null {
  if (import.meta.env.DEV) return 'Local';
  if (import.meta.env.VITE_ENVIRONMENT === 'preprod') return 'PreProd';
  return null;
}
