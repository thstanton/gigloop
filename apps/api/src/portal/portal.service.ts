import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PortalRepository } from './portal.repository';
import { MailService } from '../mail/mail.service';
import { DocumentsService } from '../documents/documents.service';
import { StorageService } from '../storage/storage.service';
import type { Request } from 'express';
import type { SubmitMusicFormDto } from './dto/submit-music-form.dto';

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

    const sentDepositInvoice = booking.invoices[0] ?? null;

    const contractEmailTypes = new Set(['contract_cover', 'contract_and_deposit_cover']);
    const hasContractEmail = booking.communications.some(
      (c) => c.sentAt && c.template?.builtInType && contractEmailTypes.has(c.template.builtInType),
    );

    const documents = booking.documents.map((doc) => {
      let label: string;
      if (doc.type === 'CONTRACT') {
        label = 'Signed contract';
      } else if (doc.type === 'SONG_LIST') {
        label = 'Song list';
      } else if (doc.invoice?.isDeposit) {
        label = `Deposit invoice${doc.invoice.invoiceNumber ? ` ${doc.invoice.invoiceNumber}` : ''}`;
      } else {
        label = `Invoice${doc.invoice?.invoiceNumber ? ` ${doc.invoice.invoiceNumber}` : ''}`;
      }
      return {
        id: doc.id,
        type: doc.type as 'CONTRACT' | 'INVOICE' | 'SONG_LIST',
        label,
        url: this.storage.getPublicUrl(doc.storageKey),
        createdAt: doc.createdAt.toISOString(),
      };
    });

    const signedContract = booking.documents.find((d) => d.type === 'CONTRACT');
    const signedContractUrl = signedContract
      ? this.storage.getPublicUrl(signedContract.storageKey)
      : null;

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
      documents,
      hasMusicForm: !!booking.musicFormConfig,
      hasMusicFormResponse: !!booking.musicFormResponse,
      hasContractEmail,
      depositInvoiceDueDate: sentDepositInvoice?.dueDate?.toISOString() ?? null,
    };
  }

  async getContractContent(token: string) {
    const booking = await this.repo.findBookingByToken(token);
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.contractSignedAt) throw new BadRequestException('already_signed');

    if (!booking.contractContent) throw new NotFoundException('Contract not found');

    const title = booking.title ?? `${booking.customer.name} · ${booking.date.toISOString().split('T')[0]}`;

    return { content: booking.contractContent, title };
  }

  async signContract(token: string, signatureBase64: string, req: Request) {
    const booking = await this.repo.findBookingByToken(token);
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.contractSignedAt) throw new BadRequestException('Contract already signed');

    if (!booking.contractContent) throw new NotFoundException('Contract not found');

    const publicProfile = await this.repo.findPublicProfile(booking.userId);
    if (!publicProfile) throw new NotFoundException('Booking not found');

    // Context still needed for musicianName/customerName resolution used inside generateAndStoreSignedContractPdf.
    // The second substitution pass on already-substituted content is a no-op.
    const context = await this.mail.buildContext(booking.userId, booking.id);

    const signedAt = new Date();
    const ip = this.extractIp(req);

    await this.documents.generateAndStoreSignedContractPdf(
      booking.userId,
      booking.id,
      booking.contractContent,
      context,
      publicProfile.displayName ?? publicProfile.businessName,
      booking.customer.name,
      signatureBase64,
      signedAt,
      ip,
    );

    await this.repo.markContractSigned(booking.id, ip, signatureBase64);

    await this.sendSigningNotification(booking, publicProfile, signedAt);
  }

  async getMusicFormData(token: string) {
    const data = await this.repo.findMusicFormDataByToken(token);
    if (!data) throw new NotFoundException('Booking not found');
    if (!data.musicFormConfig) throw new NotFoundException('Music form not found');

    const config = data.musicFormConfig as { keyMoments: unknown; enabledGenres: string[] };
    const [songs, allSongs] = await Promise.all([
      this.repo.findSongsByUserId(data.userId, config.enabledGenres),
      this.repo.findAllSongsByUserId(data.userId),
    ]);

    return {
      config: {
        keyMoments: config.keyMoments,
        enabledGenres: config.enabledGenres,
      },
      songs,
      allSongs,
      existingResponse: data.musicFormResponse
        ? {
            selectedSongIds: data.musicFormResponse.selectedSongIds,
            specialRequests: data.musicFormResponse.specialRequests,
            notes: data.musicFormResponse.notes,
          }
        : null,
    };
  }

  async submitMusicForm(token: string, dto: SubmitMusicFormDto) {
    const data = await this.repo.findMusicFormDataByToken(token);
    if (!data) throw new NotFoundException('Booking not found');
    if (!data.musicFormConfig) throw new NotFoundException('Music form not found');

    const submittedAt = new Date();
    await this.repo.upsertMusicFormResponse(
      data.id,
      data.userId,
      dto.selectedSongIds,
      dto.specialRequests,
      dto.notes,
    );

    // Fire-and-forget: PDF generation + email (do not fail the submission)
    this.generateSongListAndNotify(data, dto, submittedAt).catch(() => {});
  }

  private async generateSongListAndNotify(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bookingData: { id: string; userId: string; musicFormConfig: any },
    dto: SubmitMusicFormDto,
    submittedAt: Date,
  ) {
    const [booking, publicProfile, songs] = await Promise.all([
      this.repo.findBookingForSongList(bookingData.id),
      this.repo.findPublicProfile(bookingData.userId),
      this.repo.findSongsByIds(bookingData.userId, [
        ...dto.selectedSongIds,
        ...dto.specialRequests.map((r) => r.songId).filter((id): id is string => !!id),
      ]),
    ]);

    if (!booking || !publicProfile) return;

    const songMap = new Map(songs.map((s) => [s.id, s]));
    const config = bookingData.musicFormConfig as { keyMoments: Array<{ label: string; section: string }>; enabledGenres: string[] };

    const selectedSongs = dto.selectedSongIds
      .map((id) => songMap.get(id))
      .filter((s): s is NonNullable<typeof s> => s !== undefined);

    const specialRequests = config.keyMoments.map((km) => {
      const req = dto.specialRequests.find((r) => r.key === km.label);
      return {
        key: km.label,
        section: km.section,
        song: req?.songId ? (songMap.get(req.songId) ?? undefined) : undefined,
        freeText: req?.freeText,
      };
    });

    const bookingTitle = booking.title ?? `${booking.customer.name} · ${booking.date.toISOString().split('T')[0]}`;
    const bookingDate = booking.date.toISOString().split('T')[0];
    const musicianName = publicProfile.displayName ?? publicProfile.businessName;

    // Generate PDF
    const { buffer } = await this.documents.generateAndStoreSongListPdf(
      bookingData.userId,
      bookingData.id,
      {
        musicianName,
        customerName: booking.customer.name,
        bookingDate,
        venueName: booking.venue?.name ?? null,
        specialRequests,
        selectedSongs,
        notes: dto.notes ?? null,
        submittedAt: submittedAt.toISOString().replace('T', ' ').split('.')[0] + ' UTC',
      },
    );

    if (!publicProfile.email) return;

    // Build email body
    const adminUrl = `${process.env.APP_BASE_URL}/admin/bookings/${bookingData.id}`;
    let body = `${booking.customer.name} has submitted their song requests for ${bookingTitle}.\n\n`;

    if (specialRequests.length > 0) {
      body += 'KEY MOMENTS\n';
      const sectionMap = new Map<string, typeof specialRequests>();
      for (const req of specialRequests) {
        if (!sectionMap.has(req.section)) sectionMap.set(req.section, []);
        sectionMap.get(req.section)!.push(req);
      }
      for (const [section, reqs] of sectionMap.entries()) {
        body += `\n${section}\n`;
        for (const req of reqs) {
          const song = req.song
            ? `${req.song.title}${req.song.artist ? ` — ${req.song.artist}` : ''}`
            : req.freeText ?? '(no selection)';
          body += `  ${req.key}: ${song}\n`;
        }
      }
      body += '\n';
    }

    if (selectedSongs.length > 0) {
      body += 'GENERAL REQUESTS\n';
      const genreMap = new Map<string, typeof selectedSongs>();
      for (const song of selectedSongs) {
        if (!genreMap.has(song.genre)) genreMap.set(song.genre, []);
        genreMap.get(song.genre)!.push(song);
      }
      for (const [genre, songs] of genreMap.entries()) {
        body += `\n${genre}\n`;
        for (const song of songs) {
          body += `  ${song.title}${song.artist ? ` — ${song.artist}` : ''}\n`;
        }
      }
      body += '\n';
    }

    if (dto.notes) body += `NOTES\n${dto.notes}\n\n`;
    body += `View booking: ${adminUrl}`;

    await this.mail.send({
      to: publicProfile.email,
      subject: `${booking.customer.name} has submitted their song requests for ${bookingTitle}`,
      body: body.replace(/\n/g, '<br>'),
      attachments: [{ filename: 'song-list.pdf', content: buffer }],
    });
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
