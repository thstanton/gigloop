import { NotFoundException } from '@nestjs/common';
import { MailService, EmailContext } from './mail.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ id: 'email-id' }) },
  })),
}));

const mockPrisma = {
  booking: { findFirst: jest.fn() },
  publicProfile: { findUnique: jest.fn() },
  invoice: { findFirst: jest.fn() },
  communication: { create: jest.fn(), update: jest.fn() },
};

const booking = {
  id: 'b1',
  userId: 'u1',
  date: new Date('2025-08-15'),
  fee: { valueOf: () => 2500, toFixed: undefined } as unknown as number,
  portalToken: 'tok-abc',
  customer: { name: 'Jane Doe' },
  venue: { name: 'The Grand Hotel' },
  sets: [
    { order: 1, startTime: '14:00', label: 'Ceremony', duration: 30 },
    { order: 2, startTime: null, label: null, duration: 45 },
  ],
};

const publicProfile = {
  displayName: 'Tim Stanton',
  businessName: 'Tim Stanton Music',
  email: 'tim@example.com',
};

function makeService(): MailService {
  return new MailService(mockPrisma as unknown as PrismaService);
}

describe('MailService', () => {
  let service: MailService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = makeService();
  });

  describe('buildContext', () => {
    beforeEach(() => {
      mockPrisma.booking.findFirst.mockResolvedValue(booking);
      mockPrisma.publicProfile.findUnique.mockResolvedValue(publicProfile);
    });

    it('maps booking and profile fields to context correctly', async () => {
      const ctx = await service.buildContext('u1', 'b1');
      expect(ctx.customerName).toBe('Jane Doe');
      expect(ctx.bookingDate).toBe('2025-08-15');
      expect(ctx.venueName).toBe('The Grand Hotel');
      expect(ctx.musicianName).toBe('Tim Stanton');
      expect(ctx.musicianEmail).toBe('tim@example.com');
      expect(ctx.portalLink).toContain('tok-abc');
    });

    it('falls back to businessName when displayName is null', async () => {
      mockPrisma.publicProfile.findUnique.mockResolvedValue({ ...publicProfile, displayName: null });
      const ctx = await service.buildContext('u1', 'b1');
      expect(ctx.musicianName).toBe('Tim Stanton Music');
    });

    it('returns empty strings for missing venue and fee', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({ ...booking, venue: null, fee: null });
      const ctx = await service.buildContext('u1', 'b1');
      expect(ctx.venueName).toBe('');
      expect(ctx.bookingFee).toBe('');
    });

    it('renders sets schedule as an HTML list', async () => {
      const ctx = await service.buildContext('u1', 'b1');
      expect(ctx.setsSchedule).toContain('<ul>');
      expect(ctx.setsSchedule).toContain('Ceremony');
      expect(ctx.setsSchedule).toContain('30 min');
    });

    it('returns empty setsSchedule when booking has no sets', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({ ...booking, sets: [] });
      const ctx = await service.buildContext('u1', 'b1');
      expect(ctx.setsSchedule).toBe('');
    });

    it('sums invoice line items for invoiceTotal and captures dates', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue({
        issueDate: new Date('2025-08-01'),
        dueDate: new Date('2025-09-01'),
        lineItems: [{ amount: '500.00' }, { amount: '1500.00' }],
      });
      const ctx = await service.buildContext('u1', 'b1', 'inv1');
      expect(ctx.issueDate).toBe('2025-08-01');
      expect(ctx.invoiceTotal).toBe('2000.00');
      expect(ctx.invoiceDueDate).toBe('2025-09-01');
    });

    it('throws NotFoundException when booking is not found', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      await expect(service.buildContext('u1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when public profile does not exist', async () => {
      mockPrisma.publicProfile.findUnique.mockResolvedValue(null);
      await expect(service.buildContext('u1', 'b1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('renderTemplate', () => {
    const context: EmailContext = {
      customerName: 'Jane Doe',
      bookingDate: '2025-08-15',
      venueName: 'The Grand Hotel',
      bookingFee: '2500.00',
      setsSchedule: '<ul><li>Ceremony</li></ul>',
      musicianName: 'Tim Stanton',
      musicianEmail: 'tim@example.com',
      portalLink: 'https://app.gigman.com/booking/tok-abc',
      issueDate: '',
      invoiceTotal: '',
      invoiceDueDate: '',
    };

    it('substitutes known variables in rendered HTML', () => {
      const content = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Dear {{customerName}},' }] }],
      };
      const { html } = service.renderTemplate(content, context);
      expect(html).toBe('<p>Dear Jane Doe,</p>');
    });

    it('replaces unknown variables with an empty string', () => {
      const content = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '{{unknownVar}}' }] }],
      };
      const { html } = service.renderTemplate(content, context);
      expect(html).toBe('<p></p>');
    });

    it('returns missingVariables when a variable with a fallback is empty', () => {
      const contextWithMissingDate: EmailContext = { ...context, bookingDate: '' };
      const content = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Event on {{bookingDate}}' }] }],
      };
      const { html, missingVariables } = service.renderTemplate(content, contextWithMissingDate);
      expect(html).toBe('<p>Event on your event</p>');
      expect(missingVariables).toContain('bookingDate');
    });

    it('reports missingVariables for empty variables even without a defined fallback', () => {
      const contextWithNoFee: EmailContext = { ...context, bookingFee: '' };
      const content = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fee: {{bookingFee}}' }] }],
      };
      const { missingVariables } = service.renderTemplate(content, contextWithNoFee);
      expect(missingVariables).toContain('bookingFee');
    });
  });

  describe('send', () => {
    const sendOptions = {
      userId: 'u1', bookingId: 'b1', contactId: 'ct1',
      to: 'jane@example.com', subject: 'Your invoice',
      body: '<p>Dear Jane,</p>', templateId: 'tmpl1',
    };

    it('creates a PENDING communication, sends via Resend, then updates to SENT', async () => {
      mockPrisma.communication.create.mockResolvedValue({ id: 'comm1' });
      mockPrisma.communication.update.mockResolvedValue({});
      await service.send(sendOptions);

      expect(mockPrisma.communication.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PENDING', body: '<p>Dear Jane,</p>' }),
        }),
      );

      const resendInstance = (service as unknown as { resend: { emails: { send: jest.Mock } } }).resend;
      expect(resendInstance.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'jane@example.com', subject: 'Your invoice', html: '<p>Dear Jane,</p>' }),
      );

      expect(mockPrisma.communication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'comm1' },
          data: expect.objectContaining({ status: 'SENT' }),
        }),
      );
    });

    it('updates communication to FAILED and rethrows when Resend throws', async () => {
      mockPrisma.communication.create.mockResolvedValue({ id: 'comm1' });
      mockPrisma.communication.update.mockResolvedValue({});
      const resendInstance = (service as unknown as { resend: { emails: { send: jest.Mock } } }).resend;
      resendInstance.emails.send.mockRejectedValueOnce(new Error('Resend error'));

      await expect(service.send(sendOptions)).rejects.toThrow('Resend error');

      expect(mockPrisma.communication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'comm1' },
          data: { status: 'FAILED' },
        }),
      );
    });
  });
});
