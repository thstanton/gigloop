import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app.factory';
import { prisma } from './test-prisma';
import { TEST_USER_ID } from './test-auth.guard';

const FUTURE_DATE = '2027-09-15T14:00:00.000Z';
const PORTAL_TOKEN = `test-portal-token-${Date.now()}`;

describe('Portal music form (integration)', () => {
  let app: INestApplication;
  let bookingId: string;

  beforeAll(async () => {
    app = await createTestApp();

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
