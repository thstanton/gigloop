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
    await prisma.packageTemplate.deleteMany({ where: { userId: TEST_USER_ID } });
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
        checklistItems: CHECKLIST_DEFAULTS.map(({ key, label, completedBy, autoCompleteRule, requiredForStatus, dueDateRule }) => ({
          key,
          label,
          completedBy,
          autoCompleteRule,
          requiredForStatus,
          dueDateRule,
        })),
        ...overrides,
      });
  }

  // ── happy paths ──────────────────────────────────────────────────────────

  describe('Create booking → checklist seeded', () => {
    it('seeds key checklist goals + steps on creation', async () => {
      const res = await createBooking();
      expect(res.status).toBe(201);

      const bookingId = res.body.id as string;
      const goals = await prisma.bookingChecklistItem.findMany({ where: { bookingId } });
      const steps = await prisma.bookingChecklistStep.findMany({ where: { bookingId } });

      // The deposit + contract deliverables seed as multi-step goals (ADR-0057), PENDING — BLOCKED
      // is retired; the old flat keys (create_contract, deposit_received) are now steps.
      const depositGoal = goals.find((g) => g.key === 'get_deposit_paid');
      const contractGoal = goals.find((g) => g.key === 'get_contract_signed');
      expect(depositGoal?.state).toBe('PENDING');
      expect(contractGoal?.state).toBe('PENDING');
      expect(steps.find((s) => s.key === 'create_contract')?.state).toBe('PENDING');
      expect(steps.find((s) => s.key === 'deposit_received')?.state).toBe('PENDING');

      // The contract goal carries the -60d send deadline as its own dueDate.
      expect(contractGoal?.dueDate).toBeTruthy();
      const bookingDate = new Date(FUTURE_DATE).getTime();
      const dueDate = new Date(contractGoal!.dueDate!).getTime();
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
    it('recording the deposit on the booking sets depositReceivedAt + completes the step', async () => {
      // ADR-0057: deposit_received is an AWAITED step, not user-PATCHable; the deposit fact is
      // recorded on the booking (the invoice mark-paid / booking action), which the evaluator
      // then reflects onto the step.
      const create = await createBooking();
      const bookingId = create.body.id as string;

      const patch = await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}`)
        .send({ depositReceivedAt: FUTURE_DATE });
      expect(patch.status).toBe(200);

      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(booking?.depositReceivedAt).not.toBeNull();
      const step = await prisma.bookingChecklistStep.findFirst({ where: { bookingId, key: 'deposit_received' } });
      expect(step?.state).toBe('COMPLETE');

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  describe('Update booking date → checklist due dates shift', () => {
    it('recomputes due dates when booking date changes', async () => {
      const create = await createBooking();
      const bookingId = create.body.id as string;

      // The contract goal carries the -60d send deadline as its dueDate (the step's dueDateRule
      // rolls up to the goal); it recomputes when the booking date moves.
      const before = await prisma.bookingChecklistItem.findFirst({
        where: { bookingId, key: 'get_contract_signed' },
      });
      expect(before?.dueDate).toBeTruthy();

      await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}`)
        .send({ date: LATER_DATE });

      const after = await prisma.bookingChecklistItem.findFirst({
        where: { bookingId, key: 'get_contract_signed' },
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

  // ── ADR-0046: applied package is a snapshot, decoupled from its template ────

  describe('Apply package template → booking snapshots label/icon (provenance severed)', () => {
    it('editing the source PackageTemplate afterwards does not change the booking', async () => {
      // Library template the musician will apply.
      const template = await prisma.packageTemplate.create({
        data: {
          userId: TEST_USER_ID,
          label: 'Wedding Ceremony',
          icon: 'heart',
          category: 'WEDDING',
          keyMoments: [],
          defaultGenreSelection: [],
          slots: { create: [{ userId: TEST_USER_ID, label: 'Processional', duration: 30, order: 1 }] },
        },
      });

      const create = await createBooking();
      const bookingId = create.body.id as string;

      // Apply the template to the booking.
      const apply = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/packages`)
        .send({ packageTemplateId: template.id });
      expect(apply.status).toBe(201);

      // The booking-owned Package carries a snapshot of the template's label/icon,
      // and a set was copied from the template's slot. Apply returns { booking, suggestion }.
      const applied = apply.body.booking.packages as Array<{ id: string; label: string; icon: string }>;
      expect(applied).toHaveLength(1);
      expect(applied[0]).toMatchObject({ label: 'Wedding Ceremony', icon: 'heart' });
      const packageId = applied[0].id;
      const appliedSets = (apply.body.booking.sets as Array<{ packageId: string | null }>).filter(
        (s) => s.packageId === packageId,
      );
      expect(appliedSets).toHaveLength(1);

      // Mutate the source template after applying.
      await prisma.packageTemplate.update({
        where: { id: template.id },
        data: { label: 'RENAMED TEMPLATE', icon: 'star' },
      });

      // The booking's snapshot must be unaffected — provenance is severed (ADR-0046).
      const after = await request(app.getHttpServer()).get(`/api/bookings/${bookingId}`);
      const pkg = (after.body.packages as Array<{ id: string; label: string; icon: string }>).find(
        (p) => p.id === packageId,
      );
      expect(pkg).toBeDefined();
      expect(pkg!.label).toBe('Wedding Ceremony');
      expect(pkg!.icon).toBe('heart');

      await prisma.booking.delete({ where: { id: bookingId } });
      await prisma.packageTemplate.delete({ where: { id: template.id } });
    });

    it('renaming/re-iconing a booking Package leaves the source template unchanged (#500)', async () => {
      const template = await prisma.packageTemplate.create({
        data: {
          userId: TEST_USER_ID,
          label: 'Ceremony',
          icon: 'heart',
          category: 'WEDDING',
          keyMoments: [],
          defaultGenreSelection: [],
          slots: { create: [{ userId: TEST_USER_ID, label: 'Processional', duration: 30, order: 1 }] },
        },
      });
      const create = await createBooking();
      const bookingId = create.body.id as string;
      const apply = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/packages`)
        .send({ packageTemplateId: template.id });
      const packageId = (apply.body.booking.packages as Array<{ id: string }>)[0].id;

      // Rename + re-icon the booking-owned Package.
      const patched = await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}/packages/${packageId}`)
        .send({ label: 'Evening Reception', icon: 'music' });
      expect(patched.status).toBe(200);
      const pkg = (patched.body.packages as Array<{ id: string; label: string; icon: string }>).find(
        (p) => p.id === packageId,
      );
      expect(pkg).toMatchObject({ label: 'Evening Reception', icon: 'music' });

      // The source PackageTemplate row must be untouched — provenance is severed.
      const templateAfter = await prisma.packageTemplate.findUnique({ where: { id: template.id } });
      expect(templateAfter!.label).toBe('Ceremony');
      expect(templateAfter!.icon).toBe('heart');

      await prisma.booking.delete({ where: { id: bookingId } });
      await prisma.packageTemplate.delete({ where: { id: template.id } });
    });

    it('removing a booking Package orphans its sets to ungrouped instead of deleting them (#500)', async () => {
      const template = await prisma.packageTemplate.create({
        data: {
          userId: TEST_USER_ID,
          label: 'Ceremony',
          icon: 'heart',
          category: 'WEDDING',
          keyMoments: [],
          defaultGenreSelection: [],
          slots: { create: [{ userId: TEST_USER_ID, label: 'Processional', duration: 30, order: 1 }] },
        },
      });
      const create = await createBooking();
      const bookingId = create.body.id as string;
      const apply = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/packages`)
        .send({ packageTemplateId: template.id });
      const packageId = (apply.body.booking.packages as Array<{ id: string }>)[0].id;
      const setId = (apply.body.booking.sets as Array<{ id: string; packageId: string | null }>).find(
        (s) => s.packageId === packageId,
      )!.id;

      // Remove the package.
      const remove = await request(app.getHttpServer()).delete(
        `/api/bookings/${bookingId}/packages/${packageId}`,
      );
      expect(remove.status).toBe(204);

      // The set survives, now ungrouped (packageId null); the Package is gone.
      const after = await request(app.getHttpServer()).get(`/api/bookings/${bookingId}`);
      expect((after.body.packages as unknown[]).length).toBe(0);
      const survivor = (after.body.sets as Array<{ id: string; packageId: string | null }>).find(
        (s) => s.id === setId,
      );
      expect(survivor).toBeDefined();
      expect(survivor!.packageId).toBeNull();

      await prisma.booking.delete({ where: { id: bookingId } });
      await prisma.packageTemplate.delete({ where: { id: template.id } });
    });
  });

  describe('Music form ↔ Packages (key moments, ADR-0046 / #502)', () => {
    async function applyTemplate(bookingId: string, templateId: string) {
      const res = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/packages`)
        .send({ packageTemplateId: templateId });
      expect(res.status).toBe(201);
      return res.body as {
        booking: { packages: Array<{ id: string; label: string }> };
        suggestion: { keyMoments: Array<{ label: string; section: string }>; genres: string[] } | null;
      };
    }

    function getConfig(bookingId: string) {
      return request(app.getHttpServer()).get(`/api/bookings/${bookingId}/music-form-config`);
    }

    it('applying a template while the form is on suggests its moments/genres without forcing them', async () => {
      const template = await prisma.packageTemplate.create({
        data: {
          userId: TEST_USER_ID, label: 'Ceremony', icon: 'heart', category: 'WEDDING',
          keyMoments: ['Processional', 'First dance'], defaultGenreSelection: ['JAZZ'],
          slots: { create: [{ userId: TEST_USER_ID, label: 'Processional', duration: 30, order: 1 }] },
        },
      });
      // Form on, but starts empty.
      const create = await createBooking({ enableMusicForm: true });
      const bookingId = create.body.id as string;

      const apply = await applyTemplate(bookingId, template.id);

      // Suggestion carries the template's moments (sectioned by the new package's label) + genres…
      expect(apply.suggestion).toEqual({
        keyMoments: [
          { label: 'Processional', section: 'Ceremony' },
          { label: 'First dance', section: 'Ceremony' },
        ],
        genres: ['JAZZ'],
      });
      // …but the persisted config is untouched — suggest, never force.
      const config = await getConfig(bookingId);
      expect(config.body.keyMoments).toEqual([]);
      expect(config.body.enabledGenres).toEqual([]);

      await prisma.booking.delete({ where: { id: bookingId } });
      await prisma.packageTemplate.delete({ where: { id: template.id } });
    });

    it('returns no suggestion when the music form is off', async () => {
      const template = await prisma.packageTemplate.create({
        data: {
          userId: TEST_USER_ID, label: 'Ceremony', icon: 'heart', category: 'WEDDING',
          keyMoments: ['Processional'], defaultGenreSelection: ['JAZZ'],
          slots: { create: [{ userId: TEST_USER_ID, label: 'Processional', duration: 30, order: 1 }] },
        },
      });
      const create = await createBooking(); // form off
      const bookingId = create.body.id as string;

      const apply = await applyTemplate(bookingId, template.id);
      expect(apply.suggestion).toBeNull();

      await prisma.booking.delete({ where: { id: bookingId } });
      await prisma.packageTemplate.delete({ where: { id: template.id } });
    });

    it('removing a Package moves its key moments to "Other" without deleting them; the last removal leaves all moments under "Other"', async () => {
      const template = await prisma.packageTemplate.create({
        data: {
          userId: TEST_USER_ID, label: 'Ceremony', icon: 'heart', category: 'WEDDING',
          keyMoments: [], defaultGenreSelection: [],
          slots: { create: [{ userId: TEST_USER_ID, label: 'Processional', duration: 30, order: 1 }] },
        },
      });
      const create = await createBooking({ enableMusicForm: true });
      const bookingId = create.body.id as string;

      const apply = await applyTemplate(bookingId, template.id);
      const packageId = apply.booking.packages[0].id; // label 'Ceremony'

      // Musician assigns moments to the Package and to an ad-hoc "Other" moment.
      await request(app.getHttpServer())
        .put(`/api/bookings/${bookingId}/music-form-config`)
        .send({
          enabledGenres: [],
          keyMoments: [
            { label: 'Processional', section: 'Ceremony' },
            { label: 'Speeches', section: 'Other' },
          ],
        });

      // Remove the (only) Package.
      const remove = await request(app.getHttpServer()).delete(
        `/api/bookings/${bookingId}/packages/${packageId}`,
      );
      expect(remove.status).toBe(204);

      // The Ceremony moment moved to "Other"; nothing was deleted; with no Packages
      // left, every moment is under "Other".
      const config = await getConfig(bookingId);
      expect(config.body.keyMoments).toEqual([
        { label: 'Processional', section: 'Other' },
        { label: 'Speeches', section: 'Other' },
      ]);

      await prisma.booking.delete({ where: { id: bookingId } });
      await prisma.packageTemplate.delete({ where: { id: template.id } });
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
