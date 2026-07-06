// E2E test mode. When `E2E_TEST_MODE` is truthy the API boots with fake
// implementations of its outbound third-party seams (R2 storage, Resend email,
// Google Maps distance) so the Playwright suite (ADR-0048) can drive the real
// frontend → real API → ephemeral DB without touching real third parties.
//
// This is deliberately *not* a feature flag: it selects DI providers at module
// load, not behaviour at a call site. It reuses `resolveFlag`'s truthy rules
// ("true"/"1", case-insensitive) for consistency with featureFlags.ts.
//
// The real `AuthGuard`/Clerk chain is never faked — exercising it is the whole
// point of the e2e tier (ADR-0048 §3), so `E2E_TEST_MODE` leaves auth untouched.

import { resolveFlag } from './featureFlags';

export const E2E_TEST_MODE_FLAG = 'E2E_TEST_MODE';

export function isE2ETestMode(): boolean {
  return resolveFlag(process.env[E2E_TEST_MODE_FLAG]);
}

/**
 * Pick the fake adapter in e2e test mode, otherwise the real one. Pure in
 * `testMode` so module wiring stays a one-liner and the selection is unit
 * testable without touching `process.env`.
 */
export function pickAdapter<T>(real: T, fake: T, testMode: boolean = isE2ETestMode()): T {
  return testMode ? fake : real;
}
