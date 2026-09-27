import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { BuiltInTemplateType } from '../templates/default-templates';
import { MailService, type EmailContext } from '../mail/mail.service';
import { CommunicationsService } from '../communications/communications.service';
import { BookingsRepository } from './bookings.repository';
import { buildBandInviteCalendar } from './band-invite-calendar';

type BandEmailContext = EmailContext & { bandMemberName: string };
export type BandInviteData = NonNullable<Awaited<ReturnType<BookingsRepository['findBandInviteData']>>>;
export type BandCommunicationTemplateType = Extract<BuiltInTemplateType, `band_${string}`>;

export type BuiltBandMemberContext = {
  emailContext: BandEmailContext;
  inviteData: BandInviteData;
};

@Injectable()
export class BandCommunicationContentService {
  constructor(
    private readonly bookings: BookingsRepository,
    private readonly mail: MailService,
    private readonly communications: CommunicationsService,
  ) {}

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
    return this.renderBandEmail(userId, bookingId, memberId, templateId, 'band_invite', 'Band invitation template not found');
  }

  async renderInviteMessage(userId: string, bookingId: string, memberId: string, templateId: string) {
    return this.renderBandMessage(
      userId, bookingId, memberId, templateId, 'band_invite_message', 'Band invitation message template not found',
    );
  }

  async renderCallSheet(userId: string, bookingId: string, memberId: string, templateId: string) {
    return this.renderBandEmail(
      userId, bookingId, memberId, templateId, 'band_call_sheet', 'Band call-sheet template not found',
    );
  }

  async renderCallSheetMessage(userId: string, bookingId: string, memberId: string, templateId: string) {
    return this.renderBandMessage(
      userId, bookingId, memberId, templateId, 'band_call_sheet_message', 'Band call-sheet message template not found',
    );
  }

  async renderFinalDetails(userId: string, bookingId: string, memberId: string, templateId: string) {
    return this.renderBandEmail(
      userId, bookingId, memberId, templateId, 'band_final_details', 'Band final-details template not found',
    );
  }

  async renderFinalDetailsMessage(userId: string, bookingId: string, memberId: string, templateId: string) {
    return this.renderBandMessage(
      userId,
      bookingId,
      memberId,
      templateId,
      'band_final_details_message',
      'Band final-details message template not found',
    );
  }

  findBandTemplate(
    userId: string,
    templateId: string,
    builtInType: BandCommunicationTemplateType,
    notFoundMessage = `${this.templateLabel(builtInType)} template not found`,
  ) {
    return this.communications.findTemplate(userId, templateId).then((template) => {
      if (!template || template.builtInType !== builtInType) throw new NotFoundException(notFoundMessage);
      return template;
    });
  }

  buildInviteCalendar(bookingId: string, context: BuiltBandMemberContext): string {
    const { inviteData, emailContext } = context;
    return buildBandInviteCalendar({
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
  }

  private async renderBandEmail(
    userId: string,
    bookingId: string,
    memberId: string,
    templateId: string,
    builtInType: BandCommunicationTemplateType,
    notFoundMessage: string,
  ) {
    const { template, emailContext } = await this.templateContext(
      userId, bookingId, memberId, templateId, builtInType, notFoundMessage,
    );
    return this.mail.renderForCompose(template, emailContext);
  }

  private async renderBandMessage(
    userId: string,
    bookingId: string,
    memberId: string,
    templateId: string,
    builtInType: BandCommunicationTemplateType,
    notFoundMessage: string,
  ) {
    const { template, emailContext } = await this.templateContext(
      userId, bookingId, memberId, templateId, builtInType, notFoundMessage,
    );
    const { text, missingVariables } = this.mail.renderPlainText(template.content, emailContext);
    return { body: text, missingVariables };
  }

  private async templateContext(
    userId: string,
    bookingId: string,
    memberId: string,
    templateId: string,
    builtInType: BandCommunicationTemplateType,
    notFoundMessage: string,
  ) {
    const template = await this.findBandTemplate(userId, templateId, builtInType, notFoundMessage);
    const { emailContext } = await this.buildBandMemberContext(userId, bookingId, memberId);
    return { template, emailContext };
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

  private templateLabel(type: BandCommunicationTemplateType): string {
    if (type.includes('invite')) return 'Band invitation';
    if (type.includes('call_sheet')) return 'Band call-sheet';
    return 'Band final-details';
  }
}
