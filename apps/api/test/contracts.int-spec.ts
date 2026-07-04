import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, mockStorageService } from './test-app.factory';
import { PrismaService } from '../src/prisma/prisma.service';
import { TEST_USER_ID } from './test-auth.guard';
import { CHECKLIST_DEFAULTS } from '../src/bookings/checklist-defaults';

const FUTURE_DATE = '2027-09-15T14:00:00.000Z';
// Minimal 1×1 transparent PNG — smallest valid image pdfmake accepts
const SIGNATURE_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('Contract flow (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customerId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const contact = await prisma.contact.create({
      data: { userId: TEST_USER_ID, name: 'Contract Test Customer' },
    });
    customerId = contact.id;

    await Promise.all([
      prisma.template.create({
        data: {
          userId: TEST_USER_ID,
          name: 'Contract Template',
          builtInType: 'contract',
          content: { type: 'doc', content: [] },
        },
      }),
      prisma.publicProfile.upsert({
        where: { userId: TEST_USER_ID },
        create: { userId: TEST_USER_ID, businessName: 'Test Band' },
        update: {},
      }),
    ]);
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.contact.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.template.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.publicProfile.deleteMany({ where: { userId: TEST_USER_ID } });
    await app.close();
  });

  beforeEach(() => {
    mockStorageService.putObject.mockClear();
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

  async function createContract(bookingId: string): Promise<{ id: string; status: string }> {
    const res = await request(app.getHttpServer())
      .post(`/api/bookings/${bookingId}/contracts`)
      .send({});
    expect(res.status).toBe(201);
    return res.body as { id: string; status: string };
  }

  async function sendContract(bookingId: string, contractId: string): Promise<void> {
    const res = await request(app.getHttpServer())
      .post(`/api/bookings/${bookingId}/contracts/${contractId}/send`)
      .send({});
    expect(res.status).toBe(200);
  }

  async function getPortalToken(bookingId: string): Promise<string> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { portalToken: true },
    });
    return booking!.portalToken;
  }

  async function forceCompleteChecklist(bookingId: string, keys: string[]): Promise<void> {
    await prisma.bookingChecklistItem.updateMany({
      where: { bookingId, key: { in: keys } },
      data: { state: 'COMPLETE', completedAt: new Date() },
    });
  }

  // Resolve a key to its goal (BookingChecklistItem) or step (BookingChecklistStep) row —
  // ADR-0057 turned contract_signed into a step of get_contract_signed.
  async function getChecklistItem(bookingId: string, key: string) {
    const goal = await prisma.bookingChecklistItem.findFirst({ where: { bookingId, key } });
    if (goal) return goal;
    return prisma.bookingChecklistStep.findFirst({ where: { bookingId, key } });
  }

  // ── happy paths ────────────────────────────────────────────────────────────

  describe('Full sign flow', () => {
    it('DRAFT → SENT → portal GET content → portal sign → SIGNED with correct state', async () => {
      const bookingId = await createBooking();
      await forceCompleteChecklist(bookingId, ['send_quote', 'confirm_quote']);

      const contract = await createContract(bookingId);
      expect(contract.status).toBe('DRAFT');

      await sendContract(bookingId, contract.id);

      // No Document created at send time
      const docsBeforeSign = await prisma.document.findMany({ where: { bookingId } });
      expect(docsBeforeSign).toHaveLength(0);

      const token = await getPortalToken(bookingId);

      const contentRes = await request(app.getHttpServer())
        .get(`/api/booking/${token}/contract`);
      expect(contentRes.status).toBe(200);
      expect(contentRes.body).toHaveProperty('content');
      expect(contentRes.body).toHaveProperty('title');

      const signRes = await request(app.getHttpServer())
        .post(`/api/booking/${token}/sign`)
        .send({ signature: SIGNATURE_PNG });
      expect(signRes.status).toBe(201);

      // Contract: SIGNED, signedAt set, signedFromIp non-null
      const signedContract = await prisma.contract.findUnique({ where: { id: contract.id } });
      expect(signedContract?.status).toBe('SIGNED');
      expect(signedContract?.signedAt).not.toBeNull();
      expect(signedContract?.signedFromIp).not.toBeNull();

      // contract_signed checklist item COMPLETE
      const item = await getChecklistItem(bookingId, 'contract_signed');
      expect(item?.state).toBe('COMPLETE');

      // Document record created and linked to the contract
      const docs = await prisma.document.findMany({ where: { bookingId, type: 'CONTRACT' } });
      expect(docs).toHaveLength(1);
      expect(docs[0].contractId).toBe(contract.id);

      // StorageService.putObject called once (signed contract PDF)
      expect(mockStorageService.putObject).toHaveBeenCalledTimes(1);

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  describe('DRAFT → SENT: no Document generated at send time', () => {
    it('sends without creating a Document record', async () => {
      const bookingId = await createBooking();
      await forceCompleteChecklist(bookingId, ['send_quote', 'confirm_quote']);

      const contract = await createContract(bookingId);
      await sendContract(bookingId, contract.id);

      const docs = await prisma.document.findMany({ where: { bookingId } });
      expect(docs).toHaveLength(0);

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  describe('Void + new contract', () => {
    it('void SENT contract → create new → send → sign → new SIGNED, original VOID', async () => {
      const bookingId = await createBooking();
      await forceCompleteChecklist(bookingId, ['send_quote', 'confirm_quote']);

      const first = await createContract(bookingId);
      await sendContract(bookingId, first.id);

      // Void the first (SENT) contract
      const voidRes = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/contracts/${first.id}/void`)
        .send({});
      expect(voidRes.status).toBe(204);

      const second = await createContract(bookingId);
      await sendContract(bookingId, second.id);

      const token = await getPortalToken(bookingId);
      const signRes = await request(app.getHttpServer())
        .post(`/api/booking/${token}/sign`)
        .send({ signature: SIGNATURE_PNG });
      expect(signRes.status).toBe(201);

      const [firstContract, secondContract] = await Promise.all([
        prisma.contract.findUnique({ where: { id: first.id } }),
        prisma.contract.findUnique({ where: { id: second.id } }),
      ]);
      expect(firstContract?.status).toBe('VOID');
      expect(secondContract?.status).toBe('SIGNED');

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  describe('Void SIGNED contract', () => {
    it('with confirmSignedVoid=true → succeeds', async () => {
      const bookingId = await createBooking();
      await forceCompleteChecklist(bookingId, ['send_quote', 'confirm_quote']);

      const contract = await createContract(bookingId);
      await sendContract(bookingId, contract.id);

      const token = await getPortalToken(bookingId);
      await request(app.getHttpServer())
        .post(`/api/booking/${token}/sign`)
        .send({ signature: SIGNATURE_PNG });

      const voidRes = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/contracts/${contract.id}/void`)
        .send({ confirmSignedVoid: true });
      expect(voidRes.status).toBe(204);

      const voided = await prisma.contract.findUnique({ where: { id: contract.id } });
      expect(voided?.status).toBe('VOID');

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });

  // ── unhappy paths ──────────────────────────────────────────────────────────

  describe('Unhappy paths', () => {
    it('transition non-DRAFT contract to SENT → 400', async () => {
      const bookingId = await createBooking();
      await forceCompleteChecklist(bookingId, ['send_quote', 'confirm_quote']);

      const contract = await createContract(bookingId);
      await sendContract(bookingId, contract.id);

      // Try to send again — contract is already SENT
      const res = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/contracts/${contract.id}/send`)
        .send({});
      expect(res.status).toBe(400);

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('void SIGNED without confirmSignedVoid=true → 400', async () => {
      const bookingId = await createBooking();
      await forceCompleteChecklist(bookingId, ['send_quote', 'confirm_quote']);

      const contract = await createContract(bookingId);
      await sendContract(bookingId, contract.id);

      const token = await getPortalToken(bookingId);
      await request(app.getHttpServer())
        .post(`/api/booking/${token}/sign`)
        .send({ signature: SIGNATURE_PNG });

      const res = await request(app.getHttpServer())
        .post(`/api/bookings/${bookingId}/contracts/${contract.id}/void`)
        .send({});
      expect(res.status).toBe(400);

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('portal GET contract — invalid token → 404', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/booking/invalid-portal-token-xyz/contract');
      expect(res.status).toBe(404);
    });

    it('portal GET contract — contract is DRAFT → 404', async () => {
      const bookingId = await createBooking();
      await forceCompleteChecklist(bookingId, ['send_quote', 'confirm_quote']);
      await createContract(bookingId);

      const token = await getPortalToken(bookingId);
      const res = await request(app.getHttpServer())
        .get(`/api/booking/${token}/contract`);
      expect(res.status).toBe(404);

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('portal GET contract — contract already SIGNED → 400 already_signed', async () => {
      const bookingId = await createBooking();
      await forceCompleteChecklist(bookingId, ['send_quote', 'confirm_quote']);

      const contract = await createContract(bookingId);
      await sendContract(bookingId, contract.id);

      const token = await getPortalToken(bookingId);
      await request(app.getHttpServer())
        .post(`/api/booking/${token}/sign`)
        .send({ signature: SIGNATURE_PNG });

      const res = await request(app.getHttpServer())
        .get(`/api/booking/${token}/contract`);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('already_signed');

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('portal sign — invalid token → 404', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/booking/invalid-token-xyz/sign')
        .send({ signature: SIGNATURE_PNG });
      expect(res.status).toBe(404);
    });

    it('portal sign — already SIGNED → 400', async () => {
      const bookingId = await createBooking();
      await forceCompleteChecklist(bookingId, ['send_quote', 'confirm_quote']);

      const contract = await createContract(bookingId);
      await sendContract(bookingId, contract.id);

      const token = await getPortalToken(bookingId);
      await request(app.getHttpServer())
        .post(`/api/booking/${token}/sign`)
        .send({ signature: SIGNATURE_PNG });

      const res = await request(app.getHttpServer())
        .post(`/api/booking/${token}/sign`)
        .send({ signature: SIGNATURE_PNG });
      expect(res.status).toBe(400);

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('portal sign — missing signature body → 400', async () => {
      const bookingId = await createBooking();
      await forceCompleteChecklist(bookingId, ['send_quote', 'confirm_quote']);

      const contract = await createContract(bookingId);
      await sendContract(bookingId, contract.id);

      const token = await getPortalToken(bookingId);
      const res = await request(app.getHttpServer())
        .post(`/api/booking/${token}/sign`)
        .send({});
      expect(res.status).toBe(400);

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('hard-delete DRAFT contract → 204', async () => {
      const bookingId = await createBooking();
      await forceCompleteChecklist(bookingId, ['send_quote', 'confirm_quote']);

      const contract = await createContract(bookingId);

      const res = await request(app.getHttpServer())
        .delete(`/api/bookings/${bookingId}/contracts/${contract.id}`);
      expect(res.status).toBe(204);

      const deleted = await prisma.contract.findUnique({ where: { id: contract.id } });
      expect(deleted).toBeNull();

      await prisma.booking.delete({ where: { id: bookingId } });
    });

    it('hard-delete SENT contract → 400', async () => {
      const bookingId = await createBooking();
      await forceCompleteChecklist(bookingId, ['send_quote', 'confirm_quote']);

      const contract = await createContract(bookingId);
      await sendContract(bookingId, contract.id);

      const res = await request(app.getHttpServer())
        .delete(`/api/bookings/${bookingId}/contracts/${contract.id}`);
      expect(res.status).toBe(400);

      await prisma.booking.delete({ where: { id: bookingId } });
    });
  });
});
