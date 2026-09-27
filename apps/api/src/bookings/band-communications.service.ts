import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { MailService, type EmailContext } from '../mail/mail.service';
import { CommunicationsService } from '../communications/communications.service';
import { ChecklistReevaluator } from '../checklist/checklist-reevaluator.service';
import { BookingsRepository } from './bookings.repository';
import { buildBandInviteCalendar } from './band-invite-calendar';

type BandEmailContext = EmailContext & { bandMemberName: string };
type BandInviteData = NonNullable<Awaited<ReturnType<BookingsRepository['findBandInviteData']>>>;

export type BuiltBandMemberContext = {
  emailContext: BandEmailContext;
  inviteData: BandInviteData;
};

export type SendBandInviteInput = {
  templateId: string;
  subject: string;
  body: string;
};

@Injectable()
export class BandCommunicationsService {
  constructor(
    private readonly bookings: BookingsRepository,
    private readonly mail: MailService,
    private readonly communications: CommunicationsService,
    private readonly reeval: ChecklistReevaluator,
  ) {}

  /** Booking context plus the facts that belong to this specific band member. */
  async buildBandMemberContext(
    userId: string,
    bookingId: string,
    memberId: string,
  ): Promise<BuiltBandMemberContext> {
    const inviteData = await this.bookings.findBandInviteData(userId, bookingId, memberId);
    if (!inviteData) throw new NotFoundException('Band member not found');

    const baseContext = await this.mail.buildContext(userId, bookingId);
    const portalLink = `${this.appBaseUrl()}/band/${inviteData.bandPortalToken}`;
    return {
      inviteData,
      emailContext: {
        ...baseContext,
        bandMemberName: inviteData.contact.name,
        portalLink,
      },
    };
  }

  async renderInvite(userId: string, bookingId: string, memberId: string, templateId: string) {
    const template = await this.findBandTemplate(userId, templateId, 'band_invite', 'Band invitation template not found');
    const { emailContext } = await this.buildBandMemberContext(userId, bookingId, memberId);
    return this.mail.renderForCompose(template, emailContext);
  }

  async renderInviteMessage(userId: string, bookingId: string, memberId: string, templateId: string) {
    const template = await this.findBandTemplate(
      userId,
      templateId,
      'band_invite_message',
      'Band invitation message template not found',
    );
    const { emailContext } = await this.buildBandMemberContext(userId, bookingId, memberId);
    const { text, missingVariables } = this.mail.renderPlainText(template.content, emailContext);
    return { body: text, missingVariables };
  }

  async sendInvite(
    userId: string,
    bookingId: string,
    memberId: string,
    input: SendBandInviteInput,
  ): Promise<void> {
    const template = await this.findBandTemplate(userId, input.templateId, 'band_invite', 'Band invitation template not found');
    const { emailContext, inviteData } = await this.buildBandMemberContext(userId, bookingId, memberId);
    const recipient = inviteData.contact.email;
    if (!recipient) {
      throw new BadRequestException(`Add an email address to ${inviteData.contact.name} before sending an invitation`);
    }

    const calendar = buildBandInviteCalendar({
      bookingId,
      contactId: inviteData.contactId,
      bookingDate: inviteData.booking.date,
      title: inviteData.booking.title,
      venueName: inviteData.booking.venue?.name ?? null,
      venueAddress: this.venueAddress(inviteData.booking.venue),
      portalUrl: emailContext.portalLink,
      appUrl: this.appBaseUrl(),
      musicianName: emailContext.musicianName,
      musicianEmail: emailContext.musicianEmail,
      setsSchedule: emailContext.setsSchedule,
      packages: inviteData.booking.packages,
      playedPackageIds: [...new Set(inviteData.chairs.flatMap((chair) =>
        chair.lineup.packages.map((link) => link.packageId),
      ))],
      sets: inviteData.booking.sets,
    });

    // sendEmail is the one Communication logging and pre-status re-evaluation site. Only after it
    // resolves may this member become INVITED; this second re-evaluation observes the new status.
    await this.communications.sendEmail({
      userId,
      bookingId,
      contactId: inviteData.contactId,
      to: recipient,
      subject: input.subject,
      body: input.body,
      templateId: template.id,
      attachments: [{ filename: 'band-invite.ics', content: Buffer.from(calendar, 'utf8'), contentType: 'text/calendar' }],
    });

    const update = await this.bookings.markMemberInvited(userId, bookingId, memberId, new Date());
    if (update.count === 0) throw new NotFoundException('Band member not found');
    await this.reeval.onBookingChanged(bookingId);
  }

  private async findBandTemplate(
    userId: string,
    templateId: string,
    builtInType: 'band_invite' | 'band_invite_message',
    notFoundMessage: string,
  ) {
    const template = await this.communications.findTemplate(userId, templateId);
    if (!template || template.builtInType !== builtInType) throw new NotFoundException(notFoundMessage);
    return template;
  }

  private appBaseUrl(): string {
    const baseUrl = process.env.APP_BASE_URL;
    if (!baseUrl) throw new InternalServerErrorException('APP_BASE_URL is not configured');
    let end = baseUrl.length;
    while (end > 0 && baseUrl[end - 1] === '/') end -= 1;
    return baseUrl.slice(0, end);
  }

  private venueAddress(venue: BandInviteData['booking']['venue']): string | null {
    if (!venue) return null;
    const address = [venue.addressLine1, venue.addressLine2, venue.city, venue.county, venue.postcode]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(', ');
    return address || null;
  }
}
