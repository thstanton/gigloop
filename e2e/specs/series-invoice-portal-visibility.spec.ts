import { test, expect } from '@playwright/test';
import { InvoiceStatus } from '@prisma/client';
import { prisma } from '../support/prisma';
import {
  seedSeriesWithDraftInvoice,
  type SeriesWithDraftInvoice,
} from '../support/seed';

// The privacy boundary #848 exists to guard (ADR-0054 amendment, 2026-08-18): a series invoice's
// document has no owning booking, is discoverable from every member booking's Documents card, and
// itemises every other member's fee — so it must never appear on a member booking's *portal*,
// which is exactly the surface the series customer's own client sees, and which may be a
// different client than the member booking's own customer. This is the highest-value spec in the
// series-invoice sweep because it is a leak, not a nicety.
//
// Companion to `series-invoice-send.spec.ts` (#847), which drives the same issue-then-send journey
// on the admin side and stops there. This spec picks up where that one stops: once the invoice is
// SENT, does it leak onto a member's portal? Issuing and sending is arranged here again (rather
// than reused) because the portal check needs a genuinely SENT invoice with a stored document, and
// there is no lighter-weight way to produce one than the real flow.
test.describe('series invoice — never visible on a member booking\'s portal', () => {
  let fixture: SeriesWithDraftInvoice;

  test.beforeEach(async () => {
    fixture = await seedSeriesWithDraftInvoice();
  });

  test.afterEach(async () => {
    // This test issues the invoice, which stores a Document with `invoiceId` set and no
    // `bookingId` (Document.invoice is onDelete: SetNull, so it would otherwise survive the
    // invoice delete below as an orphaned row). Remove it first, then the invoice (which hangs
    // off the series, not a booking, so does not cascade from the booking delete), then the
    // members, then the series (Restrict on customer), then the contact.
    await prisma.document.deleteMany({ where: { invoiceId: fixture.invoiceId } });
    await prisma.invoice.deleteMany({ where: { seriesId: fixture.seriesId } });
    await prisma.booking.deleteMany({ where: { seriesId: fixture.seriesId } });
    await prisma.bookingSeries.deleteMany({ where: { id: fixture.seriesId } });
    await prisma.contact.deleteMany({ where: { id: fixture.customerId } });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('a SENT series invoice document never appears on a member booking\'s portal', async ({ page, browser }) => {
    // --- Arrange: issue and send the series invoice from the admin side (mirrors #847) ---
    await page.goto(`/admin/bookings/${fixture.bookingId}`);

    const mobile = page.getByTestId('booking-detail-mobile');
    await mobile.getByRole('tab', { name: 'Info' }).click();
    const info = mobile.getByRole('tabpanel', { name: 'Info' });
    const invoiceCard = info.getByTestId('series-invoice-card');
    const openInvoiceMenu = () =>
      invoiceCard.getByRole('button', { name: 'Actions', exact: true }).first().click();

    await openInvoiceMenu();
    await page.getByRole('button', { name: 'Create invoice', exact: true }).click();
    await expect
      .poll(async () => (await prisma.invoice.findUnique({ where: { id: fixture.invoiceId } }))?.status)
      .toBe(InvoiceStatus.ISSUED);

    await openInvoiceMenu();
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    const compose = page.getByRole('dialog');
    await expect(compose.getByText('Series invoice email')).toBeVisible();
    const sendBtn = page.getByRole('button', { name: 'Send', exact: true });
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    await expect
      .poll(async () => (await prisma.invoice.findUnique({ where: { id: fixture.invoiceId } }))?.status)
      .toBe(InvoiceStatus.SENT);

    // Sanity check the setup actually produced the leak surface this spec exists to close: a
    // stored series invoice Document, discoverable (musician-side) from the member booking.
    const seriesDoc = await prisma.document.findFirst({ where: { invoiceId: fixture.invoiceId } });
    expect(seriesDoc).not.toBeNull();
    expect(seriesDoc?.bookingId).toBeNull();

    // --- Act: visit the member booking's portal as an anonymous client (a different browser
    // context — the admin page above is authenticated via the project's storageState) ---
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: fixture.bookingId } });
    const portalContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const portalPage = await portalContext.newPage();
    await portalPage.goto(`/booking/${booking.portalToken}`);

    // --- Assert: the SENT series invoice is never shown here, at any state ---
    // The booking title renders as plain visible text in every portal theme (PortalPage.tsx's
    // LightGreeting shows it under the "Hello, …" heading; BoldHero shows it either as the
    // heading itself or alongside it) — asserted by text, not by role, since which element it
    // lands in varies by theme. This is the guard against a blank/errored page making the
    // "Documents" absence assertion below pass vacuously.
    await expect(portalPage.getByText('E2E Residency — night 1')).toBeVisible();
    // This member booking carries no document of its own (no contract, no booking-scoped
    // invoice) — the Documents section renders only if the (wrongly leaked) series document made
    // it into the payload, so its absence is the direct assertion.
    await expect(portalPage.getByText('Documents', { exact: true })).toHaveCount(0);
    await expect(portalPage.getByRole('link', { name: /Invoice/i })).toHaveCount(0);

    await portalContext.close();
  });
});
