import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app.factory';
import { PrismaService } from '../src/prisma/prisma.service';
import { TEST_USER_ID } from './test-auth.guard';

const FUTURE_DATE = '2027-09-15T14:00:00.000Z';
const PORTAL_TOKEN = `test-portal-token-${Date.now()}`;

describe('Portal music form (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bookingId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const contact = await prisma.contact.create({
      data: { userId: TEST_USER_ID, name: 'Portal Test Customer' },
    });

    await prisma.publicProfile.upsert({
      where: { userId: TEST_USER_ID },
      create: { userId: TEST_USER_ID, businessName: 'Test Band' },
      update: {},
    });

    const booking = await prisma.booking.create({
      data: {
        userId: TEST_USER_ID,
        customerId: contact.id,
        eventType: 'WEDDING',
        date: new Date(FUTURE_DATE),
        portalToken: PORTAL_TOKEN,
        musicFormConfig: {
          create: {
            userId: TEST_USER_ID,
            enabledGenres: ['Pop', 'Jazz'],
            keyMoments: [{ label: 'First Dance', section: 'ceremony' }],
            // #533: the form must be published to be reachable via the portal token.
            publishedAt: new Date(),
          },
        },
      },
    });
    bookingId = booking.id;

    await prisma.song.createMany({
      data: [
        { userId: TEST_USER_ID, title: 'Song A', artist: 'Artist A', genre: 'Pop' },
        { userId: TEST_USER_ID, title: 'Song B', artist: 'Artist B', genre: 'Jazz' },
      ],
    });
  });

  afterAll(async () => {
    await prisma.musicFormResponse.deleteMany({ where: { bookingId } });
    await prisma.musicFormConfig.deleteMany({ where: { bookingId } });
    await prisma.booking.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.contact.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.song.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.publicProfile.deleteMany({ where: { userId: TEST_USER_ID } });
    await app.close();
  });

  it('returns music form data via portal token', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/booking/${PORTAL_TOKEN}/music`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('config');
    expect(res.body).toHaveProperty('songs');
  });

  it('submits music form successfully on first attempt', async () => {
    const songs = await prisma.song.findMany({ where: { userId: TEST_USER_ID } });
    const [songA] = songs;

    const res = await request(app.getHttpServer())
      .post(`/api/booking/${PORTAL_TOKEN}/music`)
      .send({
        selectedSongIds: [songA.id],
        specialRequests: [{ key: 'First Dance', freeText: 'special song' }],
        notes: 'Test notes',
      });

    expect(res.status).toBe(201);
  });

  it('submits music form successfully on immediate second attempt (idempotent upsert)', async () => {
    const songs = await prisma.song.findMany({ where: { userId: TEST_USER_ID } });
    const [songA] = songs;

    const res = await request(app.getHttpServer())
      .post(`/api/booking/${PORTAL_TOKEN}/music`)
      .send({
        selectedSongIds: [songA.id],
        specialRequests: [],
        notes: 'Updated notes',
      });

    expect(res.status).toBe(201);
  });

  it('rejects unknown song IDs', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/booking/${PORTAL_TOKEN}/music`)
      .send({
        selectedSongIds: ['00000000-0000-0000-0000-000000000000'],
        specialRequests: [],
        notes: '',
      });

    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown portal token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/booking/unknown-token-xyz/music')
      .send({ selectedSongIds: [], specialRequests: [], notes: '' });

    expect(res.status).toBe(404);
  });
});

// #533: a DRAFT (unpublished) form must be unreachable via the portal token — both the read and the
// submit are gated, so a token holder cannot fetch or submit it. Indistinguishable from "not found".
describe('Portal music form draft gate (#533, integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bookingId: string;
  const DRAFT_TOKEN = `test-portal-draft-token-${Date.now()}`;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const contact = await prisma.contact.create({
      data: { userId: TEST_USER_ID, name: 'Draft Form Customer' },
    });
    await prisma.publicProfile.upsert({
      where: { userId: TEST_USER_ID },
      create: { userId: TEST_USER_ID, businessName: 'Test Band' },
      update: {},
    });

    const booking = await prisma.booking.create({
      data: {
        userId: TEST_USER_ID,
        customerId: contact.id,
        eventType: 'WEDDING',
        date: new Date(FUTURE_DATE),
        portalToken: DRAFT_TOKEN,
        musicFormConfig: {
          create: {
            userId: TEST_USER_ID,
            enabledGenres: ['Pop'],
            keyMoments: [],
            // Draft: on, but not published.
            publishedAt: null,
          },
        },
      },
    });
    bookingId = booking.id;
  });

  afterAll(async () => {
    await prisma.musicFormConfig.deleteMany({ where: { bookingId } });
    await prisma.booking.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.contact.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.publicProfile.deleteMany({ where: { userId: TEST_USER_ID } });
    await app.close();
  });

  it('does not expose a draft form on the main portal payload (hasMusicForm false)', async () => {
    const res = await request(app.getHttpServer()).get(`/api/booking/${DRAFT_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.hasMusicForm).toBe(false);
  });

  it('returns 404 when reading a draft form via token', async () => {
    const res = await request(app.getHttpServer()).get(`/api/booking/${DRAFT_TOKEN}/music`);
    expect(res.status).toBe(404);
  });

  it('returns 404 when submitting to a draft form via token', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/booking/${DRAFT_TOKEN}/music`)
      .send({ selectedSongIds: [], specialRequests: [], notes: '' });
    expect(res.status).toBe(404);
  });
});

describe('Portal document visibility (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bookingId: string;
  const DOCS_TOKEN = `test-portal-docs-token-${Date.now()}`;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const contact = await prisma.contact.create({
      data: { userId: TEST_USER_ID, name: 'Docs Portal Customer' },
    });

    await prisma.publicProfile.upsert({
      where: { userId: TEST_USER_ID },
      create: { userId: TEST_USER_ID, businessName: 'Test Band' },
      update: {},
    });

    const booking = await prisma.booking.create({
      data: {
        userId: TEST_USER_ID,
        customerId: contact.id,
        eventType: 'WEDDING',
        date: new Date(FUTURE_DATE),
        portalToken: DOCS_TOKEN,
      },
    });
    bookingId = booking.id;

    // An invoice + its issue-time INVOICE document for each status we care about.
    const statuses = ['ISSUED', 'SENT', 'PAID', 'VOID'] as const;
    for (const status of statuses) {
      const invoice = await prisma.invoice.create({
        data: {
          userId: TEST_USER_ID,
          bookingId,
          billToContactId: contact.id,
          status,
          invoiceNumber: `INV-2027-${status}`,
        },
      });
      await prisma.document.create({
        data: {
          userId: TEST_USER_ID,
          bookingId,
          invoiceId: invoice.id,
          type: 'INVOICE',
          storageKey: `invoices/${invoice.id}.pdf`,
        },
      });
    }

    // A non-invoice document is always visible.
    await prisma.document.create({
      data: {
        userId: TEST_USER_ID,
        bookingId,
        type: 'SONG_LIST',
        storageKey: `song-lists/${bookingId}.pdf`,
      },
    });
  });

  afterAll(async () => {
    await prisma.document.deleteMany({ where: { bookingId } });
    await prisma.invoice.deleteMany({ where: { bookingId } });
    await prisma.booking.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.contact.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.publicProfile.deleteMany({ where: { userId: TEST_USER_ID } });
    await app.close();
  });

  it('exposes only SENT/PAID invoice documents plus non-invoice documents', async () => {
    const res = await request(app.getHttpServer()).get(`/api/booking/${DOCS_TOKEN}`);

    expect(res.status).toBe(200);
    const labels = (res.body.documents as Array<{ label: string; type: string }>).map((d) => d.label);

    // SENT and PAID invoices are delivered/settled — visible.
    expect(labels).toContain('Invoice INV-2027-SENT');
    expect(labels).toContain('Invoice INV-2027-PAID');
    // ISSUED-but-unsent and VOID invoices must never reach the client.
    expect(labels).not.toContain('Invoice INV-2027-ISSUED');
    expect(labels).not.toContain('Invoice INV-2027-VOID');
    // Non-invoice documents are unaffected.
    expect(labels).toContain('Song list');
  });
});
