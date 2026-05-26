import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PortalRepository } from './portal.repository';
import { MailService } from '../mail/mail.service';
import { DocumentsService } from '../documents/documents.service';
import { StorageService } from '../storage/storage.service';
import { substituteTiptapVariables } from '../mail/tiptap-portal';
import type { Request } from 'express';

@Injectable()
export class PortalService {
  constructor(
    private repo: PortalRepository,
    private mail: MailService,
    private documents: DocumentsService,
    private storage: StorageService,
  ) {}

  async getBookingData(token: string) {
    const booking = await this.repo.findBookingByToken(token);
    if (!booking) throw new NotFoundException('Booking not found');

    const publicProfile = await this.repo.findPublicProfile(booking.userId);
    if (!publicProfile) throw new NotFoundException('Booking not found');

    const signedDoc = booking.documents[0];
    const signedContractUrl = signedDoc
      ? this.storage.getPublicUrl(signedDoc.storageKey)
      : null;

    const sentDepositInvoice = booking.invoices[0] ?? null;

    return {
      booking: {
        id: booking.id,
        date: booking.date.toISOString(),
        fee: booking.fee != null ? Number(booking.fee).toFixed(2) : null,
        title: booking.title,
        status: booking.status,
        customerName: booking.customer.name,
        venueName: booking.venue?.name ?? null,
        sets: booking.sets.map((s) => ({
          order: s.order,
          label: s.label,
          startTime: s.startTime,
          duration: s.duration,
        })),
        contractSignedAt: booking.contractSignedAt?.toISOString() ?? null,
      },
      publicProfile: {
        businessName: publicProfile.businessName,
        displayName: publicProfile.displayName,
        bio: publicProfile.bio,
        email: publicProfile.email,
        phone: publicProfile.phone,
        logoUrl: publicProfile.logoUrl,
        brandColour: publicProfile.brandColour ?? '#1a1a1a',
        photo: publicProfile.photo,
        portalTheme: publicProfile.portalTheme,
      },
      signedContractUrl,
      hasMusicForm: !!booking.musicFormConfig,
      depositInvoiceDueDate: sentDepositInvoice?.dueDate?.toISOString() ?? null,
    };
  }

  async getContractContent(token: string) {
    const booking = await this.repo.findBookingByToken(token);
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.contractSignedAt) throw new BadRequestException('already_signed');

    const template = await this.repo.findContractTemplate(booking.userId);
    if (!template) throw new NotFoundException('Contract template not found');

    const publicProfile = await this.repo.findPublicProfile(booking.userId);
    if (!publicProfile) throw new NotFoundException('Booking not found');

    const context = await this.mail.buildContext(booking.userId, booking.id);

    const substituted = substituteTiptapVariables(template.content, context);

    const title = booking.title ?? `${booking.customer.name} · ${booking.date.toISOString().split('T')[0]}`;

    return { content: substituted, title };
  }

  async signContract(token: string, signatureBase64: string, req: Request) {
    const booking = await this.repo.findBookingByToken(token);
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.contractSignedAt) throw new BadRequestException('Contract already signed');

    const template = await this.repo.findContractTemplate(booking.userId);
    if (!template) throw new NotFoundException('Contract template not found');

    const publicProfile = await this.repo.findPublicProfile(booking.userId);
    if (!publicProfile) throw new NotFoundException('Booking not found');

    const context = await this.mail.buildContext(booking.userId, booking.id);

    const signedAt = new Date();
    const ip = this.extractIp(req);

    await this.documents.generateAndStoreSignedContractPdf(
      booking.userId,
      booking.id,
      template.content,
      context,
      publicProfile.displayName ?? publicProfile.businessName,
      booking.customer.name,
      signatureBase64,
      signedAt,
      ip,
    );

    await this.repo.markContractSigned(booking.id, ip);

    await this.sendSigningNotification(booking, publicProfile, signedAt);
  }

  private async sendSigningNotification(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    booking: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    publicProfile: any,
    signedAt: Date,
  ) {
    if (!publicProfile.email) return;

    const bookingTitle = booking.title ?? `${booking.customer.name} · ${booking.date.toISOString().split('T')[0]}`;
    const bookingDate = booking.date.toISOString().split('T')[0];
    const venueLine = booking.venue ? `\nVenue: ${booking.venue.name}` : '';

    let depositSection = '';
    if (booking.depositTrackingMode !== 'NONE') {
      if (booking.depositReceivedAt) {
        const adminUrl = `${process.env.APP_BASE_URL}/admin/bookings/${booking.id}`;
        depositSection = `\n\nThe deposit has also been received. Mark this booking as Confirmed:\n${adminUrl}`;
      } else {
        const depositInvoice = await this.repo.findDepositInvoice(booking.id, booking.userId);
        const dueDate = depositInvoice?.dueDate
          ? `Awaiting deposit — due ${depositInvoice.dueDate.toISOString().split('T')[0]}.`
          : 'Awaiting deposit.';
        depositSection = `\n\n${dueDate}`;
      }
    }

    const adminUrl = `${process.env.APP_BASE_URL}/admin/bookings/${booking.id}`;
    const body = `${booking.customer.name} has signed the contract for ${bookingTitle}.\n\nBooking date: ${bookingDate}${venueLine}\nSigned at: ${signedAt.toISOString()}\n\nView booking: ${adminUrl}${depositSection}`;

    await this.mail.send({
      to: publicProfile.email,
      subject: `${booking.customer.name} has signed your contract for ${bookingTitle}`,
      body: body.replace(/\n/g, '<br>'),
    });
  }

  private extractIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
    }
    return req.socket?.remoteAddress ?? 'unknown';
  }
}
