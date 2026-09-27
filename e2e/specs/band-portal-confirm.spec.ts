import { test, expect } from '@playwright/test';
import { prisma } from '../support/prisma';
import { seedBandMemberWithPortalToken, type BandMemberWithPortalToken } from '../support/seed';

// The dep's one-shot band-portal response (#892, ADR-0074 §4). Same class as
// portal-contract-sign.spec.ts: `/band/:token` bypasses Clerk entirely (CLAUDE.md hard rule), so
// the dep's half of this journey runs in its own anonymous browser context (mirrors
// series-invoice-portal-visibility.spec.ts's `browser.newContext`, rather than overriding the
// whole test's storageState) — the organiser's half needs the project's authenticated `page` to
// check the roster afterwards. Requires FEATURE_BAND_MEMBERS on (playwright.config.ts sets it for
// the local webServer).
test.describe('band portal confirm', () => {
  let fixture: BandMemberWithPortalToken;

  test.beforeEach(async () => {
    fixture = await seedBandMemberWithPortalToken();
  });

  test.afterEach(async () => {
    await prisma.booking.deleteMany({ where: { id: fixture.bookingId } });
    await prisma.contact.deleteMany({ where: { id: { in: [fixture.contactId, fixture.customerId] } } });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('a dep opens the link, confirms, and the organiser roster reflects it', async ({ page, browser }) => {
    // --- Act: the dep opens the portal link as an anonymous client ---
    const portalContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const portalPage = await portalContext.newPage();
    await portalPage.goto(`/band/${fixture.bandPortalToken}`);

    // Guard the bypass-auth property this spec exists to cover, exactly as
    // portal-contract-sign.spec.ts does for /booking/:token.
    const cookies = await portalContext.cookies();
    const clerkCookie = cookies.find(
      (c) => c.name.startsWith('__session') || c.name.startsWith('__clerk') || c.name.startsWith('__client'),
    );
    expect(clerkCookie, `expected no Clerk cookie, found ${clerkCookie?.name}`).toBeUndefined();

    await expect(portalPage.getByRole('heading', { name: 'E2E Band Portal Confirm Booking' })).toBeVisible();

    // Unanswered — the sticky response bar offers both actions, usable at 375px (the
    // mobile-chromium project's default viewport).
    await expect(portalPage.getByText('Are you in for this gig?')).toBeVisible();
    await portalPage.getByRole('button', { name: 'Confirm' }).click();

    // One-shot: the bar now shows the answer and offers no way to change it.
    await expect(portalPage.getByText("You've confirmed you're playing this gig.")).toBeVisible();
    await expect(portalPage.getByRole('button', { name: 'Confirm' })).not.toBeVisible();
    await expect(portalPage.getByRole('button', { name: 'Decline' })).not.toBeVisible();

    // A reload proves the state is durable server-side, not just an optimistic client flag.
    await portalPage.reload();
    await expect(portalPage.getByText("You've confirmed you're playing this gig.")).toBeVisible();

    // DB: status flipped and respondedAt stamped.
    const member = await prisma.bookingBandMember.findUnique({ where: { id: fixture.memberId } });
    expect(member?.status).toBe('CONFIRMED');
    expect(member?.respondedAt).not.toBeNull();

    await portalContext.close();

    // --- Assert: the organiser's own roster (the Band sheet) reflects the dep's answer ---
    await page.goto(`/admin/bookings/${fixture.bookingId}?sheet=band`);
    await expect(page.getByRole('button', { name: 'Status for E2E Band Portal Dep' })).toHaveText('Confirmed');
  });
});
