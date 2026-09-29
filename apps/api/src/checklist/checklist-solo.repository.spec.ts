import { ChecklistRepository } from './checklist.repository';
import { PrismaService } from '../prisma/prisma.service';
import { BAND_BRIEFED_GOAL_KEY, BAND_CHECKLIST_GOAL_KEY } from './checklist-defaults';
import { planBandSoloExit } from './checklist-solo.service';

describe('ChecklistRepository — play solo (#902)', () => {
  const makeTransaction = () => ({
    booking: { findFirst: jest.fn() },
    bookingChecklistItem: { findMany: jest.fn(), updateMany: jest.fn() },
    userProfile: { findUnique: jest.fn(), upsert: jest.fn() },
  });

  function setupRepository(tx: ReturnType<typeof makeTransaction>) {
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    return {
      prisma,
      repository: new ChecklistRepository(prisma as unknown as PrismaService),
    };
  }

  it('atomically skips both existing band goals and disables both future defaults', async () => {
    const tx = makeTransaction();
    tx.booking.findFirst.mockResolvedValue({ id: 'b1' });
    tx.bookingChecklistItem.findMany.mockResolvedValue([
      { id: 'g-band', key: BAND_CHECKLIST_GOAL_KEY, state: 'PENDING' },
      { id: 'g-brief', key: BAND_BRIEFED_GOAL_KEY, state: 'PENDING' },
    ]);
    tx.userProfile.findUnique.mockResolvedValue({
      preferences: {
        theme: 'dark',
        checklistDefaults: {
          systemItemOverrides: [{ key: 'get_the_quote_accepted', enabled: false }],
          customItems: [],
        },
      },
    });
    const { prisma, repository } = setupRepository(tx);

    await expect(repository.applyBandSoloExit('u1', 'b1', planBandSoloExit)).resolves.toBe(true);

    expect(tx.booking.findFirst).toHaveBeenCalledWith({
      where: { id: 'b1', userId: 'u1' },
      select: { id: true },
    });
    expect(tx.bookingChecklistItem.findMany).toHaveBeenCalledWith({
      where: { bookingId: 'b1', userId: 'u1', key: { in: [BAND_CHECKLIST_GOAL_KEY, BAND_BRIEFED_GOAL_KEY] } },
      select: { id: true, key: true, state: true },
    });
    expect(tx.bookingChecklistItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['g-band', 'g-brief'] }, bookingId: 'b1', userId: 'u1', state: { in: ['PENDING', 'FAILED'] } },
      data: { state: 'SKIPPED', completedAt: null },
    });

    const upsert = tx.userProfile.upsert.mock.calls[0][0];
    expect(upsert.where).toEqual({ userId: 'u1' });
    expect(upsert.update.preferences).toMatchObject({
      theme: 'dark',
      checklistDefaults: {
        systemItemOverrides: expect.arrayContaining([
          { key: 'get_the_quote_accepted', enabled: false },
          { key: BAND_CHECKLIST_GOAL_KEY, enabled: false },
          { key: BAND_BRIEFED_GOAL_KEY, enabled: false },
        ]),
        customItems: [],
      },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('does not write anything for a booking outside the caller’s tenant', async () => {
    const tx = makeTransaction();
    tx.booking.findFirst.mockResolvedValue(null);
    const { repository } = setupRepository(tx);

    await expect(repository.applyBandSoloExit('u1', 'other-booking', planBandSoloExit)).resolves.toBe(false);

    expect(tx.bookingChecklistItem.findMany).not.toHaveBeenCalled();
    expect(tx.userProfile.upsert).not.toHaveBeenCalled();
  });

  it('supports bookings that only contain the later-stage band goal', async () => {
    const tx = makeTransaction();
    tx.booking.findFirst.mockResolvedValue({ id: 'b1' });
    tx.bookingChecklistItem.findMany.mockResolvedValue([
      { id: 'g-brief', key: BAND_BRIEFED_GOAL_KEY, state: 'PENDING' },
    ]);
    tx.userProfile.findUnique.mockResolvedValue({ preferences: null });
    const { repository } = setupRepository(tx);

    await expect(repository.applyBandSoloExit('u1', 'b1', planBandSoloExit)).resolves.toBe(true);

    expect(tx.bookingChecklistItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['g-brief'] }, bookingId: 'b1', userId: 'u1', state: { in: ['PENDING', 'FAILED'] } },
      data: { state: 'SKIPPED', completedAt: null },
    });
  });

  it('is safe to repeat after the current booking goals are already skipped', async () => {
    const tx = makeTransaction();
    tx.booking.findFirst.mockResolvedValue({ id: 'b1' });
    tx.bookingChecklistItem.findMany.mockResolvedValue([
      { id: 'g-band', key: BAND_CHECKLIST_GOAL_KEY, state: 'SKIPPED' },
      { id: 'g-brief', key: BAND_BRIEFED_GOAL_KEY, state: 'SKIPPED' },
    ]);
    tx.userProfile.findUnique.mockResolvedValue({ preferences: null });
    const { repository } = setupRepository(tx);

    await expect(repository.applyBandSoloExit('u1', 'b1', planBandSoloExit)).resolves.toBe(true);

    expect(tx.bookingChecklistItem.updateMany).not.toHaveBeenCalled();
    expect(tx.userProfile.upsert).toHaveBeenCalledTimes(1);
  });
});
