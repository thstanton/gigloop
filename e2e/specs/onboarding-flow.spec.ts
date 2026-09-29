import { test, expect } from '@playwright/test';
import { Prisma } from '@prisma/client';
import { prisma, E2E_TEST_USER_ID } from '../support/prisma';
import { seedContact, setOnboardingIncomplete, restoreOnboardingComplete } from '../support/seed';

// The onboarding activation flow (ADR-0048 §7, slice 6). The #478 rework turned onboarding into a
// create-real-artifacts money path: Step 3 POSTs a PackageTemplate seeded from a read-only catalogue
// starter, Step 5 POSTs a Song, and the final step POSTs completion + redirects to /admin. No other
// tier drives this across the real Clerk→API→DB stack.
//
// The shared baseline user is onboarding-COMPLETED (so AdminLayout renders the app); this spec flips
// it incomplete to reach the wizard, acts through the five steps at 375px, asserts via UI + DB, then
// restores the baseline in afterEach so the remaining authed specs aren't bounced into onboarding.
test.describe('onboarding flow', () => {
  let originalPreferences: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  let createdBookingId: string | undefined;
  let createdContactId: string | undefined;

  test.beforeEach(async () => {
    // Reach the wizard, and start from a clean library so the DB assertions below are unambiguous
    // (packages/songs are no longer auto-seeded since #663, so an empty library is the natural state).
    await prisma.packageTemplate.deleteMany({ where: { userId: E2E_TEST_USER_ID } });
    await prisma.lineupTemplate.deleteMany({ where: { userId: E2E_TEST_USER_ID } });
    await prisma.song.deleteMany({ where: { userId: E2E_TEST_USER_ID } });
    const profile = await prisma.userProfile.findUnique({
      where: { userId: E2E_TEST_USER_ID },
      select: { preferences: true },
    });
    originalPreferences = (profile?.preferences as Prisma.InputJsonValue | null) ?? Prisma.JsonNull;
    await prisma.userProfile.update({
      where: { userId: E2E_TEST_USER_ID },
      data: { preferences: Prisma.JsonNull },
    });
    createdBookingId = undefined;
    createdContactId = undefined;
    await setOnboardingIncomplete();
  });

  test.afterEach(async () => {
    // Always restore the shared baseline (even if an assertion threw) so later authed specs render the
    // app rather than the wizard; drop the artifacts this run created and the portal config Step 4 set.
    if (createdBookingId) await prisma.booking.deleteMany({ where: { id: createdBookingId } });
    if (createdContactId) await prisma.contact.deleteMany({ where: { id: createdContactId } });
    await prisma.packageTemplate.deleteMany({ where: { userId: E2E_TEST_USER_ID } });
    await prisma.lineupTemplate.deleteMany({ where: { userId: E2E_TEST_USER_ID } });
    await prisma.song.deleteMany({ where: { userId: E2E_TEST_USER_ID } });
    await prisma.publicProfile.updateMany({
      where: { userId: E2E_TEST_USER_ID },
      data: { clientPortalConfig: Prisma.JsonNull },
    });
    // #1019: Step 1's address write lands on both models — clear both so the baseline
    // profile stays addressless for later authed specs.
    await prisma.userProfile.updateMany({
      where: { userId: E2E_TEST_USER_ID },
      data: {
        addressLine1: null,
        travelBaseAddressLine1: null,
        preferences: originalPreferences,
      },
    });
    await restoreOnboardingComplete();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('walk all five steps → create real artifacts → land in the app', async ({ page }) => {
    // Block the Google Places script: this env's Maps key/network access isn't guaranteed, and the
    // address field's manual-entry fallback (same fields either way) is what makes Step 1 deterministic.
    await page.route('https://maps.googleapis.com/**', (route) => route.abort());

    // --- Step 1 — Business (required). Being on this page proves the incomplete-gate kept us here. ---
    await page.goto('/onboarding/profile');
    await expect(page.getByRole('heading', { name: 'Set up your business', level: 1 })).toBeVisible();
    // Fill the required field with the baseline value → exercises PATCH /me/public without drifting the
    // shared PublicProfile identity that invoice-PDF specs rely on.
    await page.getByLabel('Business name').fill('E2E Test Band');
    // #1019: the one address given here must land on BOTH the business address and the Travel Base.
    await page.getByPlaceholder('123 High Street').fill('42 Test Street');
    await page.getByRole('button', { name: 'Next' }).click();

    // --- Step 2 — Bookings orientation (no required input; advance). ---
    await expect(page.getByRole('heading', { name: 'How GigLoop runs your bookings', level: 1 })).toBeVisible();
    // DB: Step 1's single address wrote to both models (#1019) — never just one.
    const profileAfterStep1 = await prisma.userProfile.findUnique({ where: { userId: E2E_TEST_USER_ID } });
    expect(profileAfterStep1?.addressLine1).toBe('42 Test Street');
    expect(profileAfterStep1?.travelBaseAddressLine1).toBe('42 Test Street');
    await page.getByRole('button', { name: 'Next' }).click();

    // --- Step 3 — configure a package and the usual band lineup from catalogue starters. ---
    await expect(page.getByRole('heading', { name: 'What you offer', level: 1 })).toBeVisible();
    // "Wedding Ceremony" is the first SYSTEM_DEFAULT starter (packages.service.ts), guaranteed present.
    // Picking it reveals the inline editor and enables "Save & continue".
    await page.getByRole('button', { name: 'Wedding Ceremony' }).click();
    await page.getByRole('button', { name: 'I play with other musicians' }).click();
    await page.getByPlaceholder('e.g. My five-piece').fill('E2E Usual Lineup');
    await page.getByRole('button', { name: '+ Add part' }).click();
    await page.getByPlaceholder('e.g. Saxophone').fill('Saxophone');
    await page.getByRole('button', { name: '+ Add part' }).click();
    await page.getByPlaceholder('e.g. Saxophone').nth(1).fill('Drums');
    await page.getByRole('button', { name: 'Save & continue' }).click();
    // DB: the lineup and package were created together, with the package pointing at that lineup.
    await expect
      .poll(() => prisma.packageTemplate.count({ where: { userId: E2E_TEST_USER_ID, label: 'Wedding Ceremony' } }))
      .toBe(1);
    const lineup = await prisma.lineupTemplate.findFirst({
      where: { userId: E2E_TEST_USER_ID, label: 'E2E Usual Lineup' },
      include: { slots: { orderBy: { order: 'asc' } } },
    });
    expect(lineup?.slots.map((slot) => slot.role)).toEqual(['Saxophone', 'Drums']);
    const packageTemplate = await prisma.packageTemplate.findFirst({
      where: { userId: E2E_TEST_USER_ID, label: 'Wedding Ceremony' },
    });
    expect(packageTemplate?.defaultLineupTemplateId).toBe(lineup?.id);

    // Re-enter the step before finishing onboarding. The saved lineup is offered for reuse instead
    // of creating another copy, and the second package binds to the same template.
    await page.goto('/onboarding/packages');
    await page.getByRole('button', { name: 'Corporate Dinner' }).click();
    await page.getByRole('button', { name: 'I play with other musicians' }).click();
    await expect(page.getByRole('button', { name: 'E2E Usual Lineup' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Save & continue' }).click();
    await expect
      .poll(() => prisma.lineupTemplate.count({ where: { userId: E2E_TEST_USER_ID, label: 'E2E Usual Lineup' } }))
      .toBe(1);
    // The lineup count above is already 1 before the click lands, so it proves nothing about the
    // second POST — wait for the package itself.
    await expect
      .poll(async () =>
        (await prisma.packageTemplate.findFirst({ where: { userId: E2E_TEST_USER_ID, label: 'Corporate Dinner' } }))
          ?.defaultLineupTemplateId,
      )
      .toBe(lineup?.id);

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

  test('solo answer disables both band goals for a booking created afterwards', async ({ page }) => {
    await page.goto('/onboarding/profile');
    await page.getByLabel('Business name').fill('E2E Test Band');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByRole('heading', { name: 'What you offer', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Wedding Ceremony' }).click();
    await page.getByRole('button', { name: 'Just me' }).click();
    await page.getByRole('button', { name: 'Save & continue' }).click();

    // "Save & continue" fires the preference PATCH asynchronously — poll rather than read once.
    await expect
      .poll(async () => {
        const profile = await prisma.userProfile.findUnique({ where: { userId: E2E_TEST_USER_ID } });
        const preferences = profile?.preferences as {
          checklistDefaults?: { systemItemOverrides?: Array<{ key: string; enabled?: boolean }> };
        } | null;
        return preferences?.checklistDefaults?.systemItemOverrides;
      })
      .toEqual(
        expect.arrayContaining([
          { key: 'get_the_band_confirmed', enabled: false },
          { key: 'get_the_band_briefed', enabled: false },
        ]),
      );

    // Finish onboarding, then create a booking through the real New Booking form.
    await page.getByRole('button', { name: 'Save & continue' }).click();
    await page.getByRole('button', { name: 'Finish' }).click();
    await page.waitForURL(/\/admin$/);

    const customer = await seedContact();
    createdContactId = customer.id;
    await page.goto('/admin/bookings/new');
    await page.getByRole('button', { name: 'Pick a date' }).click();
    await page.getByRole('button', { name: 'Next month' }).click();
    const target = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 15);
    const dayLabel = target.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    await page.getByRole('button', { name: dayLabel, exact: true }).click();
    await page.getByRole('spinbutton', { name: 'Fee' }).fill('500');
    await page.getByRole('textbox', { name: 'Title' }).fill('E2E Solo Booking');
    await page.getByRole('radio', { name: 'Confirmed', exact: true }).click();
    await page.getByRole('tab', { name: 'Select existing' }).first().click();
    await page.getByRole('combobox', { name: 'Select customer...' }).click();
    await page.getByRole('combobox', { name: 'Search or create new customer' }).fill(customer.name);
    await page.getByRole('option', { name: customer.name }).click();
    await page.getByRole('button', { name: 'Next: Reminders' }).click();
    await page.getByRole('button', { name: 'Create booking' }).click();
    await page.getByRole('button', { name: 'Finish' }).click();
    await page.waitForURL(/\/admin\/bookings\/[0-9a-f-]{36}$/);
    createdBookingId = page.url().split('/').pop();
    expect(createdBookingId).toBeTruthy();

    // The opt-out applies to future bookings, so neither band goal is seeded here.
    const bandGoals = await prisma.bookingChecklistItem.count({
      where: {
        bookingId: createdBookingId,
        key: { in: ['get_the_band_confirmed', 'get_the_band_briefed'] },
      },
    });
    expect(bandGoals).toBe(0);
  });

  test('skipping band setup leaves checklist defaults alone and records a dashboard tip precondition', async ({ page }) => {
    await page.goto('/onboarding/profile');
    await page.getByLabel('Business name').fill('E2E Test Band');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByRole('button', { name: 'Wedding Ceremony' }).click();
    await page.getByRole('button', { name: 'Save & continue' }).click();

    // Async PATCH after "Save & continue" — poll for the skip flag before asserting what it left alone.
    await expect
      .poll(async () => {
        const profile = await prisma.userProfile.findUnique({ where: { userId: E2E_TEST_USER_ID } });
        return (profile?.preferences as Record<string, unknown> | null)?.onboardingSkippedBandSetup;
      })
      .toBe(true);
    const profile = await prisma.userProfile.findUnique({ where: { userId: E2E_TEST_USER_ID } });
    expect((profile?.preferences as Record<string, unknown>).checklistDefaults).toBeUndefined();
    expect(await prisma.lineupTemplate.count({ where: { userId: E2E_TEST_USER_ID } })).toBe(0);
  });

  test('Step 1 with no address writes neither field and still advances', async ({ page }) => {
    await page.goto('/onboarding/profile');
    await expect(page.getByRole('heading', { name: 'Set up your business', level: 1 })).toBeVisible();
    await page.getByLabel('Business name').fill('E2E Test Band');
    await page.getByRole('button', { name: 'Next' }).click();

    // Leaving the address blank must not block the step (#1019).
    await expect(page.getByRole('heading', { name: 'How GigLoop runs your bookings', level: 1 })).toBeVisible();
    const profile = await prisma.userProfile.findUnique({ where: { userId: E2E_TEST_USER_ID } });
    expect(profile?.addressLine1).toBeNull();
    expect(profile?.travelBaseAddressLine1).toBeNull();
  });
});
