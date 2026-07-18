import { test, expect } from '@playwright/test';
import { Prisma } from '@prisma/client';
import { prisma, E2E_TEST_USER_ID } from '../support/prisma';
import { setOnboardingIncomplete, restoreOnboardingComplete } from '../support/seed';

// The onboarding activation flow (ADR-0048 §7, slice 6). The #478 rework turned onboarding into a
// create-real-artifacts money path: Step 3 POSTs a PackageTemplate seeded from a read-only catalogue
// starter, Step 5 POSTs a Song, and the final step POSTs completion + redirects to /admin. No other
// tier drives this across the real Clerk→API→DB stack.
//
// The shared baseline user is onboarding-COMPLETED (so AdminLayout renders the app); this spec flips
// it incomplete to reach the wizard, acts through the five steps at 375px, asserts via UI + DB, then
// restores the baseline in afterEach so the remaining authed specs aren't bounced into onboarding.
test.describe('onboarding flow', () => {
  test.beforeEach(async () => {
    // Reach the wizard, and start from a clean library so the DB assertions below are unambiguous
    // (packages/songs are no longer auto-seeded since #663, so an empty library is the natural state).
    await prisma.packageTemplate.deleteMany({ where: { userId: E2E_TEST_USER_ID } });
    await prisma.song.deleteMany({ where: { userId: E2E_TEST_USER_ID } });
    await setOnboardingIncomplete();
  });

  test.afterEach(async () => {
    // Always restore the shared baseline (even if an assertion threw) so later authed specs render the
    // app rather than the wizard; drop the artifacts this run created and the portal config Step 4 set.
    await prisma.packageTemplate.deleteMany({ where: { userId: E2E_TEST_USER_ID } });
    await prisma.song.deleteMany({ where: { userId: E2E_TEST_USER_ID } });
    await prisma.publicProfile.updateMany({
      where: { userId: E2E_TEST_USER_ID },
      data: { clientPortalConfig: Prisma.JsonNull },
    });
    await restoreOnboardingComplete();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('walk all five steps → create real artifacts → land in the app', async ({ page }) => {
    // --- Step 1 — Business (required). Being on this page proves the incomplete-gate kept us here. ---
    await page.goto('/onboarding/profile');
    await expect(page.getByRole('heading', { name: 'Set up your business', level: 1 })).toBeVisible();
    // Fill the required field with the baseline value → exercises PATCH /me/public without drifting the
    // shared PublicProfile identity that invoice-PDF specs rely on.
    await page.getByLabel('Business name').fill('E2E Test Band');
    await page.getByRole('button', { name: 'Next' }).click();

    // --- Step 2 — Bookings orientation (no required input; advance). ---
    await expect(page.getByRole('heading', { name: 'How GigLoop runs your bookings', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    // --- Step 3 — configure ONE Package Template from a catalogue starter. ---
    await expect(page.getByRole('heading', { name: 'What you offer', level: 1 })).toBeVisible();
    // "Wedding Ceremony" is the first SYSTEM_DEFAULT starter (packages.service.ts), guaranteed present.
    // Picking it reveals the inline editor and enables "Save & continue".
    await page.getByRole('button', { name: 'Wedding Ceremony' }).click();
    await page.getByRole('button', { name: 'Save & continue' }).click();
    // DB: POST /packages created exactly the one template we shaped.
    await expect
      .poll(() => prisma.packageTemplate.count({ where: { userId: E2E_TEST_USER_ID, label: 'Wedding Ceremony' } }))
      .toBe(1);

    // --- Step 4 — Portal & branding (advance with defaults → PATCH /me/public clientPortalConfig). ---
    await expect(page.getByRole('heading', { name: 'Your portal & branding', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Save & continue' }).click();

    // --- Step 5 — add a first song (manual entry, deterministic) + Finish. ---
    await expect(page.getByRole('heading', { name: 'Communicating with your clients', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Enter it manually' }).click();
    await page.getByLabel('Title').fill('E2E Onboarding Song');
    await page.getByRole('button', { name: 'Add song' }).click();
    // The title renders in the Repertoire list only after POST /songs resolves (the page appends the
    // returned Song), so its visibility is the UI proof the create succeeded.
    await expect(page.getByText('E2E Onboarding Song').first()).toBeVisible();
    await page.getByRole('button', { name: 'Finish' }).click();

    // --- Completion — POST /me/onboarding/complete redirects into the app. ---
    await page.waitForURL(/\/admin/);
    // DB proof: the song persisted, and the completion flag is stamped.
    await expect
      .poll(() => prisma.song.count({ where: { userId: E2E_TEST_USER_ID, title: 'E2E Onboarding Song' } }))
      .toBe(1);
    const profile = await prisma.userProfile.findUnique({ where: { userId: E2E_TEST_USER_ID } });
    expect(profile?.onboardingCompletedAt).not.toBeNull();
  });
});
