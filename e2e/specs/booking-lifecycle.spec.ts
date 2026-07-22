import { test, expect } from '@playwright/test';
import { BookingStatus } from '@prisma/client';
import { prisma } from '../support/prisma';
import { seedBookingForLifecycle, type LifecycleBooking } from '../support/seed';

// The checklist lifecycle (ADR-0048 §7, slice 5) — the only flow with a 768px
// desktop variant, because booking-detail's desktop DOM genuinely diverges (an
// inline checklist vs. the mobile Checklist/On the Day/Info tabs; sidebar vs.
// bottom tab bar). One test body runs under BOTH the mobile-chromium (375px) and
// desktop-chromium (768px) projects; it scopes checklist queries to whichever
// layout host is visible at that width. Arrange the booking + the real default
// checklist via the DB, then drive it to COMPLETE: an auto-complete (setting the
// fee satisfies the `set_fee_*` steps' `fee notNull` rule), a manual goal
// completion (⋯ → Mark complete), and the user-driven status advance through to
// COMPLETE — asserting via UI + DB.
//
// NOTE (slice 5 finding): the status advance is UNGATED in the live UI — the
// "outstanding checklist items" warning dialog is wired to an empty array and
// never fires (filed as a separate bug). CONTEXT already frames status as
// user-driven ("you move it on when you're ready"), so this spec asserts the
// actual behaviour — status advances freely regardless of incomplete goals — and
// deliberately does NOT assert a hard stage gate.
test.describe('booking checklist lifecycle', () => {
  let fixture: LifecycleBooking;

  test.beforeEach(async () => {
    fixture = await seedBookingForLifecycle();
  });

  test.afterEach(async () => {
    // Deleting the booking cascades its checklist goals + steps; then the customer.
    await prisma.booking.deleteMany({ where: { id: fixture.bookingId } });
    await prisma.contact.deleteMany({ where: { id: fixture.customerId } });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('work the checklist through to Complete', async ({ page }) => {
    const wide = (page.viewportSize()?.width ?? 0) >= 768;
    // Both layout hosts are in the DOM (CSS-toggled by the `md` breakpoint); scope
    // checklist queries to the one visible at this width. The booking header
    // (status pill, fee) is shared — rendered once above both hosts — so it's
    // queried page-level.
    const checklist = page.getByTestId(wide ? 'booking-detail-desktop' : 'booking-detail-mobile');

    await page.goto(`/admin/bookings/${fixture.bookingId}`);
    await expect(page.getByRole('button', { name: 'Provisional', exact: true })).toBeVisible();

    // --- Auto-complete: setting the fee satisfies the `fee notNull` rule, so the
    //     `set_fee_*` steps flip PENDING→COMPLETE when the evaluator re-runs after
    //     the PATCH. Proves the real rule fires (the checklist is seeded from the
    //     app's own CHECKLIST_DEFAULTS). ---
    await page.getByRole('button', { name: '+ Add fee' }).click();
    const overview = page.getByRole('dialog', { name: 'Overview' });
    await overview.getByRole('spinbutton', { name: 'Fee' }).fill('2000');
    await overview.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('£2,000.00')).toBeVisible();
    await expect
      .poll(async () =>
        (
          await prisma.bookingChecklistStep.findFirst({
            where: { bookingId: fixture.bookingId, key: 'set_fee_deposit' },
          })
        )?.state,
      )
      .toBe('COMPLETE');

    // --- Manual goal completion: the first goal (Get the deposit paid) via its
    //     overflow menu → Mark complete. The stage-section count reflects it
    //     (0/3 → 1/3 — the Provisional bracket holds the three CONFIRMED-target
    //     goals: get_deposit_paid, add_venue [#759], get_contract_signed). The
    //     overflow control diverges by layout: mobile is a bottom
    //     sheet (trigger "Actions" → button items); desktop is a dropdown (trigger
    //     "More actions" → menuitem items). ---
    if (wide) {
      await checklist.getByRole('button', { name: 'More actions' }).first().click();
      await page.getByRole('menuitem', { name: 'Mark complete' }).click();
    } else {
      await checklist.getByRole('button', { name: 'Actions', exact: true }).first().click();
      await page.getByRole('button', { name: 'Mark complete' }).click();
    }
    await expect(checklist.getByRole('button', { name: 'Provisional 1/3' })).toBeVisible();
    await expect
      .poll(async () =>
        (
          await prisma.bookingChecklistItem.findFirst({
            where: { bookingId: fixture.bookingId, key: 'get_deposit_paid' },
          })
        )?.state,
      )
      .toBe('COMPLETE');

    // --- Advance through the stages to COMPLETE via the shared status pill. Status
    //     is user-driven and ungated (see NOTE), so each transition is immediate. ---
    for (const [from, to] of [
      ['Provisional', 'Confirmed'],
      ['Confirmed', 'Ready'],
      ['Ready', 'Complete'],
    ] as const) {
      await page.getByRole('button', { name: from, exact: true }).click();
      await page.getByRole('menuitem', { name: to, exact: true }).click();
      await expect(page.getByRole('button', { name: to, exact: true })).toBeVisible();
    }
    await expect
      .poll(async () => (await prisma.booking.findUnique({ where: { id: fixture.bookingId } }))?.status)
      .toBe(BookingStatus.COMPLETE);
  });
});
