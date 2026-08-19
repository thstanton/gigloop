import { test, expect } from '@playwright/test';
import { InvoiceStatus } from '@prisma/client';
import { prisma } from '../support/prisma';
import {
  seedSeriesWithDraftInvoice,
  type SeriesWithDraftInvoice,
} from '../support/seed';

// The series-invoice edit journey (#845, ADR-0069). Companion to `invoice-money-path.spec.ts`
// rather than an extension of it: a different journey, a different fixture, and keeping them
// apart avoids two slices editing one file.
//
// This journey did not previously exist, in the strongest sense — a series invoice could be
// created and issued but never edited, because `PATCH` and the three line-item routes lived
// only under `/bookings/:bookingId/invoices` and a series invoice has no owning booking. The
// UI failure was silent: the Edit sheet opened empty rather than erroring (#844).
//
// Arrange via the DB, act through the real mobile UI (375px), assert on the DB rows — the
// assertion that matters is which line items actually changed, which the UI alone cannot show.
test.describe('series invoice — edit and issue', () => {
  let fixture: SeriesWithDraftInvoice;

  test.beforeEach(async () => {
    fixture = await seedSeriesWithDraftInvoice();
  });

  test.afterEach(async () => {
    // The series invoice hangs off the series, not a booking, so it does not cascade from the
    // booking delete the money-path spec relies on. Remove it first, then the members, then the
    // series (Restrict on customer), then the contact.
    await prisma.invoice.deleteMany({ where: { seriesId: fixture.seriesId } });
    await prisma.booking.deleteMany({ where: { seriesId: fixture.seriesId } });
    await prisma.bookingSeries.deleteMany({ where: { id: fixture.seriesId } });
    await prisma.contact.deleteMany({ where: { id: fixture.customerId } });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  function lineItems() {
    return prisma.invoiceLineItem.findMany({
      where: { invoiceId: fixture.invoiceId },
      orderBy: { order: 'asc' },
    });
  }

  test('edit a line, add a custom line, then issue', async ({ page }) => {
    await page.goto(`/admin/bookings/${fixture.bookingId}`);

    // Both layouts are in the DOM (the desktop one flashes in before unmounting at 375px), so
    // scope page-content queries to the mobile boundary. Sheets and the RowActions bottom sheet
    // portal to the body and are queried at page level.
    const mobile = page.getByTestId('booking-detail-mobile');
    await mobile.getByRole('tab', { name: 'Info' }).click();
    const info = mobile.getByRole('tabpanel', { name: 'Info' });

    // A series member shows the shared Series Invoice card in place of the booking invoice list.
    const openInvoiceMenu = () =>
      info.getByRole('button', { name: 'Actions', exact: true }).first().click();

    // --- Open Edit: the sheet must carry the real line items, not an empty create form ---
    await openInvoiceMenu();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();

    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('heading', { name: 'Edit Invoice' })).toBeVisible();
    const descriptions = sheet.getByPlaceholder('Description');
    const amounts = sheet.getByPlaceholder('0.00');
    await expect(descriptions).toHaveCount(2);
    await expect(descriptions.first()).toHaveValue('1 May 2099');

    // --- Edit a traced line's amount, and add a custom line ---
    await amounts.first().fill('750');
    await sheet.getByRole('button', { name: 'Add line item' }).click();
    await descriptions.nth(2).fill('PA hire');
    await amounts.nth(2).fill('200');
    await sheet.getByRole('button', { name: 'Save draft', exact: true }).click();

    await expect
      .poll(async () => (await lineItems()).length)
      .toBe(3);

    const saved = await lineItems();

    // The traced line keeps its provenance while carrying the hand-edited amount — the pair
    // ADR-0043 depends on, and which nothing could previously produce.
    const traced = saved.find((l) => l.id === fixture.tracedLineId);
    expect(traced?.sourceBookingId).toBe(fixture.bookingId);
    expect(traced?.amount.toString()).toBe('750');

    // The custom line is untraced — which is exactly what keeps reconciliation off it.
    const custom = saved.find((l) => l.description === 'PA hire');
    expect(custom).toBeDefined();
    expect(custom?.sourceBookingId).toBeNull();
    expect(custom?.amount.toString()).toBe('200');

    // --- Issue the edited draft: what was seen is what gets locked ---
    await openInvoiceMenu();
    await page.getByRole('button', { name: 'Create invoice', exact: true }).click();

    await expect
      .poll(async () => {
        const invoice = await prisma.invoice.findUnique({ where: { id: fixture.invoiceId } });
        return invoice?.status;
      })
      .toBe(InvoiceStatus.ISSUED);

    // Issuing must lock the edited content, not a pre-edit snapshot.
    const issued = await lineItems();
    expect(issued).toHaveLength(3);
    expect(issued.find((l) => l.id === fixture.tracedLineId)?.amount.toString()).toBe('750');
    expect(issued.some((l) => l.description === 'PA hire')).toBe(true);
  });
});
