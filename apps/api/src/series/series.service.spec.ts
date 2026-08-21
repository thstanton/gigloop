import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SeriesService } from './series.service';
import { SeriesRepository } from './series.repository';
import { InvoicesRepository } from '../invoices/invoices.repository';

type MockRepo = {
  findAll: jest.Mock;
  findOne: jest.Mock;
  findOneMinimal: jest.Mock;
  create: jest.Mock;
  findMemberBookingsForInvoice: jest.Mock;
  findDraftSeriesInvoiceWithLines: jest.Mock;
  appendSeriesInvoiceLine: jest.Mock;
  reorderSeriesInvoiceLines: jest.Mock;
  removeSeriesInvoiceLine: jest.Mock;
};

// Invoice lifecycle CRUD lives in InvoicesRepository for both owners (ADR-0063), so series
// invoice reads/writes are mocked here rather than on the SeriesRepository mock. The lifecycle
// transitions themselves (issue/void/delete/send/mark-sent/mark-paid/payment-correction) moved
// to InvoicesService (#853), so `delete` here now covers only what's left: creation-adjacent CRUD.
type MockInvoicesRepo = {
  delete: jest.Mock;
  previewSeriesInvoiceNumber: jest.Mock;
  findActiveSeriesInvoice: jest.Mock;
  createSeriesInvoice: jest.Mock;
  countNonVoidSeriesInvoices: jest.Mock;
  findNonDraftNonVoidSeriesInvoice: jest.Mock;
};

function makeRepo(): MockRepo {
  return {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findOneMinimal: jest.fn(),
    create: jest.fn(),
    findMemberBookingsForInvoice: jest.fn(),
    findDraftSeriesInvoiceWithLines: jest.fn().mockResolvedValue(null),
    appendSeriesInvoiceLine: jest.fn(),
    reorderSeriesInvoiceLines: jest.fn(),
    removeSeriesInvoiceLine: jest.fn(),
  };
}

function makeInvoicesRepo(): MockInvoicesRepo {
  return {
    delete: jest.fn(),
    previewSeriesInvoiceNumber: jest.fn(),
    findActiveSeriesInvoice: jest.fn(),
    createSeriesInvoice: jest.fn(),
    countNonVoidSeriesInvoices: jest.fn(),
    findNonDraftNonVoidSeriesInvoice: jest.fn().mockResolvedValue(null),
  };
}

const seriesWithMeta = {
  id: 's1', createdAt: new Date(), updatedAt: new Date(),
  label: 'Hotel X — May 2026', customerId: 'c1',
  customer: { id: 'c1', name: 'Hotel X', email: null },
  bookings: [{ id: 'b1' }, { id: 'b2' }],
  invoices: [{ id: 'inv1', status: 'SENT' }],
};

const series = {
  id: 's1', customerId: 'c1',
  customer: { id: 'c1', name: 'Hotel X', email: null },
};

describe('SeriesService', () => {
  let service: SeriesService;
  let repo: MockRepo;
  let invoicesRepo: MockInvoicesRepo;

  beforeEach(() => {
    repo = makeRepo();
    invoicesRepo = makeInvoicesRepo();
    service = new SeriesService(
      repo as unknown as SeriesRepository,
      invoicesRepo as unknown as InvoicesRepository,
    );
  });

  describe('findAll', () => {
    it('delegates to repository', async () => {
      repo.findAll.mockResolvedValue([{ id: 's1', label: 'Test' }]);
      const result = await service.findAll('u1');
      expect(repo.findAll).toHaveBeenCalledWith('u1');
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('returns series with derived fields', async () => {
      repo.findOne.mockResolvedValue(seriesWithMeta);
      const result = await service.findOne('u1', 's1');
      expect(result.memberBookingCount).toBe(2);
      expect(result.invoiceStatus).toBe('SENT');
    });

    it('returns null invoiceStatus when all invoices are VOID', async () => {
      repo.findOne.mockResolvedValue({
        ...seriesWithMeta,
        invoices: [{ id: 'inv1', status: 'VOID' }],
      });
      const result = await service.findOne('u1', 's1');
      expect(result.invoiceStatus).toBeNull();
    });

    it('returns null invoiceStatus when series has no invoices', async () => {
      repo.findOne.mockResolvedValue({ ...seriesWithMeta, invoices: [] });
      const result = await service.findOne('u1', 's1');
      expect(result.invoiceStatus).toBeNull();
    });

    it('throws NotFoundException when series not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('u1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createInvoice', () => {
    const booking = { id: 'b1', date: new Date('2026-05-01'), fee: 500, sets: [] };

    it('creates invoice with line items (including sourceBookingId) for each member booking', async () => {
      repo.findOneMinimal.mockResolvedValue(series);
      invoicesRepo.countNonVoidSeriesInvoices.mockResolvedValue(0);
      repo.findMemberBookingsForInvoice.mockResolvedValue([booking]);
      invoicesRepo.createSeriesInvoice.mockResolvedValue({ id: 'inv1' });

      await service.createInvoice('u1', 's1');
      expect(invoicesRepo.createSeriesInvoice).toHaveBeenCalledWith('u1', 's1', 'c1', expect.arrayContaining([
        expect.objectContaining({ amount: 500, order: 0, sourceBookingId: 'b1' }),
      ]));
    });

    it('returns the created invoice alongside a feeless-member count', async () => {
      repo.findOneMinimal.mockResolvedValue(series);
      invoicesRepo.countNonVoidSeriesInvoices.mockResolvedValue(0);
      repo.findMemberBookingsForInvoice.mockResolvedValue([booking]);
      invoicesRepo.createSeriesInvoice.mockResolvedValue({ id: 'inv1' });

      const result = await service.createInvoice('u1', 's1');
      expect(result).toEqual({ invoice: { id: 'inv1' }, feelessMemberCount: 0 });
    });

    // #850: a fee-less member still bills a £0.00 line (the date must appear on the invoice) —
    // the count surfaces to the musician so it never reaches a client unnoticed.
    it('counts fee-less members and still bills them a £0.00 line', async () => {
      const feeless = { id: 'b2', date: new Date('2026-05-08'), fee: null, sets: [] };
      repo.findOneMinimal.mockResolvedValue(series);
      invoicesRepo.countNonVoidSeriesInvoices.mockResolvedValue(0);
      repo.findMemberBookingsForInvoice.mockResolvedValue([booking, feeless]);
      invoicesRepo.createSeriesInvoice.mockResolvedValue({ id: 'inv1' });

      const result = await service.createInvoice('u1', 's1');
      expect(result.feelessMemberCount).toBe(1);
      expect(invoicesRepo.createSeriesInvoice).toHaveBeenCalledWith('u1', 's1', 'c1', expect.arrayContaining([
        expect.objectContaining({ amount: 0, sourceBookingId: 'b2' }),
      ]));
    });

    it('throws ConflictException when non-VOID invoice exists', async () => {
      repo.findOneMinimal.mockResolvedValue(series);
      invoicesRepo.countNonVoidSeriesInvoices.mockResolvedValue(1);
      await expect(service.createInvoice('u1', 's1')).rejects.toThrow(ConflictException);
      expect(invoicesRepo.createSeriesInvoice).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when series has no member bookings', async () => {
      repo.findOneMinimal.mockResolvedValue(series);
      invoicesRepo.countNonVoidSeriesInvoices.mockResolvedValue(0);
      repo.findMemberBookingsForInvoice.mockResolvedValue([]);
      await expect(service.createInvoice('u1', 's1')).rejects.toThrow(BadRequestException);
    });

    // #852: the count check above is a TOCTOU-racy guard — a concurrent request can pass it too.
    // `Invoice_seriesId_active_key` is the real backstop; a violation must still read as a plain
    // 409 to the musician, not a raw database error. `meta.target: ['seriesId']` is the shape
    // Prisma actually normalizes this raw (schema-DSL-invisible) constraint's error to — verified
    // empirically against a local Postgres, not assumed.
    it('maps a P2002 unique-constraint violation on create to the same friendly 409', async () => {
      repo.findOneMinimal.mockResolvedValue(series);
      invoicesRepo.countNonVoidSeriesInvoices.mockResolvedValue(0);
      repo.findMemberBookingsForInvoice.mockResolvedValue([booking]);
      invoicesRepo.createSeriesInvoice.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.19.3',
          meta: { modelName: 'Invoice', target: ['seriesId'] },
        }),
      );

      await expect(service.createInvoice('u1', 's1')).rejects.toThrow(ConflictException);
      await expect(service.createInvoice('u1', 's1')).rejects.toThrow(
        'A non-VOID invoice already exists for this series',
      );
    });

    it('rethrows a P2002 on an unrelated constraint unchanged', async () => {
      repo.findOneMinimal.mockResolvedValue(series);
      invoicesRepo.countNonVoidSeriesInvoices.mockResolvedValue(0);
      repo.findMemberBookingsForInvoice.mockResolvedValue([booking]);
      const otherViolation = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
        meta: { modelName: 'Invoice', target: ['id'] },
      });
      invoicesRepo.createSeriesInvoice.mockRejectedValue(otherViolation);

      await expect(service.createInvoice('u1', 's1')).rejects.toThrow(otherViolation);
    });

    it('rethrows a non-P2002 error from create unchanged', async () => {
      repo.findOneMinimal.mockResolvedValue(series);
      invoicesRepo.countNonVoidSeriesInvoices.mockResolvedValue(0);
      repo.findMemberBookingsForInvoice.mockResolvedValue([booking]);
      const dbError = new Error('connection reset');
      invoicesRepo.createSeriesInvoice.mockRejectedValue(dbError);

      await expect(service.createInvoice('u1', 's1')).rejects.toThrow(dbError);
    });
  });

  // ─── membership guard + sync ───────────────────────────────────────────────

  describe('assertMembershipMutable', () => {
    it('resolves when no non-draft/non-void invoice exists', async () => {
      invoicesRepo.findNonDraftNonVoidSeriesInvoice.mockResolvedValue(null);
      await expect(service.assertMembershipMutable('u1', 's1')).resolves.toBeUndefined();
    });

    it('throws ConflictException when an ISSUED invoice exists', async () => {
      invoicesRepo.findNonDraftNonVoidSeriesInvoice.mockResolvedValue({ id: 'inv1', status: 'ISSUED' });
      await expect(service.assertMembershipMutable('u1', 's1')).rejects.toThrow(ConflictException);
    });
  });

  describe('syncMemberJoin', () => {
    const booking = { id: 'b1', date: new Date('2026-05-01'), fee: 500, sets: [] };

    it('is a no-op when no draft invoice exists', async () => {
      repo.findDraftSeriesInvoiceWithLines.mockResolvedValue(null);
      await service.syncMemberJoin('u1', 's1', booking);
      expect(repo.appendSeriesInvoiceLine).not.toHaveBeenCalled();
    });

    it('appends a traced line when a draft invoice exists and booking has no line', async () => {
      repo.findDraftSeriesInvoiceWithLines.mockResolvedValue({
        id: 'inv1',
        lineItems: [],
      });
      await service.syncMemberJoin('u1', 's1', booking);
      expect(repo.appendSeriesInvoiceLine).toHaveBeenCalledWith(
        'u1', 'inv1',
        expect.objectContaining({ sourceBookingId: 'b1', amount: 500 }),
        undefined, // no tx threaded when called outside the atomic-create path
      );
    });

    it('is a no-op when the booking already has a traced line', async () => {
      repo.findDraftSeriesInvoiceWithLines.mockResolvedValue({
        id: 'inv1',
        lineItems: [{ id: 'li1', sourceBookingId: 'b1', order: 0 }],
      });
      await service.syncMemberJoin('u1', 's1', booking);
      expect(repo.appendSeriesInvoiceLine).not.toHaveBeenCalled();
    });

    // #851: a back-dated booking joining a series mid-way must land at its date position among
    // the auto-generated lines, not at the bottom.
    it('inserts a retro-joined booking at its date position, bumping later auto lines up', async () => {
      const retroBooking = { id: 'b2', date: new Date('2026-05-15'), fee: 500, sets: [] };
      repo.findDraftSeriesInvoiceWithLines.mockResolvedValue({
        id: 'inv1',
        lineItems: [
          { id: 'li1', sourceBookingId: 'b1', order: 0, sourceBooking: { date: new Date('2026-05-01') } },
          { id: 'li3', sourceBookingId: 'b3', order: 1, sourceBooking: { date: new Date('2026-06-01') } },
        ],
      });
      await service.syncMemberJoin('u1', 's1', retroBooking);
      expect(repo.reorderSeriesInvoiceLines).toHaveBeenCalledWith([{ id: 'li3', order: 2 }], undefined);
      expect(repo.appendSeriesInvoiceLine).toHaveBeenCalledWith(
        'u1', 'inv1',
        expect.objectContaining({ sourceBookingId: 'b2', order: 1 }),
        undefined,
      );
    });

    it('keeps a custom line after every auto-generated line when a member joins', async () => {
      const joiningBooking = { id: 'b2', date: new Date('2026-06-01'), fee: 500, sets: [] };
      repo.findDraftSeriesInvoiceWithLines.mockResolvedValue({
        id: 'inv1',
        lineItems: [
          { id: 'li1', sourceBookingId: 'b1', order: 0, sourceBooking: { date: new Date('2026-05-01') } },
          { id: 'li-custom', sourceBookingId: null, order: 1 },
        ],
      });
      await service.syncMemberJoin('u1', 's1', joiningBooking);
      expect(repo.appendSeriesInvoiceLine).toHaveBeenCalledWith(
        'u1', 'inv1',
        expect.objectContaining({ sourceBookingId: 'b2', order: 1 }),
        undefined,
      );
      // li-custom shifts from 1 to 2 to stay after the new line; li1 is untouched.
      expect(repo.reorderSeriesInvoiceLines).toHaveBeenCalledWith([{ id: 'li-custom', order: 2 }], undefined);
    });

    it('does not reorder anything when the new line simply appends at the end', async () => {
      repo.findDraftSeriesInvoiceWithLines.mockResolvedValue({
        id: 'inv1',
        lineItems: [{ id: 'li1', sourceBookingId: 'b0', order: 0, sourceBooking: { date: new Date('2026-01-01') } }],
      });
      await service.syncMemberJoin('u1', 's1', booking); // booking date 2026-05-01, after li1
      expect(repo.reorderSeriesInvoiceLines).not.toHaveBeenCalled();
      expect(repo.appendSeriesInvoiceLine).toHaveBeenCalledWith(
        'u1', 'inv1',
        expect.objectContaining({ sourceBookingId: 'b1', order: 1 }),
        undefined,
      );
    });
  });

  // ADR-0043's guarantee, finally exercised (#845). Its whole rationale is that reconciliation
  // preserves manual edits and custom lines — but until the owner-agnostic write routes existed
  // no route could produce either, so the reconciler's `sourceBookingId !== null` guard had been
  // protecting an empty set. These assert the guarantee against line states that are now reachable.
  describe('reconciliation preserves hand-made changes (ADR-0043)', () => {
    const booking = { id: 'b1', date: new Date('2026-05-01'), fee: 500, sets: [] };

    it('leaves a manually edited amount on a traced line untouched', async () => {
      // The line traces to b1 but its amount was edited by hand to 750, against a 500 fee.
      // Reconciliation must not rewrite it back.
      repo.findDraftSeriesInvoiceWithLines.mockResolvedValue({
        id: 'inv1',
        lineItems: [{ id: 'li1', sourceBookingId: 'b1', order: 0, amount: 750 }],
      });
      await service.syncMemberJoin('u1', 's1', booking);
      expect(repo.appendSeriesInvoiceLine).not.toHaveBeenCalled();
      expect(repo.removeSeriesInvoiceLine).not.toHaveBeenCalled();
    });

    it('leaves a hand-added custom line untouched when a new member joins', async () => {
      repo.findDraftSeriesInvoiceWithLines.mockResolvedValue({
        id: 'inv1',
        lineItems: [{ id: 'li-custom', sourceBookingId: null, order: 0, amount: 200 }],
      });
      await service.syncMemberJoin('u1', 's1', booking);
      expect(repo.removeSeriesInvoiceLine).not.toHaveBeenCalled();
      // The joining member still gets its own traced line — a custom line neither blocks the
      // append nor is mistaken for one.
      expect(repo.appendSeriesInvoiceLine).toHaveBeenCalledWith(
        'u1', 'inv1',
        expect.objectContaining({ sourceBookingId: 'b1' }),
        undefined,
      );
    });

    it('keeps custom lines and edited traced lines across a departure', async () => {
      repo.findDraftSeriesInvoiceWithLines.mockResolvedValue({
        id: 'inv1',
        lineItems: [
          { id: 'li1', sourceBookingId: 'b1', order: 0, amount: 500 },
          { id: 'li2', sourceBookingId: 'b2', order: 1, amount: 900 },
          { id: 'li-custom', sourceBookingId: null, order: 2, amount: 200 },
        ],
      });
      await service.syncMemberLeave('u1', 's1', 'b1');
      expect(repo.removeSeriesInvoiceLine).toHaveBeenCalledTimes(1);
      expect(repo.removeSeriesInvoiceLine).toHaveBeenCalledWith('li1');
    });
  });

  describe('syncMemberLeave', () => {
    it('is a no-op when no draft invoice exists', async () => {
      repo.findDraftSeriesInvoiceWithLines.mockResolvedValue(null);
      await service.syncMemberLeave('u1', 's1', 'b1');
      expect(repo.removeSeriesInvoiceLine).not.toHaveBeenCalled();
    });

    it('removes the traced line for the departing booking', async () => {
      repo.findDraftSeriesInvoiceWithLines.mockResolvedValue({
        id: 'inv1',
        lineItems: [
          { id: 'li1', sourceBookingId: 'b1', order: 0 },
          { id: 'li2', sourceBookingId: null, order: 1 },
        ],
      });
      await service.syncMemberLeave('u1', 's1', 'b1');
      expect(repo.removeSeriesInvoiceLine).toHaveBeenCalledWith('li1');
      expect(repo.removeSeriesInvoiceLine).not.toHaveBeenCalledWith('li2');
    });

    it('is a no-op when the booking has no traced line', async () => {
      repo.findDraftSeriesInvoiceWithLines.mockResolvedValue({
        id: 'inv1',
        lineItems: [{ id: 'li1', sourceBookingId: 'b2', order: 0 }],
      });
      await service.syncMemberLeave('u1', 's1', 'b1');
      expect(repo.removeSeriesInvoiceLine).not.toHaveBeenCalled();
    });

    it('never removes custom lines (null sourceBookingId)', async () => {
      repo.findDraftSeriesInvoiceWithLines.mockResolvedValue({
        id: 'inv1',
        lineItems: [{ id: 'li-custom', sourceBookingId: null, order: 0 }],
      });
      await service.syncMemberLeave('u1', 's1', 'b1');
      expect(repo.removeSeriesInvoiceLine).not.toHaveBeenCalled();
    });
  });
});
