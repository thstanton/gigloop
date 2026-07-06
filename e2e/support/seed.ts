import { BookingStatus, InvoiceStatus, type Contact } from '@prisma/client';
import { prisma, E2E_TEST_USER_ID } from './prisma';

// Deletes everything owned by the test user, in child→parent order. Booking is
// the cascade root for invoices/line-items/documents/communications/etc., so
// deleting bookings first clears the Restrict relations that would otherwise
// block the contact delete (Invoice.billTo / Communication.contact).
export async function resetTestData(userId: string = E2E_TEST_USER_ID): Promise<void> {
  await prisma.booking.deleteMany({ where: { userId } });
  await prisma.template.deleteMany({ where: { userId } });
  await prisma.contact.deleteMany({ where: { userId } });
  await prisma.publicProfile.deleteMany({ where: { userId } });
  await prisma.userProfile.deleteMany({ where: { userId } });
}

// Account scaffolding seeded once per run (ADR-0048 §5):
// - UserProfile.onboardingCompletedAt so AdminLayout renders the app rather than
//   redirecting into the onboarding wizard.
// - PublicProfile, which invoice PDF generation reads and throws without.
export async function seedBaselineProfile(userId: string = E2E_TEST_USER_ID): Promise<void> {
  await prisma.userProfile.upsert({
    where: { userId },
    create: { userId, onboardingCompletedAt: new Date() },
    update: { onboardingCompletedAt: new Date() },
  });
  await prisma.publicProfile.upsert({
    where: { userId },
    create: {
      userId,
      businessName: 'E2E Test Band',
      displayName: 'E2E Test Band',
      email: 'band@e2e.test',
    },
    update: {
      businessName: 'E2E Test Band',
      displayName: 'E2E Test Band',
      email: 'band@e2e.test',
    },
  });
}

// A plain customer contact, arranged directly in the DB for the create-booking
// journey (ADR-0048 §7, slice 2): the booking itself is built through the UI, so
// the only fixture the spec needs is a contact to select. `primaryRole` seeds it
// as a customer so the picker surfaces it under the Customer role.
export async function seedContact(userId: string = E2E_TEST_USER_ID): Promise<Contact> {
  return prisma.contact.create({
    data: {
      userId,
      name: 'E2E Create Customer',
      email: 'create-customer@e2e.test',
      primaryRole: 'CUSTOMER',
    },
  });
}

export interface BookingWithSentContract {
  bookingId: string;
  contractId: string;
  customerId: string;
  portalToken: string;
}

// Per-test fixture (ADR-0048 §5/§7, slice 3): a booking with a contract in SENT
// status, arranged directly in the DB, for the unauthenticated portal signing
// flow. The booking's `portalToken` (auto-generated) is the only auth the
// `/booking/:token` routes need — they bypass Clerk entirely. `content` is a
// minimal Tiptap doc: it renders in the portal contract view (Tiptap) and feeds
// the signed-contract PDF (renderTiptapToPdfmake → fake storage in test mode).
// The account's PublicProfile (email) is seeded once per run by
// seedBaselineProfile — the signing notification email (→ sink) needs it.
export async function seedBookingWithSentContract(
  userId: string = E2E_TEST_USER_ID,
): Promise<BookingWithSentContract> {
  const customer = await prisma.contact.create({
    data: { userId, name: 'E2E Portal Customer', email: 'portal-customer@e2e.test' },
  });

  const booking = await prisma.booking.create({
    data: {
      userId,
      status: BookingStatus.PROVISIONAL,
      eventType: 'Wedding',
      title: 'E2E Contract-Sign Booking',
      date: new Date('2099-09-01T18:00:00.000Z'),
      customerId: customer.id,
    },
  });

  const contract = await prisma.contract.create({
    data: {
      userId,
      bookingId: booking.id,
      status: 'SENT',
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'This agreement confirms the booking between the performer and the client for the event described.',
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'The performer agrees to provide musical services as discussed.' },
            ],
          },
        ],
      },
    },
  });

  return {
    bookingId: booking.id,
    contractId: contract.id,
    customerId: customer.id,
    portalToken: booking.portalToken,
  };
}

export interface ConfirmedBookingWithDraftInvoice {
  bookingId: string;
  invoiceId: string;
  customerId: string;
}

// Per-test fixture (ADR-0048 §5): a CONFIRMED booking with a single DRAFT
// invoice, arranged directly in the DB. The customer carries an email — the
// invoice send is gated on it. The invoice is a non-deposit (balance) invoice,
// so the send preselects the `balance_invoice_cover` template.
export async function seedConfirmedBookingWithDraftInvoice(
  userId: string = E2E_TEST_USER_ID,
): Promise<ConfirmedBookingWithDraftInvoice> {
  const customer = await prisma.contact.create({
    data: { userId, name: 'E2E Customer', email: 'customer@e2e.test' },
  });

  const booking = await prisma.booking.create({
    data: {
      userId,
      status: BookingStatus.CONFIRMED,
      eventType: 'Wedding',
      title: 'E2E Money-Path Booking',
      date: new Date('2099-06-01T18:00:00.000Z'),
      fee: '1000.00',
      customerId: customer.id,
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      userId,
      status: InvoiceStatus.DRAFT,
      isDeposit: false,
      bookingId: booking.id,
      billToContactId: customer.id,
      lineItems: {
        create: [{ userId, description: 'Performance fee', amount: '1000.00', order: 0 }],
      },
    },
  });

  return { bookingId: booking.id, invoiceId: invoice.id, customerId: customer.id };
}
