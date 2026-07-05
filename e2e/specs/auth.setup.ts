import { test as setup, expect } from '@playwright/test';
import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';
import { STORAGE_STATE } from '../support/paths';

// The `setup` project (playwright.config projects[]). Runs once, after the web
// server is up, and signs the dedicated test user in against the *real* Clerk
// dev instance + real AuthGuard (ADR-0048 §3). The resulting session is saved to
// STORAGE_STATE and reused by every spec, so no test re-signs-in.
setup('authenticate the test user', async ({ page }) => {
  await setupClerkTestingToken({ page });

  // Load the app so ClerkProvider mounts, and wait for Clerk to be ready
  // before driving the sign-in.
  await page.goto('/');
  await clerk.loaded({ page });

  await clerk.signIn({
    page,
    signInParams: {
      strategy: 'password',
      identifier: process.env.E2E_CLERK_USER_EMAIL ?? '',
      password: process.env.E2E_CLERK_USER_PASSWORD ?? '',
    },
  });

  // Confirm we actually reached an authenticated admin screen before persisting.
  await page.goto('/admin/bookings');
  await expect(page.getByRole('link', { name: 'Bookings' })).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
