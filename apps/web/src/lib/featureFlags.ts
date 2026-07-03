// Env-based feature flags, default-off. To add a flag: pick a VITE_-prefixed
// name (e.g. VITE_FEATURE_SERIES_V2 — Vite only exposes VITE_-prefixed vars
// to the client), read it with isEnabled('VITE_FEATURE_SERIES_V2') at the
// call site, and set it to "true" in the environments where it should be on
// (smoke-test). Leaving it unset anywhere — including prod — keeps it off.

const TRUTHY_VALUES = new Set(['true', '1']);

export function resolveFlag(rawValue: string | undefined): boolean {
  if (!rawValue) return false;
  return TRUTHY_VALUES.has(rawValue.trim().toLowerCase());
}

export function isEnabled(flag: string): boolean {
  return resolveFlag(import.meta.env[flag] as string | undefined);
}
