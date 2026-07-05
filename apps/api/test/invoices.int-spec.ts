import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, mockStorageService } from './test-app.factory';
import { PrismaService } from '../src/prisma/prisma.service';
import { TEST_USER_ID } from './test-auth.guard';
import { CHECKLIST_DEFAULTS } from '../src/bookings/checklist-defaults';
import { buildInvoiceNumber } from '../src/invoices/invoices.repository';

const OTHER_USER_ID = 'invoice-other-user';
const FUTURE_DATE = '2027-09-15T14:00:00.000Z';

describe('Invoice flow (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customerId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const contact = await prisma.contact.create({
      data: { userId: TEST_USER_ID, name: 'Invoice Test Customer' },
    });
    customerId = contact.id;

    // PublicProfile required for PDF generation; UserProfile required for invoice numbering
    await Promise.all([
      prisma.publicProfile.upsert({
        where: { userId: TEST_USER_ID },
        create: { userId: TEST_USER_ID, businessName: 'Test Band' },
        update: {},
      }),
      prisma.userProfile.upsert({
        where: { userId: TEST_USER_ID },
        create: { userId: TEST_USER_ID },
        update: {},
      }),
    ]);
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.contact.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.publicProfile.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.userProfile.deleteMany({ where: { userId: TEST_USER_ID } });
    await app.close();
  });

  beforeEach(() => {
    mockStorageService.putDocument.mockClear();
  });

  // ── helpers ───────────────────────────────────────────────────────────────

  async function createBooking(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/bookings')
      .send({
        eventType: 'WEDDING',
        date: FUTURE_DATE,
        customerId,
        checklistItems: CHECKLIST_DEFAULTS.map(
          ({ key, label, completedBy, autoCompleteRule, requiredForStatus, dueDateRule }) => ({
            key,
            label,
            completedBy,
            autoCompleteRule,
            requiredForStatus,
            dueDateRule,
          }),
        ),
      });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  async function createInvoice(bookingId: string, isDeposit = false): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`/api/bookings/${bookingId}/invoices`)
      .send({ isDeposit });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  async function sendInvoice(bookingId: string, invoiceId: string): Promise<void> {
    const issueRes = await request(app.getHttpServer())
      .post(`/api/bookings/${bookingId}/invoices/${invoiceId}/issue`)
      .send({ issueDate: '2027-01-01', dueDate: '2027-01-15' });
    expect(issueRes.status).toBe(201);
    const res = await request(app.getHttpServer())
      .post(`/api/bookings/${bookingId}/invoices/${invoiceId}/send`)
      .send({
        to: 'client@example.com',
        contactId: customerId,
        subject: 'Your invoice',
        body: '<p>Please find your invoice attached.</p>',
      });
    expect(res.status).toBe(204);
  }

  async function markSent(bookingId: string, invoiceId: string): Promise<void> {
    const issueRes = await request(app.getHttpServer())
      .post(`/api/bookings/${bookingId}/invoices/${invoiceId}/issue`)
      .send({ issueDate: '2027-01-01', dueDate: '2027-01-15' });
    expect(issueRes.status).toBe(201);
    const res = await request(app.getHttpServer())
      .post(`/api/bookings/${bookingId}/invoices/${invoiceId}/mark-sent`)
      .send({});
    expect(res.status).toBe(201);
  }

  // Resolve a key to its goal (BookingChecklistItem) or step (BookingChecklistStep) row — ADR-0057
  // turned create_deposit_invoice / create_balance_invoice / deposit_received into steps of a goal.
  async function getChecklistItem(bookingId: string, key: string) {
    const goal = await prisma.bookingChecklistItem.findFirst({ where: { bookingId, key } });
    if (goal) return goal;
    return prisma.bookingChecklistStep.findFirst({ where: { bookingId, key } });
  }

  // ── happy paths ────────────────────────────────────────────────────────────

  describe('Create deposit invoice → create_deposit_invoice checklist COMPLETE', () => {
    it('auto-completes create_deposit_invoice on issue', async () => {
      const bookingId = await createBooking();
      // Force deps so create_deposit_invoice is reachable (not BLOCKED)
      await prisma.bookingChecklistItem.updateMany({
        where: { bookingId, key: { in: ['send_quote', 'confirm_quote'] } },
        data: { state: 'COMPLETE', completedAt: new Date() },
      });

      const invoiceId = await createInvoice(bookingId, true);
      await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/invoices/${invoiceId}/issue`)
        .send({ issueDate: '2027-01-01', dueDate: '2027-01-15' });

      const item = await getChecklistItem(bookingId, 'create_deposit_invoice');
      expect(item?.state).toBe('COMPLETE');

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  describe('Create balance invoice → create_balance_invoice checklist COMPLETE', () => {
    it('auto-completes create_balance_invoice on issue', async () => {
      const bookingId = await createBooking();

      const invoiceId = await createInvoice(bookingId, false);
      await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/invoices/${invoiceId}/issue`)
        .send({ issueDate: '2027-01-01', dueDate: '2027-01-15' });

      const item = await getChecklistItem(bookingId, 'create_balance_invoice');
      expect(item?.state).toBe('COMPLETE');

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  describe('Send invoice', () => {
    it('putDocument called, Document record created, invoice number assigned, email sent', async () => {
      const bookingId = await createBooking();
      const invoiceId = await createInvoice(bookingId, true);

      await sendInvoice(bookingId, invoiceId);

      // PDF stored
      expect(mockStorageService.putDocument).toHaveBeenCalledTimes(1);

      // Document record created
      const doc = await prisma.document.findFirst({ where: { invoiceId } });
      expect(doc).not.toBeNull();
      expect(doc?.type).toBe('INVOICE');

      // Invoice number assigned
      const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      expect(invoice?.invoiceNumber).toBeTruthy();
      expect(invoice?.status).toBe('SENT');

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  describe('Mark deposit invoice PAID', () => {
    it('depositReceivedAt set on booking + deposit_received checklist COMPLETE', async () => {
      const bookingId = await createBooking();
      const invoiceId = await createInvoice(bookingId, true);

      await markSent(bookingId, invoiceId);

      // Unblock deposit_received by completing send_contract dependency
      await prisma.bookingChecklistItem.updateMany({
        where: { bookingId, key: 'send_contract' },
        data: { state: 'COMPLETE', completedAt: new Date() },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/invoices/${invoiceId}/mark-paid`)
        .send({});
      expect(res.status).toBe(201);

      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(booking?.depositReceivedAt).not.toBeNull();

      const item = await getChecklistItem(bookingId, 'deposit_received');
      expect(item?.state).toBe('COMPLETE');

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  describe('Void SENT deposit invoice', () => {
    it('create_deposit_invoice checklist reset to non-COMPLETE', async () => {
      const bookingId = await createBooking();
      await prisma.bookingChecklistItem.updateMany({
        where: { bookingId, key: { in: ['send_quote', 'confirm_quote'] } },
        data: { state: 'COMPLETE', completedAt: new Date() },
      });

      const invoiceId = await createInvoice(bookingId, true);
      await markSent(bookingId, invoiceId);

      const itemBeforeVoid = await getChecklistItem(bookingId, 'create_deposit_invoice');
      expect(itemBeforeVoid?.state).toBe('COMPLETE');

      const voidRes = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/invoices/${invoiceId}/void`)
        .send({});
      expect(voidRes.status).toBe(201);

      const itemAfterVoid = await getChecklistItem(bookingId, 'create_deposit_invoice');
      expect(itemAfterVoid?.state).not.toBe('COMPLETE');

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  describe('Void + recreate', () => {
    it('void deposit invoice → create new → create_deposit_invoice COMPLETE again', async () => {
      const bookingId = await createBooking();
      await prisma.bookingChecklistItem.updateMany({
        where: { bookingId, key: { in: ['send_quote', 'confirm_quote'] } },
        data: { state: 'COMPLETE', completedAt: new Date() },
      });

      const firstId = await createInvoice(bookingId, true);
      await markSent(bookingId, firstId);

      await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/invoices/${firstId}/void`)
        .send({});

      const secondId = await createInvoice(bookingId, true);
      await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/invoices/${secondId}/issue`)
        .send({ issueDate: '2027-01-01', dueDate: '2027-01-15' });

      const item = await getChecklistItem(bookingId, 'create_deposit_invoice');
      expect(item?.state).toBe('COMPLETE');

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  describe('Invoice numbers increment correctly', () => {
    it('successive sends produce INV-{year}-001 then INV-{year}-002', async () => {
      const year = new Date().getFullYear();

      // Reset sequence so numbers are predictable
      await prisma.userProfile.update({
        where: { userId: TEST_USER_ID },
        data: { invoiceNumberSequence: 0, invoiceSequenceYear: year, preferences: {} },
      });

      const bookingId = await createBooking();

      const firstId = await createInvoice(bookingId, true);
      await sendInvoice(bookingId, firstId);

      const secondId = await createInvoice(bookingId, false);
      await sendInvoice(bookingId, secondId);

      const [first, second] = await Promise.all([
        prisma.invoice.findUnique({ where: { id: firstId } }),
        prisma.invoice.findUnique({ where: { id: secondId } }),
      ]);

      expect(first?.invoiceNumber).toBe(buildInvoiceNumber(1, year, { prefix: 'INV', includeYear: true, paddingWidth: 3 }));
      expect(second?.invoiceNumber).toBe(buildInvoiceNumber(2, year, { prefix: 'INV', includeYear: true, paddingWidth: 3 }));

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  describe('Custom invoice number format', () => {
    it('uses user-configured prefix, no year, custom padding', async () => {
      const year = new Date().getFullYear();

      await prisma.userProfile.update({
        where: { userId: TEST_USER_ID },
        data: {
          invoiceNumberSequence: 0,
          invoiceSequenceYear: 0,
          preferences: { invoiceNumberFormat: { prefix: 'MYCO', includeYear: false, paddingWidth: 4 } },
        },
      });

      const bookingId = await createBooking();
      const invoiceId = await createInvoice(bookingId, true);
      await sendInvoice(bookingId, invoiceId);

      const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      expect(invoice?.invoiceNumber).toBe(
        buildInvoiceNumber(1, year, { prefix: 'MYCO', includeYear: false, paddingWidth: 4 }),
      );

      // Restore defaults
      await prisma.userProfile.update({
        where: { userId: TEST_USER_ID },
        data: { preferences: {} },
      });

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  describe('Void + number reuse', () => {
    it('new send reuses the voided invoice number for the same booking+type', async () => {
      const year = new Date().getFullYear();

      await prisma.userProfile.update({
        where: { userId: TEST_USER_ID },
        data: { invoiceNumberSequence: 0, invoiceSequenceYear: year, preferences: {} },
      });

      const bookingId = await createBooking();

      const firstId = await createInvoice(bookingId, true);
      await sendInvoice(bookingId, firstId);

      const firstInvoice = await prisma.invoice.findUnique({ where: { id: firstId } });
      const originalNumber = firstInvoice?.invoiceNumber;

      // Void it
      await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/invoices/${firstId}/void`)
        .send({});

      // Create and send a new deposit invoice for the same booking
      const secondId = await createInvoice(bookingId, true);
      await sendInvoice(bookingId, secondId);

      const secondInvoice = await prisma.invoice.findUnique({ where: { id: secondId } });
      expect(secondInvoice?.invoiceNumber).toBe(originalNumber);

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  describe('Line item CRUD', () => {
    it('add line item to DRAFT → appears in GET response', async () => {
      const bookingId = await createBooking();
      const invoiceId = await createInvoice(bookingId, true);

      const addRes = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/invoices/${invoiceId}/line-items`)
        .send({ description: 'Performance fee', amount: 1500 });
      expect(addRes.status).toBe(201);

      const getRes = await request(app.getHttpServer())
        .get(`/api/bookings/${bookingId}/invoices/${invoiceId}`);
      expect(getRes.status).toBe(200);
      const found = (getRes.body.lineItems as Array<{ description: string }>).find(
        (li) => li.description === 'Performance fee',
      );
      expect(found).toBeDefined();

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('update line item on DRAFT → changes reflected', async () => {
      const bookingId = await createBooking();
      const invoiceId = await createInvoice(bookingId, true);

      const addRes = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/invoices/${invoiceId}/line-items`)
        .send({ description: 'Old description', amount: 500 });
      const itemId = addRes.body.id as string;

      const patchRes = await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}/invoices/${invoiceId}/line-items/${itemId}`)
        .send({ description: 'Updated description', amount: 750 });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.description).toBe('Updated description');

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('delete line item from DRAFT → removed', async () => {
      const bookingId = await createBooking();
      const invoiceId = await createInvoice(bookingId, true);

      const addRes = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/invoices/${invoiceId}/line-items`)
        .send({ description: 'To be deleted', amount: 200 });
      const itemId = addRes.body.id as string;

      const delRes = await request(app.getHttpServer())
        .delete(`/api/bookings/${bookingId}/invoices/${invoiceId}/line-items/${itemId}`);
      expect(delRes.status).toBe(204);

      const item = await prisma.invoiceLineItem.findUnique({ where: { id: itemId } });
      expect(item).toBeNull();

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  // ── PDF preview ───────────────────────────────────────────────────────────

  describe('Preview PDF', () => {
    it('returns application/pdf for a DRAFT invoice', async () => {
      const bookingId = await createBooking();
      const invoiceId = await createInvoice(bookingId, true);

      const res = await request(app.getHttpServer())
        .get(`/api/bookings/${bookingId}/invoices/${invoiceId}/preview.pdf`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('returns application/pdf for an ISSUED invoice', async () => {
      const bookingId = await createBooking();
      const invoiceId = await createInvoice(bookingId, true);
      await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/invoices/${invoiceId}/issue`)
        .send({ issueDate: '2027-01-01', dueDate: '2027-01-15' });

      const res = await request(app.getHttpServer())
        .get(`/api/bookings/${bookingId}/invoices/${invoiceId}/preview.pdf`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  // ── unhappy paths ──────────────────────────────────────────────────────────

  describe('Unhappy paths', () => {
    it('create second deposit invoice when one exists in non-VOID state → 409', async () => {
      const bookingId = await createBooking();
      await createInvoice(bookingId, true);

      const res = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/invoices`)
        .send({ isDeposit: true });
      expect(res.status).toBe(409);

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('create second balance invoice when one exists in non-VOID state → 409', async () => {
      const bookingId = await createBooking();
      await createInvoice(bookingId, false);

      const res = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/invoices`)
        .send({ isDeposit: false });
      expect(res.status).toBe(409);

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('mark DRAFT invoice paid → 400', async () => {
      const bookingId = await createBooking();
      const invoiceId = await createInvoice(bookingId, true);

      const res = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/invoices/${invoiceId}/mark-paid`)
        .send({});
      expect(res.status).toBe(400);

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('void a DRAFT invoice → 400', async () => {
      const bookingId = await createBooking();
      const invoiceId = await createInvoice(bookingId, true);

      const res = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/invoices/${invoiceId}/void`)
        .send({});
      expect(res.status).toBe(400);

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('void an already-VOID invoice → 400', async () => {
      const bookingId = await createBooking();
      const invoiceId = await createInvoice(bookingId, true);
      await markSent(bookingId, invoiceId);

      await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/invoices/${invoiceId}/void`)
        .send({});

      const res = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/invoices/${invoiceId}/void`)
        .send({});
      expect(res.status).toBe(400);

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('DELETE DRAFT invoice → 204', async () => {
      const bookingId = await createBooking();
      const invoiceId = await createInvoice(bookingId, true);

      const res = await request(app.getHttpServer())
        .delete(`/api/bookings/${bookingId}/invoices/${invoiceId}`);
      expect(res.status).toBe(204);

      const deleted = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      expect(deleted).toBeNull();

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('add line item on SENT invoice → 400', async () => {
      const bookingId = await createBooking();
      const invoiceId = await createInvoice(bookingId, true);
      await markSent(bookingId, invoiceId);

      const res = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/invoices/${invoiceId}/line-items`)
        .send({ description: 'Extra', amount: 100 });
      expect(res.status).toBe(400);

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('update line item on SENT invoice → 400', async () => {
      const bookingId = await createBooking();
      const invoiceId = await createInvoice(bookingId, true);

      const addRes = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/invoices/${invoiceId}/line-items`)
        .send({ description: 'Fee', amount: 1000 });
      const itemId = addRes.body.id as string;

      await markSent(bookingId, invoiceId);

      const res = await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}/invoices/${invoiceId}/line-items/${itemId}`)
        .send({ amount: 2000 });
      expect(res.status).toBe(400);

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('delete line item on SENT invoice → 400', async () => {
      const bookingId = await createBooking();
      const invoiceId = await createInvoice(bookingId, true);

      const addRes = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/invoices/${invoiceId}/line-items`)
        .send({ description: 'Fee', amount: 1000 });
      const itemId = addRes.body.id as string;

      await markSent(bookingId, invoiceId);

      const res = await request(app.getHttpServer())
        .delete(`/api/bookings/${bookingId}/invoices/${invoiceId}/line-items/${itemId}`);
      expect(res.status).toBe(400);

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('invoice not found → 404', async () => {
      const bookingId = await createBooking();
      const res = await request(app.getHttpServer())
        .get(`/api/bookings/${bookingId}/invoices/00000000-0000-0000-0000-000000000000`);
      expect(res.status).toBe(404);
      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it("invoice belongs to another user → 404 (multi-tenancy)", async () => {
      const otherContact = await prisma.contact.create({
        data: { userId: OTHER_USER_ID, name: 'Other Contact' },
      });
      const otherBooking = await prisma.booking.create({
        data: {
          userId: OTHER_USER_ID,
          eventType: 'CORPORATE',
          date: new Date(FUTURE_DATE),
          customerId: otherContact.id,
          status: 'PROVISIONAL',
          portalToken: `invoice-other-token-${Date.now()}`,
        },
      });
      const otherInvoice = await prisma.invoice.create({
        data: {
          userId: OTHER_USER_ID,
          bookingId: otherBooking.id,
          billToContactId: otherContact.id,
          isDeposit: true,
          status: 'DRAFT',
        },
      });

      const myBookingId = await createBooking();
      const res = await request(app.getHttpServer())
        .get(`/api/bookings/${myBookingId}/invoices/${otherInvoice.id}`);
      expect(res.status).toBe(404);

      await prisma.booking.delete({ where: { id: otherBooking.id } });
      await prisma.contact.delete({ where: { id: otherContact.id } });
      await prisma.booking.delete({ where: { id: myBookingId } });
    });

    it('create invoice on a series booking → 409', async () => {
      const series = await prisma.bookingSeries.create({
        data: { userId: TEST_USER_ID, label: 'Test Series', customerId },
      });
      const seriesBooking = await prisma.booking.create({
        data: {
          userId: TEST_USER_ID,
          eventType: 'CORPORATE',
          date: new Date(FUTURE_DATE),
          customerId,
          seriesId: series.id,
          status: 'PROVISIONAL',
          portalToken: `series-booking-token-${Date.now()}`,
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/bookings/${seriesBooking.id}/invoices`)
        .send({ isDeposit: true });
      expect(res.status).toBe(409);

      await prisma.booking.delete({ where: { id: seriesBooking.id } });
      await prisma.bookingSeries.delete({ where: { id: series.id } });
    });
  });
});
