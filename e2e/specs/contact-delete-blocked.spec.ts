import { test, expect } from '@playwright/test';
import { prisma } from '../support/prisma';
import { seedContactWithBooking, type ContactWithBooking } from '../support/seed';

// The contact-deletion hard rule (CLAUDE.md; ADR-0048 §7, slice 4): a contact
// with associated bookings cannot be deleted. The UI enforces this *preventively*
// — rather than letting the client attempt a delete and surfacing the API's 409,
// the edit drawer disables the Delete button and explains why. So this spec
// arranges a contact + booking via the DB, drives the real contact UI at 375px to
// the point of deletion, and asserts the block is clearly surfaced (message +
// disabled control) and that the contact survives. (The API-level 409 /
// ConflictException itself is covered by the contacts.service unit spec; per the
// project decision this e2e verifies the UI communication of the block, not a
// literal 409 toast — which the preventive UX never triggers.)
test.describe('contact delete blocked by bookings', () => {
  let fixture: ContactWithBooking;

  test.beforeEach(async () => {
    fixture = await seedContactWithBooking();
  });

  test.afterEach(async () => {
    // Booking first (it references the contact as customer), then the contact.
    await prisma.booking.deleteMany({ where: { id: fixture.bookingId } });
    await prisma.contact.deleteMany({ where: { id: fixture.contactId } });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('delete is blocked and clearly surfaced', async ({ page }) => {
    await page.goto(`/admin/contacts/${fixture.contactId}`);

    // Open the edit drawer, where the Delete control lives.
    await page.getByRole('button', { name: 'Edit' }).click();
    const drawer = page.getByRole('dialog', { name: 'Edit contact' });

    // The block is surfaced clearly: an explanatory message naming the booking
    // that holds the contact, and a disabled Delete control (so the destructive
    // action can't even be attempted — not a silent no-op).
    await expect(
      drawer.getByText('This contact has 1 booking and cannot be deleted.'),
    ).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Delete contact' })).toBeDisabled();

    // The contact survives the blocked attempt.
    const contact = await prisma.contact.findUnique({ where: { id: fixture.contactId } });
    expect(contact).not.toBeNull();
  });
});
