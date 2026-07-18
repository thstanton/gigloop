import { test, expect } from '@playwright/test';
import { BookingStatus, type Contact } from '@prisma/client';
import { prisma } from '../support/prisma';
import { seedContact } from '../support/seed';

// The create journey (ADR-0048 §7, slice 2). This is the one flow where building
// the entity through the UI is the point (vs. Prisma-seeding it): arrange only
// the customer via a direct DB write, then drive the real New Booking form at
// 375px — selecting that existing contact, a future date, a starting status and
// fee — and assert the created booking is correct via both the UI and the DB,
// scoped to the exact entity created (its id, read back from the post-create
// URL), never a global count.
test.describe('create booking', () => {
  let customer: Contact;
  // Captured from the URL after creation so afterEach can clean up even when an
  // assertion below throws; reset each test so a failed run never deletes a
  // later run's booking.
  let createdBookingId: string | undefined;

  test.beforeEach(async () => {
    createdBookingId = undefined;
    customer = await seedContact();
  });

  test.afterEach(async () => {
    // Deleting the booking cascades its checklist goals/steps + music form
    // (verified against a UI-created booking). Then the now-unreferenced customer.
    if (createdBookingId) {
      await prisma.booking.deleteMany({ where: { id: createdBookingId } });
    }
    await prisma.contact.deleteMany({ where: { id: customer.id } });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('fill the form → create → land on the booking', async ({ page }) => {
    // A unique title ties both assertions (UI heading + DB row) to this run.
    const title = `E2E Create Booking ${Date.now()}`;

    // A date the calendar reaches with a single "Next month" step. Built with the
    // Date constructor rather than setMonth mutation, which would overflow at
    // month-ends (e.g. Aug 31 → Sep 31 → Oct 1) and land a month off the click.
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + 1, 15);
    // The calendar day's accessible name (aria-label), e.g. "15 August 2026".
    const dayLabel = target.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    // The booking-header date badge text, e.g. "15 Aug 2026".
    const badgeDate = target.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    await page.goto('/admin/bookings/new');

    // --- Overview: date, fee, title ---
    await page.getByRole('button', { name: 'Pick a date' }).click();
    await page.getByRole('button', { name: 'Next month' }).click();
    await page.getByRole('button', { name: dayLabel, exact: true }).click();
    await page.getByRole('spinbutton', { name: 'Fee' }).fill('1500');
    await page.getByRole('textbox', { name: 'Title' }).fill(title);

    // --- Starting status: act on it, so we assert what we set (the literal
    // default is profile-driven, not a given). ---
    await page.getByRole('radio', { name: 'Confirmed', exact: true }).click();

    // --- Customer: pick the seeded contact (existing), not inline-create. The
    // customer is the first People role, so its "Select existing" tab is the
    // first of the three role tabs (customer / agent / venue); once switched, its
    // combobox is uniquely named "Select customer...". ---
    await page.getByRole('tab', { name: 'Select existing' }).first().click();
    await page.getByRole('combobox', { name: 'Select customer...' }).click();
    await page.getByRole('combobox', { name: 'Search or create new customer' }).fill(customer.name);
    await page.getByRole('option', { name: customer.name }).click();

    // --- Step 2 (Reminders), then create ---
    await page.getByRole('button', { name: 'Next: Reminders' }).click();
    await page.getByRole('button', { name: 'Create booking' }).click();

    // --- Created checkpoint → finish → the booking detail ---
    await page.getByRole('button', { name: 'Finish' }).click();
    await page.waitForURL(/\/admin\/bookings\/[0-9a-f-]{36}$/);
    createdBookingId = page.url().split('/').pop();
    expect(createdBookingId).toBeTruthy();

    // --- Assert via the UI. Title, status pill and date badge live in the shared
    // booking header (rendered once, above the mobile/desktop tab-content
    // boundaries), so each is unique page-level: the h1 title (unique to this
    // booking), the "Confirmed" status pill (exact, so it doesn't match the
    // "Confirmed 0/4" checklist goal), and the date badge. ---
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmed', exact: true })).toBeVisible();
    await expect(page.getByText(badgeDate).first()).toBeVisible();

    // --- Assert via the DB, scoped to the exact entity. customerId is the
    // strongest specific-entity proof (it ties back to the seeded contact). Date
    // is asserted through the UI badge above, not here, to avoid a timezone-
    // ambiguous date-only comparison. ---
    const booking = await prisma.booking.findUnique({ where: { id: createdBookingId! } });
    expect(booking).not.toBeNull();
    expect(booking?.customerId).toBe(customer.id);
    expect(booking?.status).toBe(BookingStatus.CONFIRMED);
    expect(booking?.title).toBe(title);
    expect(Number(booking?.fee)).toBe(1500);
  });
});
