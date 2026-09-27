import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CommunicationsService, type SendEmailOptions } from '../communications/communications.service';
import { ChecklistReevaluator } from '../checklist/checklist-reevaluator.service';
import { DocumentsService } from '../documents/documents.service';
import { BookingsRepository } from './bookings.repository';
import {
  BandCommunicationContentService,
  type BandCommunicationTemplateType,
  type BuiltBandMemberContext,
} from './band-communication-content.service';

export type SendBandInviteInput = {
  templateId: string;
  subject: string;
  body: string;
};

type BandEmailAction = 'an invitation' | 'a call sheet' | 'final details';

interface PrepareBandEmailInput {
  userId: string;
  bookingId: string;
  memberId: string;
  input: SendBandInviteInput;
  templateType: BandCommunicationTemplateType;
  notFoundMessage: string;
  action: BandEmailAction;
}

type PreparedBandEmail = PrepareBandEmailInput & {
  template: Awaited<ReturnType<BandCommunicationContentService['findBandTemplate']>>;
  context: BuiltBandMemberContext;
  recipient: string;
};

@Injectable()
export class BandCommunicationsService {
  constructor(
    private readonly bookings: BookingsRepository,
    private readonly content: BandCommunicationContentService,
    private readonly communications: CommunicationsService,
    private readonly reeval: ChecklistReevaluator,
    private readonly documents: DocumentsService,
  ) {}

  /** Booking context plus the facts that belong to this specific band member. */
  async buildBandMemberContext(
    userId: string,
    bookingId: string,
    memberId: string,
  ): Promise<BuiltBandMemberContext> {
    return this.content.buildBandMemberContext(userId, bookingId, memberId);
  }

  async renderInvite(userId: string, bookingId: string, memberId: string, templateId: string) {
    return this.content.renderInvite(userId, bookingId, memberId, templateId);
  }

  async renderInviteMessage(userId: string, bookingId: string, memberId: string, templateId: string) {
    return this.content.renderInviteMessage(userId, bookingId, memberId, templateId);
  }

  async renderCallSheet(userId: string, bookingId: string, memberId: string, templateId: string) {
    return this.content.renderCallSheet(userId, bookingId, memberId, templateId);
  }

  async renderCallSheetMessage(userId: string, bookingId: string, memberId: string, templateId: string) {
    return this.content.renderCallSheetMessage(userId, bookingId, memberId, templateId);
  }

  async renderFinalDetails(userId: string, bookingId: string, memberId: string, templateId: string) {
    return this.content.renderFinalDetails(userId, bookingId, memberId, templateId);
  }

  async renderFinalDetailsMessage(userId: string, bookingId: string, memberId: string, templateId: string) {
    return this.content.renderFinalDetailsMessage(userId, bookingId, memberId, templateId);
  }

  async sendInvite(
    userId: string,
    bookingId: string,
    memberId: string,
    input: SendBandInviteInput,
  ): Promise<void> {
    const prepared = await this.prepareBandEmail({
      userId,
      bookingId,
      memberId,
      input,
      templateType: 'band_invite',
      notFoundMessage: 'Band invitation template not found',
      action: 'an invitation',
    });
    const calendar = this.content.buildInviteCalendar(bookingId, prepared.context);

    // sendEmail is the one Communication logging and pre-status re-evaluation site. Only after it
    // resolves may this member become INVITED; this second re-evaluation observes the new status.
    await this.sendBandEmail(prepared, {
      attachments: [{ filename: 'band-invite.ics', content: Buffer.from(calendar, 'utf8'), contentType: 'text/calendar' }],
    });

    const update = await this.bookings.markMemberInvited(userId, bookingId, memberId, new Date());
    if (update.count === 0) throw new NotFoundException('Band member not found');
    await this.reeval.onBookingChanged(bookingId);
  }

  async sendCallSheet(
    userId: string,
    bookingId: string,
    memberId: string,
    input: SendBandInviteInput,
  ): Promise<void> {
    const prepared = await this.prepareBandEmail({
      userId,
      bookingId,
      memberId,
      input,
      templateType: 'band_call_sheet',
      notFoundMessage: 'Band call-sheet template not found',
      action: 'a call sheet',
    });

    const { buffer, documentId } = await this.documents.generateAndStoreCallSheetPdf(userId, bookingId);
    try {
      await this.sendBandEmail(prepared, {
        documentId,
        attachments: [{ filename: 'call-sheet.pdf', content: buffer, contentType: 'application/pdf' }],
      });
    } catch (error) {
      await this.documents.discardUnsentCallSheet(userId, bookingId, documentId);
      throw error;
    }
  }

  async sendFinalDetails(
    userId: string,
    bookingId: string,
    memberId: string,
    input: SendBandInviteInput,
  ): Promise<void> {
    const prepared = await this.prepareBandEmail({
      userId,
      bookingId,
      memberId,
      input,
      templateType: 'band_final_details',
      notFoundMessage: 'Band final-details template not found',
      action: 'final details',
    });
    await this.sendBandEmail(prepared);
  }

  private async prepareBandEmail(input: PrepareBandEmailInput) {
    const template = await this.content.findBandTemplate(input.userId, input.input.templateId, input.templateType, input.notFoundMessage);
    const context = await this.content.buildBandMemberContext(input.userId, input.bookingId, input.memberId);
    const recipient = context.inviteData.contact.email;
    if (!recipient) {
      throw new BadRequestException(`Add an email address to ${context.inviteData.contact.name} before sending ${input.action}`);
    }
    return { ...input, template, context, recipient };
  }

  private sendBandEmail(
    prepared: PreparedBandEmail,
    extra: Pick<SendEmailOptions, 'attachments' | 'documentId'> = {},
  ) {
    return this.communications.sendEmail({
      userId: prepared.userId,
      bookingId: prepared.bookingId,
      contactId: prepared.context.inviteData.contactId,
      to: prepared.recipient,
      subject: prepared.input.subject,
      body: prepared.input.body,
      templateId: prepared.template.id,
      ...extra,
    });
  }
}
