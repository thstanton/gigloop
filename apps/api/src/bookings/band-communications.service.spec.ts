import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { EmailContext, MailService } from '../mail/mail.service';
import type { CommunicationsService } from '../communications/communications.service';
import type { ChecklistReevaluator } from '../checklist/checklist-reevaluator.service';
import type { DocumentsService } from '../documents/documents.service';
import type { BookingsRepository } from './bookings.repository';
import { BandCommunicationContentService } from './band-communication-content.service';
import { BandCommunicationsService } from './band-communications.service';

const memberInviteData = {
  id: 'member-1',
  contactId: 'contact-1',
  bandPortalToken: 'member-token',
  contact: { name: 'Dave Jones', email: 'dave@example.com' },
  chairs: [{ lineup: { packages: [{ packageId: 'drinks' }, { packageId: 'reception' }] } }],
  booking: {
    id: 'booking-1',
    date: new Date('2026-09-15T00:00:00.000Z'),
    title: 'Autumn wedding',
    venue: {
      name: 'The Hall',
      addressLine1: '1 High Street',
      addressLine2: null,
      city: 'Bath',
      county: null,
      postcode: 'BA1 1AA',
    },
    packages: [{ id: 'drinks', order: 1 }, { id: 'reception', order: 2 }],
    sets: [
      { packageId: 'drinks', startTime: '18:00', duration: 45, order: 1 },
      { packageId: 'reception', startTime: '20:00', duration: 60, order: 2 },
    ],
  },
};

const emailContext: EmailContext = {
  customerName: 'Sophie Hartley',
  greetingName: 'Sophie',
  bookingDate: '2026-09-15',
  venueName: 'The Hall',
  bookingFee: '£1,500.00',
  setsSchedule: '18:00 — Drinks (45 min)',
  musicianName: 'Alex Musician',
  musicianEmail: 'alex@example.com',
  portalLink: 'https://app.gigloop.com/booking/client-token',
  issueDate: '',
  invoiceTotal: '',
  invoiceDueDate: '',
};

describe('BandCommunicationsService', () => {
  let service: BandCommunicationsService;
  let repo: { findBandInviteData: jest.Mock; markMemberInvited: jest.Mock };
  let mail: { buildContext: jest.Mock; renderForCompose: jest.Mock; renderPlainText: jest.Mock };
  let comms: { findTemplate: jest.Mock; sendEmail: jest.Mock };
  let reeval: { onBookingChanged: jest.Mock; onBandRosterChanged: jest.Mock };
  let documents: { generateAndStoreCallSheetPdf: jest.Mock; discardUnsentCallSheet: jest.Mock };

  beforeEach(() => {
    process.env.APP_BASE_URL = 'https://app.gigloop.com';
    repo = {
      findBandInviteData: jest.fn().mockResolvedValue(memberInviteData),
      markMemberInvited: jest.fn().mockResolvedValue({ count: 1 }),
    };
    mail = {
      buildContext: jest.fn().mockResolvedValue(emailContext),
      renderForCompose: jest.fn().mockReturnValue({ subject: 'Invite Dave', body: '<p>Hello Dave</p>', missingVariables: [] }),
      renderPlainText: jest.fn().mockReturnValue({ text: 'Invitation: https://app.gigloop.com/band/member-token', missingVariables: [] }),
    };
    comms = {
      findTemplate: jest.fn().mockResolvedValue({ id: 'template-1', builtInType: 'band_invite', content: {} }),
      sendEmail: jest.fn().mockResolvedValue(undefined),
    };
    reeval = {
      onBookingChanged: jest.fn().mockResolvedValue(undefined),
      onBandRosterChanged: jest.fn().mockResolvedValue(undefined),
    };
    documents = {
      generateAndStoreCallSheetPdf: jest.fn().mockResolvedValue({ buffer: Buffer.from('%PDF-call-sheet'), documentId: 'document-1' }),
      discardUnsentCallSheet: jest.fn().mockResolvedValue(undefined),
    };
    const content = new BandCommunicationContentService(
      repo as unknown as BookingsRepository,
      mail as unknown as MailService,
      comms as unknown as CommunicationsService,
    );
    service = new BandCommunicationsService(
      repo as unknown as BookingsRepository,
      content,
      comms as unknown as CommunicationsService,
      reeval as unknown as ChecklistReevaluator,
      documents as unknown as DocumentsService,
    );
  });

  afterEach(() => {
    delete process.env.APP_BASE_URL;
  });

  it('renders from the requested band-invite template using the member-overlaid booking context', async () => {
    await expect(service.renderInvite('user-1', 'booking-1', 'member-1', 'template-1')).resolves.toEqual({
      subject: 'Invite Dave',
      body: '<p>Hello Dave</p>',
      missingVariables: [],
    });

    expect(mail.buildContext).toHaveBeenCalledWith('user-1', 'booking-1');
    expect(mail.renderForCompose).toHaveBeenCalledWith(
      expect.objectContaining({ builtInType: 'band_invite' }),
      expect.objectContaining({
        ...emailContext,
        bandMemberName: 'Dave Jones',
        portalLink: 'https://app.gigloop.com/band/member-token',
      }),
    );
  });

  it('renders the copy message through the plain-text adapter and the same per-member context as email', async () => {
    const content = { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
    comms.findTemplate.mockResolvedValue({ id: 'message-template', builtInType: 'band_invite_message', content });
    mail.renderPlainText.mockReturnValue({
      text: 'Invitation: https://app.gigloop.com/band/member-token',
      missingVariables: [],
    });

    await expect(service.renderInviteMessage('user-1', 'booking-1', 'member-1', 'message-template')).resolves.toEqual({
      body: 'Invitation: https://app.gigloop.com/band/member-token',
      missingVariables: [],
    });

    expect(mail.buildContext).toHaveBeenCalledWith('user-1', 'booking-1');
    expect(mail.renderPlainText).toHaveBeenCalledWith(content, expect.objectContaining({
      ...emailContext,
      bandMemberName: 'Dave Jones',
      portalLink: 'https://app.gigloop.com/band/member-token',
    }));
  });

  it('does not render an email template through the copy-message endpoint', async () => {
    comms.findTemplate.mockResolvedValue({ id: 'template-1', builtInType: 'band_invite', content: {} });

    await expect(service.renderInviteMessage('user-1', 'booking-1', 'member-1', 'template-1')).rejects.toThrow(NotFoundException);

    expect(mail.renderPlainText).not.toHaveBeenCalled();
  });

  it('uses the shared per-member context to send an email and calendar attachment before inviting the member', async () => {
    const events: string[] = [];
    comms.sendEmail.mockImplementation(async (options) => {
      events.push('send');
      expect(options).toEqual(expect.objectContaining({
        userId: 'user-1',
        bookingId: 'booking-1',
        contactId: 'contact-1',
        to: 'dave@example.com',
        subject: 'Edited invitation',
        body: '<p>Edited by the organiser</p>',
        templateId: 'template-1',
        attachments: [expect.objectContaining({ filename: 'band-invite.ics', contentType: 'text/calendar' })],
      }));
      const attachment = options.attachments[0];
      expect(attachment.content.toString('utf8')).toContain('DTSTART:20260915T180000');
      expect(attachment.content.toString('utf8')).toContain('UID:booking-1.contact-1@app.gigloop.com');
    });
    repo.markMemberInvited.mockImplementation(async () => {
      events.push('status');
      return { count: 1 };
    });
    reeval.onBandRosterChanged.mockImplementation(async () => {
      events.push('reeval');
    });

    await service.sendInvite('user-1', 'booking-1', 'member-1', {
      templateId: 'template-1',
      subject: 'Edited invitation',
      body: '<p>Edited by the organiser</p>',
    });

    expect(events).toEqual(['send', 'status', 'reeval']);
    expect(repo.markMemberInvited).toHaveBeenCalledWith('user-1', 'booking-1', 'member-1', expect.any(Date));
    expect(reeval.onBandRosterChanged).toHaveBeenCalledWith('user-1', 'booking-1', 'member-1');
    expect(reeval.onBookingChanged).not.toHaveBeenCalled();
  });

  it('does not update member status or re-evaluate when the email send fails', async () => {
    comms.sendEmail.mockRejectedValue(new Error('transport failed'));

    await expect(service.sendInvite('user-1', 'booking-1', 'member-1', {
      templateId: 'template-1', subject: 'Invite', body: '<p>Invite</p>',
    })).rejects.toThrow('transport failed');

    expect(repo.markMemberInvited).not.toHaveBeenCalled();
    expect(reeval.onBandRosterChanged).not.toHaveBeenCalled();
  });

  it('rejects a member without an email address with an actionable reason and does not send', async () => {
    repo.findBandInviteData.mockResolvedValue({
      ...memberInviteData,
      contact: { ...memberInviteData.contact, email: null },
    });

    await expect(service.sendInvite('user-1', 'booking-1', 'member-1', {
      templateId: 'template-1', subject: 'Invite', body: '<p>Invite</p>',
    })).rejects.toThrow(new BadRequestException('Add an email address to Dave Jones before sending an invitation'));

    expect(comms.sendEmail).not.toHaveBeenCalled();
    expect(repo.markMemberInvited).not.toHaveBeenCalled();
  });

  it('does not render a different template as a band invite', async () => {
    comms.findTemplate.mockResolvedValue({ id: 'template-1', builtInType: 'confirmation', content: {} });

    await expect(service.renderInvite('user-1', 'booking-1', 'member-1', 'template-1')).rejects.toThrow(NotFoundException);

    expect(mail.renderForCompose).not.toHaveBeenCalled();
  });

  it('returns not found for removed or foreign members', async () => {
    repo.findBandInviteData.mockResolvedValue(null);

    await expect(service.buildBandMemberContext('user-1', 'booking-1', 'member-1')).rejects.toThrow(NotFoundException);
    expect(mail.buildContext).not.toHaveBeenCalled();
  });

  it('renders a call-sheet email from the member context and the call-sheet template', async () => {
    comms.findTemplate.mockResolvedValue({ id: 'call-sheet-template', builtInType: 'band_call_sheet', content: {} });

    await expect(service.renderCallSheet('user-1', 'booking-1', 'member-1', 'call-sheet-template')).resolves.toEqual({
      subject: 'Invite Dave',
      body: '<p>Hello Dave</p>',
      missingVariables: [],
    });
    expect(mail.renderForCompose).toHaveBeenCalledWith(
      expect.objectContaining({ builtInType: 'band_call_sheet' }),
      expect.objectContaining({ bandMemberName: 'Dave Jones', portalLink: 'https://app.gigloop.com/band/member-token' }),
    );
  });

  it('renders the call-sheet message through the plain-text adapter and member context', async () => {
    const content = { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
    comms.findTemplate.mockResolvedValue({ id: 'call-sheet-message', builtInType: 'band_call_sheet_message', content });
    mail.renderPlainText.mockReturnValue({ text: 'Call sheet: https://app.gigloop.com/band/member-token', missingVariables: [] });

    await expect(service.renderCallSheetMessage('user-1', 'booking-1', 'member-1', 'call-sheet-message')).resolves.toEqual({
      body: 'Call sheet: https://app.gigloop.com/band/member-token',
      missingVariables: [],
    });
    expect(mail.renderPlainText).toHaveBeenCalledWith(content, expect.objectContaining({
      bandMemberName: 'Dave Jones',
      portalLink: 'https://app.gigloop.com/band/member-token',
    }));
  });

  it('sends the call-sheet PDF as an application/pdf attachment and links the stored document', async () => {
    comms.findTemplate.mockResolvedValue({ id: 'call-sheet-template', builtInType: 'band_call_sheet', content: {} });

    await service.sendCallSheet('user-1', 'booking-1', 'member-1', {
      templateId: 'call-sheet-template', subject: 'Edited call sheet', body: '<p>See attached.</p>',
    });

    expect(documents.generateAndStoreCallSheetPdf).toHaveBeenCalledWith('user-1', 'booking-1');
    expect(documents.generateAndStoreCallSheetPdf).toHaveBeenCalledTimes(1);
    expect(comms.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      bookingId: 'booking-1',
      contactId: 'contact-1',
      to: 'dave@example.com',
      subject: 'Edited call sheet',
      body: '<p>See attached.</p>',
      templateId: 'call-sheet-template',
      documentId: 'document-1',
      attachments: [{
        filename: 'call-sheet.pdf',
        content: Buffer.from('%PDF-call-sheet'),
        contentType: 'application/pdf',
      }],
    }));
    expect(repo.markMemberInvited).not.toHaveBeenCalled();
    expect(reeval.onBandRosterChanged).not.toHaveBeenCalled();
  });

  it('rejects call-sheet email without a contact email while keeping its message renderer independent', async () => {
    comms.findTemplate.mockResolvedValue({ id: 'call-sheet-template', builtInType: 'band_call_sheet', content: {} });
    repo.findBandInviteData.mockResolvedValue({
      ...memberInviteData,
      contact: { ...memberInviteData.contact, email: null },
    });

    await expect(service.sendCallSheet('user-1', 'booking-1', 'member-1', {
      templateId: 'call-sheet-template', subject: 'Call sheet', body: '<p>See attached.</p>',
    })).rejects.toThrow(new BadRequestException('Add an email address to Dave Jones before sending a call sheet'));
    expect(documents.generateAndStoreCallSheetPdf).not.toHaveBeenCalled();
    expect(comms.sendEmail).not.toHaveBeenCalled();
  });

  it('removes the generated call-sheet document when email delivery fails', async () => {
    comms.findTemplate.mockResolvedValue({ id: 'call-sheet-template', builtInType: 'band_call_sheet', content: {} });
    comms.sendEmail.mockRejectedValue(new Error('mail transport failed'));

    await expect(service.sendCallSheet('user-1', 'booking-1', 'member-1', {
      templateId: 'call-sheet-template', subject: 'Call sheet', body: '<p>See attached.</p>',
    })).rejects.toThrow('mail transport failed');

    expect(documents.discardUnsentCallSheet).toHaveBeenCalledWith('user-1', 'booking-1', 'document-1');
  });

  it('renders and sends final details as a member-specific email without an attachment or status change', async () => {
    comms.findTemplate.mockResolvedValue({ id: 'final-details-template', builtInType: 'band_final_details', content: {} });
    await expect(service.renderFinalDetails('user-1', 'booking-1', 'member-1', 'final-details-template')).resolves.toEqual({
      subject: 'Invite Dave', body: '<p>Hello Dave</p>', missingVariables: [],
    });

    await service.sendFinalDetails('user-1', 'booking-1', 'member-1', {
      templateId: 'final-details-template', subject: 'Edited final details', body: '<p>See you soon.</p>',
    });

    expect(comms.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      bookingId: 'booking-1', contactId: 'contact-1', to: 'dave@example.com',
      subject: 'Edited final details', body: '<p>See you soon.</p>', templateId: 'final-details-template',
    }));
    expect(comms.sendEmail.mock.calls[0][0]).not.toHaveProperty('attachments');
    expect(comms.sendEmail.mock.calls[0][0]).not.toHaveProperty('documentId');
    expect(documents.generateAndStoreCallSheetPdf).not.toHaveBeenCalled();
    expect(repo.markMemberInvited).not.toHaveBeenCalled();
    expect(reeval.onBandRosterChanged).not.toHaveBeenCalled();
  });

  it('renders final-details copy through the plain-text adapter and rejects the wrong template', async () => {
    const content = { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
    comms.findTemplate.mockResolvedValue({ id: 'final-details-message', builtInType: 'band_final_details_message', content });
    mail.renderPlainText.mockReturnValue({ text: 'Final details: portal link', missingVariables: [] });

    await expect(service.renderFinalDetailsMessage('user-1', 'booking-1', 'member-1', 'final-details-message')).resolves.toEqual({
      body: 'Final details: portal link', missingVariables: [],
    });
    expect(mail.renderPlainText).toHaveBeenCalledWith(content, expect.objectContaining({
      bandMemberName: 'Dave Jones', portalLink: 'https://app.gigloop.com/band/member-token',
    }));

    comms.findTemplate.mockResolvedValue({ id: 'wrong-template', builtInType: 'band_call_sheet', content });
    await expect(service.renderFinalDetailsMessage('user-1', 'booking-1', 'member-1', 'wrong-template')).rejects.toThrow(NotFoundException);
  });
});
