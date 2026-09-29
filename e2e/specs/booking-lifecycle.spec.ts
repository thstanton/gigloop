import { test, expect as baseExpect } from '@playwright/test';
import { BookingStatus } from '@prisma/client';
import { prisma } from '../support/prisma';
import { seedBookingForLifecycle, type LifecycleBooking } from '../support/seed';

// Every assertion here waits on a real server round-trip (the fee PATCH awaits a full checklist
// re-evaluation, band-step sync included) against a remote DB; on CI that PATCH alone measured ~9s,
// past the suite-wide 10s default. Widen the wait for this file — the assertions themselves are unchanged.
const expect = baseExpect.configure({ timeout: 30_000 });

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

  test.beforeEach(async ({}, testInfo) => {
    test.slow(); // triples the 60s test budget: several server-side re-evaluations run serially
    const bandMemberStatus = testInfo.title.includes('decline') ? 'INVITED' : 'CONFIRMED';
    fixture = await seedBookingForLifecycle(undefined, undefined, bandMemberStatus);
  });

  test.afterEach(async () => {
    // beforeEach can fail mid-fixture (e.g. a local schema is behind the committed
    // migration); do not hide that original error with a cleanup dereference.
    if (!fixture) return;
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

    // #900: the band feature flag is on and this fixture has one confirmed member
    // filling every chair. The normal evaluator pass materialises the per-person
    // pair and settles the READY goal; it remains user-driven, not a status gate.
    await expect
      .poll(async () =>
        (
          await prisma.bookingChecklistItem.findFirst({
            where: { bookingId: fixture.bookingId, key: 'get_the_band_confirmed' },
          })
        )?.state,
      )
      .toBe('COMPLETE');
    await expect
      .poll(async () =>
        (
          await prisma.bookingChecklistStep.findFirst({
            where: { bookingId: fixture.bookingId, key: 'band_member_confirmed' },
          })
        )?.state,
      )
      .toBe('COMPLETE');

    // #901: the COMPLETE-staged briefing goal materialises one `Brief {name}` step
    // for the dep and stays open until their final details go out. Sending the
    // final-details email from the Band sheet (mail is sunk in E2E_TEST_MODE)
    // completes it; the copy-paste `Mark as sent` path logs the same SENT
    // Communication and is covered by the API unit tier.
    const briefStep = async () =>
      (
        await prisma.bookingChecklistStep.findFirst({
          where: { bookingId: fixture.bookingId, key: 'brief_band_member' },
        })
      )?.state;
    const briefedGoal = async () =>
      (
        await prisma.bookingChecklistItem.findFirst({
          where: { bookingId: fixture.bookingId, key: 'get_the_band_briefed' },
        })
      )?.state;
    await expect.poll(briefStep).toBe('PENDING');
    expect(await briefedGoal()).toBe('PENDING');
    await page.goto(`/admin/bookings/${fixture.bookingId}?sheet=band`);
    await page.getByRole('button', { name: 'Send final details to E2E Lifecycle Customer' }).click();
    const compose = page.getByRole('dialog', { name: 'Compose final details' });
    const sendFinalDetails = compose.getByRole('button', { name: 'Send email' });
    await expect(sendFinalDetails).toBeEnabled();
    await sendFinalDetails.click();
    await expect.poll(briefStep).toBe('COMPLETE');
    await expect.poll(briefedGoal).toBe('COMPLETE');
    await page.goto(`/admin/bookings/${fixture.bookingId}`);
    await expect(page.getByRole('button', { name: 'Provisional', exact: true })).toBeVisible();

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

  test('a dep portal decline re-opens the band goal while READY remains manually selectable (#900)', async ({ page, browser }) => {
    await page.goto(`/admin/bookings/${fixture.bookingId}`);
    await page.getByRole('button', { name: '+ Add fee' }).click();
    const overview = page.getByRole('dialog', { name: 'Overview' });
    await overview.getByRole('spinbutton', { name: 'Fee' }).fill('2000');
    await overview.getByRole('button', { name: 'Save' }).click();

    // The first checklist re-evaluation materialises the invited member's pair;
    // the confirmation remains pending until the dep answers from the portal.
    await expect
      .poll(async () =>
        (
          await prisma.bookingChecklistStep.findFirst({
            where: { bookingId: fixture.bookingId, key: 'invite_band_member' },
          })
        )?.state,
      )
      .toBe('COMPLETE');
    await expect
      .poll(async () =>
        (
          await prisma.bookingChecklistStep.findFirst({
            where: { bookingId: fixture.bookingId, key: 'band_member_confirmed' },
          })
        )?.state,
      )
      .toBe('PENDING');

    const portalContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const portalPage = await portalContext.newPage();
    await portalPage.goto(`/band/${fixture.bandPortalToken}`);
    await expect(portalPage.getByRole('heading', { name: 'E2E Lifecycle Booking' })).toBeVisible();
    await portalPage.getByRole('button', { name: 'Decline' }).click();
    await expect(portalPage.getByText("You've declined this gig.")).toBeVisible();
    await portalContext.close();

    await expect
      .poll(async () => (await prisma.bookingBandMember.findUnique({ where: { id: fixture.bandMemberId } }))?.status)
      .toBe('DECLINED');

    await expect
      .poll(async () =>
        (
          await prisma.bookingBandChair.findFirst({ where: { bookingId: fixture.bookingId } })
        )?.memberId,
      )
      .toBeNull();
    await expect
      .poll(async () =>
        (
          await prisma.bookingChecklistStep.findFirst({
            where: { bookingId: fixture.bookingId, key: 'fill_every_chair' },
          })
        )?.state,
      )
      .toBe('PENDING');
    await expect
      .poll(async () =>
        (
          await prisma.bookingChecklistStep.findFirst({
            where: { bookingId: fixture.bookingId, key: 'invite_band_member' },
          })
        )?.state,
      )
      .toBe('COMPLETE');
    await expect
      .poll(async () =>
        (
          await prisma.bookingChecklistStep.findFirst({
            where: { bookingId: fixture.bookingId, key: 'band_member_confirmed' },
          })
        )?.state,
      )
      .toBe('DECLINED');
    await expect
      .poll(async () =>
        (
          await prisma.bookingChecklistItem.findFirst({
            where: { bookingId: fixture.bookingId, key: 'get_the_band_confirmed' },
          })
        )?.state,
      )
      .toBe('PENDING');

    // Per CONTEXT.md, checklist goals advise the musician; status is still their
    // manual assessment and is not mechanically blocked by an incomplete goal.
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Provisional', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Ready', exact: true }).click();
    await expect
      .poll(async () => (await prisma.booking.findUnique({ where: { id: fixture.bookingId } }))?.status)
      .toBe(BookingStatus.READY);
    await expect
      .poll(async () =>
        (
          await prisma.bookingChecklistItem.findFirst({
            where: { bookingId: fixture.bookingId, key: 'get_the_band_confirmed' },
          })
        )?.state,
      )
      .toBe('PENDING');
  });
});
