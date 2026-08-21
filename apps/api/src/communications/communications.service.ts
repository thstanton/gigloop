import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CommunicationsRepository } from './communications.repository';
import { MailService } from '../mail/mail.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { ChecklistReevaluator } from '../checklist/checklist-reevaluator.service';
import { ContactsService } from '../contacts/contacts.service';
import { resolveMusicFormVisibility } from '../portal/portal-visibility';

// #533 / #631: the music-form invite may only be emailed once the form is published — you can no
// more invite a client to an unpublished form than Send an un-Issued invoice. Publication is the
// prerequisite; the gate uses the same authority the portal + admin indicator read.
const MUSIC_FORM_INVITE_TEMPLATE = 'music_form_invite';

export interface SendEmailOptions {
  userId: string;
  bookingId?: string;
  seriesId?: string;
  contactId: string;
  to: string;
  subject: string;
  body: string;
  templateId?: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
  /** ID of the Document attached to this email (set when sending an invoice PDF). */
  documentId?: string;
}

@Injectable()
export class CommunicationsService {
  constructor(
    private repo: CommunicationsRepository,
    private mail: MailService,
    private reeval: ChecklistReevaluator,
    private contacts: ContactsService,
  ) {}

  findAll(userId: string, bookingId: string) {
    return this.repo.findAll(userId, bookingId);
  }

  async findOne(userId: string, bookingId: string, id: string) {
    const communication = await this.repo.findOne(userId, bookingId, id);
    if (!communication) throw new NotFoundException('Communication not found');
    return communication;
  }

  async create(userId: string, bookingId: string, dto: CreateCommunicationDto) {
    const booking = await this.repo.findBookingById(userId, bookingId);
    if (!booking) throw new NotFoundException('Booking not found');
    // FK-ownership (#709): the contact the communication is logged against must belong to the caller.
    await this.contacts.assertOwned(userId, [dto.contactId]);
    const result = await this.repo.create(userId, bookingId, dto);
    await this.reeval.onBookingChanged(bookingId);
    return result;
  }

  findTemplate(userId: string, templateId: string) {
    return this.repo.findTemplate(userId, templateId);
  }

  // #533 / #631: reject a music-form-invite send when the form is not published (a real 4xx, so a
  // direct/stale POST can't email an invite for a hidden form — the render gate and the action gate
  // must agree, same leak-class as the cancelled-contract fix). No-op for every other template.
  private async assertMusicInviteAllowed(
    userId: string,
    bookingId: string,
    templateId: string | undefined,
  ): Promise<void> {
    if (!templateId) return;
    const template = await this.repo.findTemplate(userId, templateId);
    if (template?.builtInType !== MUSIC_FORM_INVITE_TEMPLATE) return;
    const config = await this.repo.findMusicFormConfig(userId, bookingId);
    const visible =
      resolveMusicFormVisibility(!!config, config?.publishedAt != null)?.visible ?? false;
    if (!visible) {
      throw new ConflictException('Publish the music form before sending its invite.');
    }
  }

  // Series-invoice path (ADR-0080): no single booking to scope to, so the Communication is
  // recorded against seriesId instead — mirroring the booking branch's PENDING/SENT/FAILED
  // lifecycle so a series send is no less auditable than a booking one. The invoice (and its
  // seriesId) is already loaded under userId upstream (invoices/series service), and `to` is
  // DTO-validated as an email. FK-ownership (#709/#681 M1): the recipient contact must still
  // belong to the caller — parity with the booking branch below. #847 made this path reachable
  // from the UI for the first time, so the two branches must not differ on who may be emailed.
  // No ChecklistReevaluator call: series bookings have no series-scoped checklist (ADR-0078).
  private async sendSeriesEmail(
    options: Omit<SendEmailOptions, 'bookingId'>,
  ): Promise<void> {
    const { userId, seriesId, contactId, to, subject, body, templateId, attachments, documentId } = options;
    await this.contacts.assertOwned(userId, [contactId]);
    // sendEmail's `!bookingId` branch is the only caller of this method, and its one caller
    // (InvoiceTransitionService.send) always passes exactly one of bookingId/seriesId (ADR-0029's
    // polymorphic invariant) — so seriesId is set here in every real path. Guarded rather than
    // asserted: an absent seriesId still sends the email, just without an audit row, matching the
    // pre-ADR-0080 behaviour instead of throwing on a caller bug this type can't fully prevent.
    const communication = seriesId
      ? await this.repo.createPendingForSeries(userId, seriesId, contactId, subject, body, templateId, documentId)
      : undefined;
    try {
      // #932: client-facing correspondence — personalize From/Reply-To with the musician's
      // own identity so a client's reply reaches them, not a black hole.
      const senderIdentity = await this.mail.getSenderIdentity(userId);
      await this.mail.send({ to, subject, body, attachments, senderIdentity });
      if (communication) await this.repo.markSent(communication.id);
    } catch (err) {
      if (communication) await this.repo.markFailed(communication.id);
      throw err;
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    const { userId, bookingId, contactId, to, subject, body, templateId, attachments, documentId } = options;
    if (!bookingId) return this.sendSeriesEmail(options);
    // #681 (M1): verify the booking belongs to the caller before sending. Without this,
    // removing MailService's hardcoded recipient would turn this into an authenticated open
    // relay — any caller could POST an arbitrary `to` against any bookingId and have it sent.
    const booking = await this.repo.findBookingById(userId, bookingId);
    if (!booking) throw new NotFoundException('Booking not found');
    // FK-ownership (#709): the recipient contact must belong to the caller before we persist and send.
    await this.contacts.assertOwned(userId, [contactId]);
    await this.assertMusicInviteAllowed(userId, bookingId, templateId);
    const communication = await this.repo.createPending(userId, bookingId, contactId, subject, body, templateId, documentId);
    try {
      // #932: client-facing correspondence — personalize From/Reply-To.
      const senderIdentity = await this.mail.getSenderIdentity(userId);
      await this.mail.send({ to, subject, body, attachments, senderIdentity });
      await this.repo.markSent(communication.id);
      await this.reeval.onBookingChanged(bookingId);
    } catch (err) {
      await this.repo.markFailed(communication.id);
      await this.reeval.onBookingChanged(bookingId);
      throw err;
    }
  }
}
