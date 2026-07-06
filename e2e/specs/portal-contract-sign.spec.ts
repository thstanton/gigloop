import { test, expect } from '@playwright/test';
import { prisma } from '../support/prisma';
import { seedBookingWithSentContract, type BookingWithSentContract } from '../support/seed';

// The unauthenticated client-facing contract-signing journey (ADR-0048 §7, slice
// 3). The `/booking/:token` portal routes bypass Clerk entirely (CLAUDE.md hard
// rule), so this spec runs with NO storageState — an anonymous browser, exactly
// as a real client arriving from an emailed link. Arrange a booking + a SENT
// contract via direct DB writes, drive the real portal signing UI at 375px, and
// assert the signed state via both the UI (post-sign portal home) and the DB.
test.describe('portal contract signing', () => {
  // Anonymous: the portal token in the path is the only auth these routes accept.
  // Overrides the mobile-chromium project's signed-in storageState.
  test.use({ storageState: { cookies: [], origins: [] } });

  let fixture: BookingWithSentContract;

  test.beforeEach(async () => {
    fixture = await seedBookingWithSentContract();
  });

  test.afterEach(async () => {
    // Deleting the booking cascades its contract + the generated signed-contract
    // document (verified). Then the now-unreferenced customer.
    await prisma.booking.deleteMany({ where: { id: fixture.bookingId } });
    await prisma.contact.deleteMany({ where: { id: fixture.customerId } });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('read → agree → sign the contract', async ({ page }) => {
    await page.goto(`/booking/${fixture.portalToken}/contract`);

    // Guard the bypass-auth property this spec exists to cover: the browser is
    // genuinely anonymous (no Clerk session cookie), not silently signed in via a
    // leaked project storageState. Without this, a broken storageState override
    // would still go green because the portal renders either way.
    const cookies = await page.context().cookies();
    const clerkCookie = cookies.find(
      (c) => c.name.startsWith('__session') || c.name.startsWith('__clerk') || c.name.startsWith('__client'),
    );
    expect(clerkCookie, `expected no Clerk cookie, found ${clerkCookie?.name}`).toBeUndefined();

    // The contract renders; the CTA is gated until the client agrees and signs.
    await expect(
      page.getByRole('heading', { name: 'E2E Contract-Sign Booking', level: 1 }),
    ).toBeVisible();

    // Agree → reveals the signature section (Type mode by default).
    await page.getByRole('checkbox', { name: 'I have read and agree to the terms above' }).check();
    // A typed name renders to a canvas → base64 PNG signature, which enables the CTA.
    await page.getByRole('textbox', { name: 'Type your full name' }).fill('Jane Client');

    await page.getByRole('button', { name: 'Sign contract' }).click();

    // On success the portal shows a brief confirmation then redirects to the
    // booking home — assert the durable signed state there rather than racing the
    // transient "Contract signed" screen.
    await page.waitForURL(new RegExp(`/booking/${fixture.portalToken}$`));
    await expect(page.getByText(/Contract signed/)).toBeVisible();
    // The signed-contract PDF was generated + stored (→ fake storage in test mode).
    await expect(page.getByRole('link', { name: 'Signed contract' })).toBeVisible();

    // DB: the contract is now SIGNED, with a captured signature + timestamp.
    const contract = await prisma.contract.findUnique({ where: { id: fixture.contractId } });
    expect(contract?.status).toBe('SIGNED');
    expect(contract?.signedAt).not.toBeNull();
    expect(contract?.signatureDataUrl?.startsWith('data:image/png')).toBe(true);
  });
});
