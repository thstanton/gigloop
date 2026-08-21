import { test, expect } from '@playwright/test';
import { InvoiceStatus, CommunicationStatus } from '@prisma/client';
import { prisma } from '../support/prisma';
import {
  seedSeriesWithDraftInvoice,
  type SeriesWithDraftInvoice,
} from '../support/seed';

// The series-invoice *send* journey (#847). Companion to `series-invoice-edit.spec.ts` (#845),
// which stops at issue, and to `invoice-money-path.spec.ts`, whose booking invoice reaches the
// compose sheet through an entirely booking-scoped path.
//
// This journey did not previously exist either: the series card's Send opened the compose sheet
// asking for `balance_invoice_cover`, which the sheet resolved against the *member booking's*
// invoice list. That list is always empty for a series member, so the musician got a sheet with
// the template hidden and nothing attached — a series invoice could not be sent from the UI at
// all. The assertion that matters is that the invoice actually reaches SENT, which only a real
// send through the real compose surface can produce.
test.describe('series invoice — issue and send', () => {
  let fixture: SeriesWithDraftInvoice;

  test.beforeEach(async () => {
    fixture = await seedSeriesWithDraftInvoice();
  });

  test.afterEach(async () => {
    // The series invoice hangs off the series, not a booking, so it does not cascade from the
    // booking delete. Remove it first, then the members, then the series (Restrict on customer),
    // then the contact.
    await prisma.invoice.deleteMany({ where: { seriesId: fixture.seriesId } });
    await prisma.booking.deleteMany({ where: { seriesId: fixture.seriesId } });
    await prisma.bookingSeries.deleteMany({ where: { id: fixture.seriesId } });
    await prisma.contact.deleteMany({ where: { id: fixture.customerId } });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('issue a series invoice, then send its cover email', async ({ page }) => {
    await page.goto(`/admin/bookings/${fixture.bookingId}`);

    // Both layouts are in the DOM (the desktop one flashes in before unmounting at 375px), so
    // scope page-content queries to the mobile boundary. Sheets and the RowActions bottom sheet
    // portal to the body and are queried at page level.
    const mobile = page.getByTestId('booking-detail-mobile');
    await mobile.getByRole('tab', { name: 'Info' }).click();
    const info = mobile.getByRole('tabpanel', { name: 'Info' });

    // A series member shows the shared Series Invoice card in place of the booking invoice list.
    // Scoped to that card: the Bookings-in-Series card above it exposes an overflow trigger with
    // the same accessible name, so an unscoped `.first()` opens the wrong sheet. `.first()` within
    // the card because the row re-renders transiently while a status mutation refetches.
    const invoiceCard = info.getByTestId('series-invoice-card');
    const openInvoiceMenu = () =>
      invoiceCard.getByRole('button', { name: 'Actions', exact: true }).first().click();

    // --- Issue the draft: sending is only offered once a PDF has been stored ---
    await openInvoiceMenu();
    await page.getByRole('button', { name: 'Create invoice', exact: true }).click();
    await expect
      .poll(async () => (await prisma.invoice.findUnique({ where: { id: fixture.invoiceId } }))?.status)
      .toBe(InvoiceStatus.ISSUED);

    // --- Send it ---
    await openInvoiceMenu();
    await page.getByRole('button', { name: 'Send', exact: true }).click();

    const compose = page.getByRole('dialog');

    // The series cover is selected and visible — not hidden because a booking-scoped list is
    // empty — and it is addressed to the *series* customer.
    await expect(compose.getByText('Series invoice email')).toBeVisible();
    await expect(compose.getByText('E2E Residency Client')).toBeVisible();

    // The attachment is the series invoice's stored PDF, named from the number just allocated.
    const issued = await prisma.invoice.findUnique({ where: { id: fixture.invoiceId } });
    await expect(compose.getByText(`Invoice ${issued?.invoiceNumber}.pdf`)).toBeVisible();

    // Rendered with the *series* context: the subject names the series, which only
    // `buildSeriesContext` can supply — the booking-shaped context has no seriesLabel, so this
    // would have fallen back. The subject is the sheet's only text input once the invoice is
    // ISSUED (the draft date fields are gone).
    await expect(compose.locator('input[type="text"]').first()).toHaveValue(/E2E Hotel Residency/);

    const sendBtn = page.getByRole('button', { name: 'Send', exact: true });
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    await expect
      .poll(async () => (await prisma.invoice.findUnique({ where: { id: fixture.invoiceId } }))?.status)
      .toBe(InvoiceStatus.SENT);

    // ADR-0080/#927: the series send is now recorded as a Communication, scoped by seriesId
    // (no bookingId) — the same audit trail a booking send already gets, and merged back into
    // this member booking's own Communications section rather than left orphaned like #830.
    await expect
      .poll(async () => (await prisma.communication.findFirst({ where: { seriesId: fixture.seriesId } }))?.status)
      .toBe(CommunicationStatus.SENT);
    const communication = await prisma.communication.findFirst({ where: { seriesId: fixture.seriesId } });
    expect(communication?.bookingId).toBeNull();

    await page.reload();
    await mobile.getByRole('tab', { name: 'Info' }).click();
    await expect(info.getByText('Series invoice email')).toBeVisible();
    await expect(info.getByText('Series', { exact: true })).toBeVisible();

    // The series row belongs to no single booking, so it must show identically on the OTHER
    // member booking's page too — not just the one the send was initiated from (ADR-0080).
    await page.goto(`/admin/bookings/${fixture.secondBookingId}`);
    const secondMobile = page.getByTestId('booking-detail-mobile');
    await secondMobile.getByRole('tab', { name: 'Info' }).click();
    const secondInfo = secondMobile.getByRole('tabpanel', { name: 'Info' });
    await expect(secondInfo.getByText('Series invoice email')).toBeVisible();
    await expect(secondInfo.getByText('Series', { exact: true })).toBeVisible();
  });
});
