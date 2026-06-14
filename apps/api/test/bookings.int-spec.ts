import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app.factory';
import { prisma } from './test-prisma';
import { TEST_USER_ID } from './test-auth.guard';
import { CHECKLIST_DEFAULTS } from '../src/bookings/checklist-defaults';

const OTHER_USER_ID = 'other-user-id';
const FUTURE_DATE = '2027-09-15T14:00:00.000Z';
const LATER_DATE = '2027-11-20T14:00:00.000Z';

describe('Booking lifecycle (integration)', () => {
  let app: INestApplication;
  let customerId: string;

  beforeAll(async () => {
    app = await createTestApp();

    const contact = await prisma.contact.create({
      data: { userId: TEST_USER_ID, name: 'Test Customer' },
    });
    customerId = contact.id;
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.contact.deleteMany({ where: { userId: TEST_USER_ID } });
    await app.close();
  });

  // ── helpers ──────────────────────────────────────────────────────────────

  function createBooking(overrides: Record<string, unknown> = {}) {
    return request(app.getHttpServer())
      .post('/api/bookings')
      .send({
        eventType: 'WEDDING',
        date: FUTURE_DATE,
        customerId,
        checklistItems: CHECKLIST_DEFAULTS.map(({ key, label, completedBy, dependsOn, autoCompleteRule, requiredForStatus, dueDateRule }) => ({
          key,
          label,
          completedBy,
          dependsOn,
          autoCompleteRule,
          requiredForStatus,
          dueDateRule,
        })),
        ...overrides,
      });
  }

  // ── happy paths ──────────────────────────────────────────────────────────

  describe('Create booking → checklist seeded', () => {
    it('seeds key checklist items on creation', async () => {
      const res = await createBooking();
      expect(res.status).toBe(201);

      const bookingId = res.body.id as string;
      const checklist = await prisma.bookingChecklistItem.findMany({
        where: { bookingId },
      });

      const depositItem = checklist.find((i) => i.key === 'deposit_received');
      const contractItem = checklist.find((i) => i.key === 'create_contract');
      expect(depositItem).toBeDefined();
      // deposit_received has dependsOn: ['send_contract'] → starts BLOCKED, not PENDING
      expect(depositItem?.state).toBe('BLOCKED');
      expect(contractItem).toBeDefined();
      // create_contract has dependsOn: ['confirm_quote'] → starts BLOCKED, not PENDING
      expect(contractItem?.state).toBe('BLOCKED');

      // due dates for items with bookingDate-based rules should be near the booking date
      const sendContractItem = checklist.find((i) => i.key === 'send_contract');
      expect(sendContractItem?.dueDate).toBeTruthy();
      const bookingDate = new Date(FUTURE_DATE).getTime();
      const dueDate = new Date(sendContractItem!.dueDate!).getTime();
      // -60 days from bookingDate
      expect(Math.abs(dueDate - (bookingDate - 60 * 24 * 60 * 60 * 1000))).toBeLessThan(1000);

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  describe('Status happy path', () => {
    let bookingId: string;

    beforeAll(async () => {
      const res = await createBooking({ status: 'PROVISIONAL' });
      bookingId = res.body.id;
    });

    afterAll(async () => {
      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('starts PROVISIONAL', async () => {
      const res = await request(app.getHttpServer()).get(`/api/bookings/${bookingId}`);
      expect(res.body.status).toBe('PROVISIONAL');
    });

    it('transitions PROVISIONAL → CONFIRMED', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}`)
        .send({ status: 'CONFIRMED' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CONFIRMED');
    });

    it('transitions CONFIRMED → READY', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}`)
        .send({ status: 'READY' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('READY');
    });

    it('transitions READY → COMPLETE', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}`)
        .send({ status: 'COMPLETE' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('COMPLETE');
    });
  });

  describe('Cancel booking', () => {
    it('DELETE sets status to CANCELLED and booking persists', async () => {
      const create = await createBooking({ status: 'CONFIRMED' });
      const bookingId = create.body.id as string;

      const del = await request(app.getHttpServer()).delete(`/api/bookings/${bookingId}`);
      expect(del.status).toBe(204);

      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(booking).not.toBeNull();
      expect(booking?.status).toBe('CANCELLED');

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  describe('deposit_received checklist item', () => {
    it('marking COMPLETE sets depositReceivedAt on booking', async () => {
      const create = await createBooking();
      const bookingId = create.body.id as string;

      const checklist = await prisma.bookingChecklistItem.findMany({ where: { bookingId } });
      const depositItem = checklist.find((i) => i.key === 'deposit_received')!;

      const patch = await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}/checklist/${depositItem.id}`)
        .send({ state: 'COMPLETE' });
      expect(patch.status).toBe(200);

      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(booking?.depositReceivedAt).not.toBeNull();

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  describe('Update booking date → checklist due dates shift', () => {
    it('recomputes due dates when booking date changes', async () => {
      const create = await createBooking();
      const bookingId = create.body.id as string;

      const before = await prisma.bookingChecklistItem.findFirst({
        where: { bookingId, key: 'send_contract' },
      });
      expect(before?.dueDate).toBeTruthy();

      await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}`)
        .send({ date: LATER_DATE });

      const after = await prisma.bookingChecklistItem.findFirst({
        where: { bookingId, key: 'send_contract' },
      });

      // Due date should have shifted with the new booking date.
      // computeDueDate uses setDate (local time), so allow ±2h for DST transitions.
      const laterBookingDate = new Date(LATER_DATE).getTime();
      const expectedDue = laterBookingDate - 60 * 24 * 60 * 60 * 1000;
      const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
      expect(Math.abs(new Date(after!.dueDate!).getTime() - expectedDue)).toBeLessThan(TWO_HOURS_MS);

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  describe('GET /bookings CANCELLED filter', () => {
    it('excludes CANCELLED when active-pipeline statuses are requested', async () => {
      const active = await createBooking({ status: 'PROVISIONAL' });
      const activeId = active.body.id as string;

      const cancelled = await createBooking({ status: 'PROVISIONAL' });
      const cancelledId = cancelled.body.id as string;
      await request(app.getHttpServer()).delete(`/api/bookings/${cancelledId}`);

      // The frontend resting state sends explicit active-pipeline statuses — no API-level default.
      // No ?status= param means no filter (all statuses returned), per booking-search.spec.ts.
      const res = await request(app.getHttpServer())
        .get('/api/bookings?status=ENQUIRY&status=PROVISIONAL&status=CONFIRMED&status=READY');
      const ids = (res.body as Array<{ id: string }>).map((b) => b.id);
      expect(ids).toContain(activeId);
      expect(ids).not.toContain(cancelledId);

      await prisma.booking.deleteMany({ where: { id: { in: [activeId, cancelledId] } } });
    });

    it('includes CANCELLED when ?status=CANCELLED', async () => {
      const create = await createBooking({ status: 'PROVISIONAL' });
      const bookingId = create.body.id as string;
      await request(app.getHttpServer()).delete(`/api/bookings/${bookingId}`);

      const res = await request(app.getHttpServer()).get('/api/bookings?status=CANCELLED');
      const ids = (res.body as Array<{ id: string }>).map((b) => b.id);
      expect(ids).toContain(bookingId);

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  // ── unhappy paths ─────────────────────────────────────────────────────────

  describe('Unhappy paths', () => {
    it('GET non-existent booking → 404', async () => {
      const res = await request(app.getHttpServer()).get('/api/bookings/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });

    it('PATCH non-existent booking → 404', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/bookings/00000000-0000-0000-0000-000000000000')
        .send({ status: 'CONFIRMED' });
      expect(res.status).toBe(404);
    });

    it('DELETE non-existent booking → 404', async () => {
      const res = await request(app.getHttpServer()).delete('/api/bookings/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });

    it('POST missing required fields → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/bookings')
        .send({ eventType: 'WEDDING' }); // missing date, customerId, checklistItems
      expect(res.status).toBe(400);
    });

    it('POST invalid eventType → 400', async () => {
      const res = await createBooking({ eventType: 'INVALID_TYPE' });
      expect(res.status).toBe(400);
    });

    it('POST with non-existent customerId → verifies real DB response', async () => {
      const res = await createBooking({ customerId: '00000000-0000-0000-0000-000000000000' });
      // The real DB enforces the FK — should be a 4xx or 5xx error
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("GET another user's booking → 404 (multi-tenancy)", async () => {
      const otherContact = await prisma.contact.create({
        data: { userId: OTHER_USER_ID, name: 'Other Customer' },
      });
      const otherBooking = await prisma.booking.create({
        data: {
          userId: OTHER_USER_ID,
          eventType: 'CORPORATE',
          date: new Date(FUTURE_DATE),
          customerId: otherContact.id,
          status: 'PROVISIONAL',
          portalToken: `other-token-${Date.now()}`,
        },
      });

      const res = await request(app.getHttpServer()).get(`/api/bookings/${otherBooking.id}`);
      expect(res.status).toBe(404);

      await prisma.booking.delete({ where: { id: otherBooking.id } });
      await prisma.contact.delete({ where: { id: otherContact.id } });
    });
  });
});
