import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app.factory';
import { PrismaService } from '../src/prisma/prisma.service';
import { TEST_USER_ID } from './test-auth.guard';
import { CHECKLIST_DEFAULTS } from '../src/bookings/checklist-defaults';

const OTHER_USER_ID = 'checklist-other-user';
const FUTURE_DATE = '2027-09-15T14:00:00.000Z';

describe('ChecklistEvaluator (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customerId: string;
  let quoteTemplateId: string;
  let contractTemplateId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

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
      ({ key, label, completedBy, autoCompleteRule, requiredForStatus, dueDateRule }) => ({
        key,
        label,
        completedBy,
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

  // Resolve a key to its row whether it is a goal (BookingChecklistItem) or a step
  // (BookingChecklistStep) — ADR-0057 turned several flat keys (create_contract,
  // deposit_received, …) into steps of a goal. Both rows carry `state`.
  async function getItem(bookingId: string, key: string) {
    const goal = await prisma.bookingChecklistItem.findFirst({ where: { bookingId, key } });
    if (goal) return goal;
    return prisma.bookingChecklistStep.findFirst({ where: { bookingId, key } });
  }

  // ADR-0057: a key may now be a goal (BookingChecklistItem) OR a step (BookingChecklistStep) —
  // complete whichever it is so the setup actually advances the booking.
  async function forceComplete(bookingId: string, keys: string[]) {
    await Promise.all([
      prisma.bookingChecklistItem.updateMany({
        where: { bookingId, key: { in: keys } },
        data: { state: 'COMPLETE', completedAt: new Date() },
      }),
      prisma.bookingChecklistStep.updateMany({
        where: { bookingId, key: { in: keys } },
        data: { state: 'COMPLETE', completedAt: new Date() },
      }),
    ]);
  }

  // ── Auto-complete cascades ────────────────────────────────────────────────

  describe('Auto-complete cascades', () => {
    it('send_quote comm SENT → send_quote step COMPLETE, quote_accepted still PENDING (#616)', async () => {
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

      // ADR-0057 / #616: the quote is one goal (get_the_quote_accepted). Sending the quote comm
      // completes the send_quote step; the AWAITED quote_accepted step (no system signal) stays
      // PENDING until the musician marks the goal complete.
      const [sendQuote, quoteAccepted] = await Promise.all([
        getItem(bookingId, 'send_quote'),
        getItem(bookingId, 'quote_accepted'),
      ]);
      expect(sendQuote?.state).toBe('COMPLETE');
      expect(quoteAccepted?.state).toBe('PENDING');

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('contract created via API → create_contract COMPLETE', async () => {
      const bookingId = await createBooking();
      await forceComplete(bookingId, ['send_quote', 'quote_accepted']);

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
      await forceComplete(bookingId, ['send_quote', 'quote_accepted']);

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

    it('booking advanced to READY → get_contract_signed SKIPPED', async () => {
      const bookingId = await createBooking();

      // The contract goal is gated for CONFIRMED; advancing past it to READY skips the whole
      // goal (ADR-0057: SKIP retargets to the goal key — steps themselves never skip).
      const res = await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}`)
        .send({ status: 'READY' });
      expect(res.status).toBe(200);

      const item = await getItem(bookingId, 'get_contract_signed');
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
              autoCompleteRule: null,
              requiredForStatus: null,
              dueDateRule: null,
            },
            {
              key: 'custom_b',
              label: 'Custom step B',
              completedBy: 'USER',
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
      expect(keys).not.toContain('get_the_quote_accepted');

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('custom item with no autoCompleteRule stays PENDING after evaluate', async () => {
      const bookingId = await createBooking({
        checklistItems: [
          {
            key: 'no_rule',
            label: 'No rule item',
            completedBy: 'USER',
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

    it('custom item with dependsOn is never gated — it is PENDING throughout (BLOCKED retired, ADR-0057)', async () => {
      const bookingId = await createBooking({
        checklistItems: [
          {
            key: 'step_a',
            label: 'Step A',
            completedBy: 'USER',
            autoCompleteRule: null,
            requiredForStatus: null,
            dueDateRule: null,
          },
          {
            key: 'step_b',
            label: 'Step B',
            completedBy: 'USER',
            autoCompleteRule: null,
            requiredForStatus: null,
            dueDateRule: null,
          },
        ],
      });

      // Seeding still writes BLOCKED, but the create-time evaluate normalises it:
      // ADR-0057 retires the dependsOn gate, so step_b surfaces as PENDING from the
      // start rather than waiting on step_a.
      const stepBefore = await getItem(bookingId, 'step_b');
      expect(stepBefore?.state).toBe('PENDING');

      const stepA = await getItem(bookingId, 'step_a');
      await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}/checklist/${stepA!.id}`)
        .send({ state: 'COMPLETE' });

      // Completing step_a does not "unblock" step_b — it was already actionable.
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

    it('recording the deposit on the booking auto-completes the deposit_received step (sticky)', async () => {
      // ADR-0057: the deposit_received step is AWAITED and not user-PATCHable — the deposit fact is
      // recorded on the booking (here directly; in the app via the invoice mark-paid / booking
      // action), and the evaluator auto-completes the step. Completion is sticky (Story 23): later
      // clearing the booking field clears the field but does not un-complete the step.
      const bookingId = await createBooking();

      await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}`)
        .send({ depositReceivedAt: FUTURE_DATE });
      const afterSet = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(afterSet?.depositReceivedAt).not.toBeNull();
      expect((await getItem(bookingId, 'deposit_received'))?.state).toBe('COMPLETE');

      await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}`)
        .send({ depositReceivedAt: null });
      const afterClear = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(afterClear?.depositReceivedAt).toBeNull();
      // Sticky: the already-completed step stays COMPLETE.
      expect((await getItem(bookingId, 'deposit_received'))?.state).toBe('COMPLETE');

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
