// Env-based feature flags, default-off. To add a flag: pick a name (e.g.
// FEATURE_SERIES_V2), read it with isEnabled('FEATURE_SERIES_V2') at the
// call site, and set it to "true" in the environments where it should be on
// (smoke-test). Leaving it unset anywhere — including prod — keeps it off.

const TRUTHY_VALUES = new Set(['true', '1']);

export function resolveFlag(rawValue: string | undefined): boolean {
  if (!rawValue) return false;
  return TRUTHY_VALUES.has(rawValue.trim().toLowerCase());
}

export function isEnabled(flag: string): boolean {
  return resolveFlag(process.env[flag]);
}
