import { test, expect } from '@playwright/test';
import { InvoiceStatus } from '@prisma/client';
import { prisma } from '../support/prisma';
import {
  seedConfirmedBookingWithDraftInvoice,
  type ConfirmedBookingWithDraftInvoice,
} from '../support/seed';

// The money-path flow (ADR-0048 §7, slice 1). Arrange via the DB, act through
// the real mobile UI (375px), assert on both the UI status pill and the DB row
// for the specific invoice created — exercising PDF generation (→ fake R2 on
// issue) and email (→ sink on send).
test.describe('invoice money path', () => {
  let fixture: ConfirmedBookingWithDraftInvoice;

  test.beforeEach(async () => {
    fixture = await seedConfirmedBookingWithDraftInvoice();
  });

  test.afterEach(async () => {
    // Deleting the booking cascades its invoice/line-items/documents/comms.
    await prisma.booking.deleteMany({ where: { id: fixture.bookingId } });
    await prisma.contact.deleteMany({ where: { id: fixture.customerId } });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  async function expectInvoiceStatus(status: InvoiceStatus): Promise<void> {
    await expect
      .poll(async () => {
        const invoice = await prisma.invoice.findUnique({ where: { id: fixture.invoiceId } });
        return invoice?.status;
      })
      .toBe(status);
  }

  test('issue → send → mark paid', async ({ page }) => {
    await page.goto(`/admin/bookings/${fixture.bookingId}`);

    // Both the mobile and desktop layouts are rendered into the DOM (the desktop
    // one flashes in on first render before unmounting at 375px), so scope every
    // page-content query to the mobile layout via its data-testid boundary. The
    // RowActions bottom sheet and the compose sheet portal to the body, so their
    // buttons are queried at page level.
    const mobile = page.getByTestId('booking-detail-mobile');

    // Invoices live in the Info tab (Checklist / On the Day / Info).
    await mobile.getByRole('tab', { name: 'Info' }).click();
    const info = mobile.getByRole('tabpanel', { name: 'Info' });

    // A single invoice is seeded, but the row briefly re-renders twice while a
    // status mutation refetches the list (TanStack invalidate → refetch churn),
    // so target `.first()` — both transient copies are the same row — to avoid a
    // strict-mode race on each menu-open and status assertion. Exact name so the
    // trigger doesn't also match the "More actions" (desktop) trigger.
    const openInvoiceMenu = () => info.getByRole('button', { name: 'Actions', exact: true }).first().click();
    const statusPill = (label: string) => info.getByText(label, { exact: true }).first();

    // --- Issue the draft invoice ---
    await openInvoiceMenu();
    await page.getByRole('button', { name: 'Create invoice', exact: true }).click();
    await expect(statusPill('Issued')).toBeVisible();
    await expectInvoiceStatus(InvoiceStatus.ISSUED);

    // --- Send the issued invoice (opens the compose sheet, then sends) ---
    await openInvoiceMenu();
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    // Compose sheet: template preselected, subject auto-rendered, customer email
    // present — its primary Send button dispatches the email (→ sink).
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(statusPill('Sent')).toBeVisible();
    await expectInvoiceStatus(InvoiceStatus.SENT);

    // --- Mark the sent invoice paid ---
    await openInvoiceMenu();
    await page.getByRole('button', { name: 'Mark as paid', exact: true }).click();
    await expect(statusPill('Paid')).toBeVisible();
    await expectInvoiceStatus(InvoiceStatus.PAID);
  });
});
