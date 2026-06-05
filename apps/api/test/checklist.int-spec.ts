import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app.factory';
import { prisma } from './test-prisma';
import { TEST_USER_ID } from './test-auth.guard';
import { CHECKLIST_DEFAULTS } from '../src/bookings/checklist-defaults';

const OTHER_USER_ID = 'checklist-other-user';
const FUTURE_DATE = '2027-09-15T14:00:00.000Z';

describe('ChecklistEvaluator (integration)', () => {
  let app: INestApplication;
  let customerId: string;
  let quoteTemplateId: string;
  let contractTemplateId: string;

  beforeAll(async () => {
    app = await createTestApp();

    const contact = await prisma.contact.create({
      data: { userId: TEST_USER_ID, name: 'Checklist Test Contact' },
    });
    customerId = contact.id;

    const [quoteT, contractT] = await Promise.all([
      prisma.template.create({
        data: { userId: TEST_USER_ID, name: 'Quote', builtInType: 'quote', content: {} },
      }),
      prisma.template.create({
        data: {
          userId: TEST_USER_ID,
          name: 'Contract',
          builtInType: 'contract',
          content: { type: 'doc', content: [] },
        },
      }),
    ]);
    quoteTemplateId = quoteT.id;
    contractTemplateId = contractT.id;

    // Portal signing requires a public profile for the user
    await prisma.publicProfile.upsert({
      where: { userId: TEST_USER_ID },
      create: { userId: TEST_USER_ID, businessName: 'Test Band' },
      update: {},
    });
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.contact.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.template.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.publicProfile.deleteMany({ where: { userId: TEST_USER_ID } });
    await app.close();
  });

  // ── helpers ───────────────────────────────────────────────────────────────

  function allDefaultItems() {
    return CHECKLIST_DEFAULTS.map(
      ({ key, label, completedBy, dependsOn, autoCompleteRule, requiredForStatus, dueDateRule }) => ({
        key,
        label,
        completedBy,
        dependsOn,
        autoCompleteRule,
        requiredForStatus,
        dueDateRule,
      }),
    );
  }

  async function createBooking(overrides: Record<string, unknown> = {}): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/bookings')
      .send({
        eventType: 'WEDDING',
        date: FUTURE_DATE,
        customerId,
        checklistItems: allDefaultItems(),
        ...overrides,
      });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  function getItem(bookingId: string, key: string) {
    return prisma.bookingChecklistItem.findFirst({ where: { bookingId, key } });
  }

  async function forceComplete(bookingId: string, keys: string[]) {
    await prisma.bookingChecklistItem.updateMany({
      where: { bookingId, key: { in: keys } },
      data: { state: 'COMPLETE', completedAt: new Date() },
    });
  }

  // ── Auto-complete cascades ────────────────────────────────────────────────

  describe('Auto-complete cascades', () => {
    it('send_quote comm SENT → send_quote COMPLETE + confirm_quote unblocked (same evaluate pass)', async () => {
      const bookingId = await createBooking();

      const res = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/communications/send`)
        .send({
          to: 'client@example.com',
          contactId: customerId,
          subject: 'Your quote',
          body: '<p>Quote</p>',
          templateId: quoteTemplateId,
        });
      expect(res.status).toBe(204);

      const [sendQuote, confirmQuote] = await Promise.all([
        getItem(bookingId, 'send_quote'),
        getItem(bookingId, 'confirm_quote'),
      ]);
      expect(sendQuote?.state).toBe('COMPLETE');
      expect(confirmQuote?.state).toBe('PENDING'); // was BLOCKED, now unblocked

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('contract created via API → create_contract COMPLETE', async () => {
      const bookingId = await createBooking();
      await forceComplete(bookingId, ['send_quote', 'confirm_quote']);

      const res = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/contracts`)
        .send({});
      expect(res.status).toBe(201);

      const item = await getItem(bookingId, 'create_contract');
      expect(item?.state).toBe('COMPLETE');

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('contract signed via portal → contract_signed COMPLETE', async () => {
      const bookingId = await createBooking();
      await forceComplete(bookingId, ['send_quote', 'confirm_quote']);

      const contractRes = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/contracts`)
        .send({});
      expect(contractRes.status).toBe(201);
      const contractId = contractRes.body.id as string;

      // Contract must be SENT before portal signing
      await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/contracts/${contractId}/send`)
        .send({});

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { portalToken: true },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/booking/${booking!.portalToken}/sign`)
        // Minimal 1×1 transparent PNG — pdfmake requires a valid image
        .send({ signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' });
      expect(res.status).toBe(201);

      const item = await getItem(bookingId, 'contract_signed');
      expect(item?.state).toBe('COMPLETE');

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('booking advanced to READY → contract_signed SKIPPED', async () => {
      const bookingId = await createBooking();

      // contract_signed starts BLOCKED; SKIP_RULES fire when status reaches READY
      const res = await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}`)
        .send({ status: 'READY' });
      expect(res.status).toBe(200);

      const item = await getItem(bookingId, 'contract_signed');
      expect(item?.state).toBe('SKIPPED');

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  // ── Customisation ─────────────────────────────────────────────────────────

  describe('Customisation', () => {
    it('seeds only provided checklist items, not system defaults', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/bookings')
        .send({
          eventType: 'WEDDING',
          date: FUTURE_DATE,
          customerId,
          checklistItems: [
            {
              key: 'custom_a',
              label: 'Custom step A',
              completedBy: 'USER',
              dependsOn: [],
              autoCompleteRule: null,
              requiredForStatus: null,
              dueDateRule: null,
            },
            {
              key: 'custom_b',
              label: 'Custom step B',
              completedBy: 'USER',
              dependsOn: [],
              autoCompleteRule: null,
              requiredForStatus: null,
              dueDateRule: null,
            },
          ],
        });
      expect(res.status).toBe(201);
      const bookingId = res.body.id as string;

      const checklist = await prisma.bookingChecklistItem.findMany({ where: { bookingId } });
      expect(checklist).toHaveLength(2);
      const keys = checklist.map((i) => i.key);
      expect(keys).toContain('custom_a');
      expect(keys).toContain('custom_b');
      expect(keys).not.toContain('send_quote');

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('custom item with no autoCompleteRule stays PENDING after evaluate', async () => {
      const bookingId = await createBooking({
        checklistItems: [
          {
            key: 'no_rule',
            label: 'No rule item',
            completedBy: 'USER',
            dependsOn: [],
            autoCompleteRule: null,
            requiredForStatus: null,
            dueDateRule: null,
          },
        ],
      });

      // Trigger evaluate via status patch
      await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}`)
        .send({ status: 'CONFIRMED' });

      const item = await getItem(bookingId, 'no_rule');
      expect(item?.state).toBe('PENDING');

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('custom dependency chain: completing dependency unblocks dependent', async () => {
      const bookingId = await createBooking({
        checklistItems: [
          {
            key: 'step_a',
            label: 'Step A',
            completedBy: 'USER',
            dependsOn: [],
            autoCompleteRule: null,
            requiredForStatus: null,
            dueDateRule: null,
          },
          {
            key: 'step_b',
            label: 'Step B',
            completedBy: 'USER',
            dependsOn: ['step_a'],
            autoCompleteRule: null,
            requiredForStatus: null,
            dueDateRule: null,
          },
        ],
      });

      const stepBefore = await getItem(bookingId, 'step_b');
      expect(stepBefore?.state).toBe('BLOCKED');

      const stepA = await getItem(bookingId, 'step_a');
      await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}/checklist/${stepA!.id}`)
        .send({ state: 'COMPLETE' });

      const stepAfter = await getItem(bookingId, 'step_b');
      expect(stepAfter?.state).toBe('PENDING');

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('ad-hoc item added post-creation appears in checklist and can be manually completed', async () => {
      const bookingId = await createBooking();

      const addRes = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/checklist`)
        .send({ label: 'Check venue parking' });
      expect(addRes.status).toBe(201);
      const newItemId = addRes.body.id as string;

      const checklist = await request(app.getHttpServer()).get(`/api/bookings/${bookingId}/checklist`);
      const found = (checklist.body as Array<{ id: string }>).find((i) => i.id === newItemId);
      expect(found).toBeDefined();

      const patchRes = await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}/checklist/${newItemId}`)
        .send({ state: 'COMPLETE' });
      expect(patchRes.status).toBe(200);

      const item = await prisma.bookingChecklistItem.findUnique({ where: { id: newItemId } });
      expect(item?.state).toBe('COMPLETE');

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  // ── Undo behaviour ────────────────────────────────────────────────────────

  describe('Undo behaviour', () => {
    it('manually-completable item: mark COMPLETE → un-mark → returns to PENDING', async () => {
      const bookingId = await createBooking();
      const item = await getItem(bookingId, 'play_the_gig');

      await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}/checklist/${item!.id}`)
        .send({ state: 'COMPLETE' });
      expect((await getItem(bookingId, 'play_the_gig'))?.state).toBe('COMPLETE');

      await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}/checklist/${item!.id}`)
        .send({ state: 'PENDING' });
      expect((await getItem(bookingId, 'play_the_gig'))?.state).toBe('PENDING');

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('deposit_received: un-mark clears depositReceivedAt on booking', async () => {
      const bookingId = await createBooking();
      // Unblock deposit_received by completing its dependency
      await forceComplete(bookingId, ['send_contract']);

      const item = await getItem(bookingId, 'deposit_received');

      await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}/checklist/${item!.id}`)
        .send({ state: 'COMPLETE' });
      const afterComplete = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(afterComplete?.depositReceivedAt).not.toBeNull();

      await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}/checklist/${item!.id}`)
        .send({ state: 'PENDING' });
      const afterUnmark = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(afterUnmark?.depositReceivedAt).toBeNull();

      const itemAfter = await getItem(bookingId, 'deposit_received');
      expect(itemAfter?.state).toBe('PENDING');

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  // ── Unhappy paths ─────────────────────────────────────────────────────────

  describe('Unhappy paths', () => {
    it('communication FAILED → matching checklist item becomes FAILED', async () => {
      const bookingId = await createBooking();

      await prisma.communication.create({
        data: {
          userId: TEST_USER_ID,
          bookingId,
          contactId: customerId,
          subject: 'Quote email',
          body: '<p>Failed quote</p>',
          status: 'FAILED',
          templateId: quoteTemplateId,
        },
      });

      // Trigger evaluate via status patch
      await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}`)
        .send({ status: 'CONFIRMED' });

      const item = await getItem(bookingId, 'send_quote');
      expect(item?.state).toBe('FAILED');

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('PATCH non-existent checklist item → 404', async () => {
      const bookingId = await createBooking();
      const res = await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}/checklist/00000000-0000-0000-0000-000000000000`)
        .send({ state: 'COMPLETE' });
      expect(res.status).toBe(404);
      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it("PATCH checklist item from another user's booking → 404 (multi-tenancy)", async () => {
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
          portalToken: `other-checklist-token-${Date.now()}`,
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/bookings/${otherBooking.id}/checklist/00000000-0000-0000-0000-000000000000`)
        .send({ state: 'COMPLETE' });
      expect(res.status).toBe(404);

      await prisma.booking.delete({ where: { id: otherBooking.id } });
      await prisma.contact.delete({ where: { id: otherContact.id } });
    });

    it('POST ad-hoc checklist item missing label → 400', async () => {
      const bookingId = await createBooking();
      const res = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/checklist`)
        .send({});
      expect(res.status).toBe(400);
      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('re-patch already-COMPLETE item → stays COMPLETE (evaluator skips it)', async () => {
      const bookingId = await createBooking();
      const item = await getItem(bookingId, 'play_the_gig');

      await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}/checklist/${item!.id}`)
        .send({ state: 'COMPLETE' });

      const res = await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}/checklist/${item!.id}`)
        .send({ state: 'COMPLETE' });
      expect(res.status).toBe(200);

      const itemAfter = await getItem(bookingId, 'play_the_gig');
      expect(itemAfter?.state).toBe('COMPLETE');

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });
});
