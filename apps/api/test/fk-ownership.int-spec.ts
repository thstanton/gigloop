/**
 * Integration tests for inbound FK-ownership validation (#709 / ADR-0061).
 *
 * A userId-scoped write proves the row written belongs to the caller, but not the foreign keys it
 * references. These tests drive the real HTTP stack (guard → controller → service → ContactsService
 * → Prisma) and assert that attaching a *foreign* contact to an owned booking / invoice / email is
 * rejected with 404 — closing the cross-tenant read that would otherwise leak the foreign contact's
 * details back through the owned read path. Owned FKs still succeed (regression-safe).
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app.factory';
import { PrismaService } from '../src/prisma/prisma.service';
import { TEST_USER_ID } from './test-auth.guard';

const OTHER_USER_ID = 'fk-other-user-id';
const FUTURE_DATE = '2027-09-15T14:00:00.000Z';

describe('FK-ownership validation (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownedContactId: string;
  let foreignContactId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const owned = await prisma.contact.create({ data: { userId: TEST_USER_ID, name: 'Owned Customer' } });
    ownedContactId = owned.id;
    const foreign = await prisma.contact.create({ data: { userId: OTHER_USER_ID, name: 'Foreign Contact' } });
    foreignContactId = foreign.id;
  });

  afterAll(async () => {
    await prisma.communication.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.invoice.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.booking.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.contact.deleteMany({ where: { userId: { in: [TEST_USER_ID, OTHER_USER_ID] } } });
    await app.close();
  });

  function postBooking(overrides: Record<string, unknown> = {}) {
    return request(app.getHttpServer())
      .post('/api/bookings')
      .send({ eventType: 'WEDDING', date: FUTURE_DATE, customerId: ownedContactId, checklistItems: [], ...overrides });
  }

  describe('booking creation', () => {
    it('rejects a foreign customerId with 404 and creates nothing', async () => {
      const before = await prisma.booking.count({ where: { userId: TEST_USER_ID } });
      const res = await postBooking({ customerId: foreignContactId });
      expect(res.status).toBe(404);
      const after = await prisma.booking.count({ where: { userId: TEST_USER_ID } });
      expect(after).toBe(before);
    });

    it('rejects a foreign venueId with 404', async () => {
      const res = await postBooking({ venueId: foreignContactId });
      expect(res.status).toBe(404);
    });

    it('rejects a foreign bookingAgentId with 404', async () => {
      const res = await postBooking({ bookingAgentId: foreignContactId });
      expect(res.status).toBe(404);
    });

    it('accepts owned contacts (happy path)', async () => {
      const res = await postBooking({ venueId: ownedContactId });
      expect(res.status).toBe(201);
      await prisma.booking.delete({ where: { id: res.body.id } });
    });
  });

  describe('booking update', () => {
    it('rejects patching in a foreign venueId with 404', async () => {
      const created = await postBooking();
      const bookingId = created.body.id as string;

      const res = await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}`)
        .send({ venueId: foreignContactId });
      expect(res.status).toBe(404);

      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(booking?.venueId).toBeNull();

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  describe('invoice creation', () => {
    let bookingId: string;
    beforeAll(async () => {
      const res = await postBooking();
      bookingId = res.body.id;
    });
    afterAll(async () => {
      await prisma.invoice.deleteMany({ where: { bookingId } });
      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('rejects an explicitly-provided foreign billToContactId with 404', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/invoices`)
        .send({ isDeposit: true, billToContactId: foreignContactId });
      expect(res.status).toBe(404);
    });

    it('accepts an omitted billToContactId — falls back to the owned booking customer (happy path)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/invoices`)
        .send({ isDeposit: true });
      expect(res.status).toBe(201);
    });

    it('rejects re-pointing a draft invoice to a foreign billToContactId with 404', async () => {
      const created = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/invoices`)
        .send({ isDeposit: false });
      expect(created.status).toBe(201);
      const invoiceId = created.body.id as string;

      const res = await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}/invoices/${invoiceId}`)
        .send({ billToContactId: foreignContactId });
      expect(res.status).toBe(404);

      const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      expect(invoice?.billToContactId).not.toBe(foreignContactId);
    });
  });

  describe('sending email', () => {
    it('rejects a foreign recipient contactId with 404 and never records a communication', async () => {
      const created = await postBooking();
      const bookingId = created.body.id as string;

      const res = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/communications/send`)
        .send({ to: 'someone@example.com', contactId: foreignContactId, subject: 'Hi', body: '<p>Hi</p>' });
      expect(res.status).toBe(404);

      const comms = await prisma.communication.count({ where: { bookingId } });
      expect(comms).toBe(0);

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });
});
