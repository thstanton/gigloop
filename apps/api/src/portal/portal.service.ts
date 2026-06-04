import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PortalRepository } from './portal.repository';
import { MailService } from '../mail/mail.service';
import { DocumentsService } from '../documents/documents.service';
import { StorageService } from '../storage/storage.service';
import { ChecklistEvaluatorService } from '../checklist/checklist-evaluator.service';
import type { Request } from 'express';
import type { SubmitMusicFormDto } from './dto/submit-music-form.dto';

const PORTAL_CONFIG_DEFAULTS = {
  theme: 'LIGHT_MODERN',
  brandColour: '#1a1a1a',
  heroImage: null,
  showContactPhoto: false,
  showContactEmail: true,
  showContactPhone: false,
} as const;

type PortalConfigJson = Partial<{
  theme: string;
  brandColour: string;
  heroImage: string | null;
  showContactPhoto: boolean;
  showContactEmail: boolean;
  showContactPhone: boolean;
}>;

function buildPortalPublicProfile(p: {
  businessName: string;
  displayName: string | null;
  bio: string | null;
  email: string | null;
  phone: string | null;
  logoUrl: string | null;
  photo: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientPortalConfig: any;
}) {
  const cfg: PortalConfigJson = (p.clientPortalConfig as PortalConfigJson) ?? {};
  return {
    businessName: p.businessName,
    displayName: p.displayName,
    bio: p.bio,
    email: p.email,
    phone: p.phone,
    logoUrl: p.logoUrl,
    brandColour: cfg.brandColour ?? PORTAL_CONFIG_DEFAULTS.brandColour,
    photo: p.photo,
    portalTheme: cfg.theme ?? PORTAL_CONFIG_DEFAULTS.theme,
    portalHeroImage: cfg.heroImage ?? PORTAL_CONFIG_DEFAULTS.heroImage,
    showContactPhoto: cfg.showContactPhoto ?? PORTAL_CONFIG_DEFAULTS.showContactPhoto,
    showContactEmail: cfg.showContactEmail ?? PORTAL_CONFIG_DEFAULTS.showContactEmail,
    showContactPhone: cfg.showContactPhone ?? PORTAL_CONFIG_DEFAULTS.showContactPhone,
  };
}

function bookingDisplayTitle(booking: { title: string | null; customer: { name: string }; date: Date }): string {
  return booking.title ?? `${booking.customer.name} · ${booking.date.toISOString().split('T')[0]}`;
}

function resolveDisplayName(profile: { displayName: string | null; businessName: string }): string {
  return profile.displayName ?? profile.businessName;
}

function labelDocument(doc: {
  type: string;
  invoice?: { invoiceNumber: string | null; isDeposit: boolean } | null;
}): string {
  if (doc.type === 'CONTRACT') return 'Signed contract';
  if (doc.type === 'SONG_LIST') return 'Song list';
  const num = doc.invoice?.invoiceNumber ? ` ${doc.invoice.invoiceNumber}` : '';
  return doc.invoice?.isDeposit ? `Deposit invoice${num}` : `Invoice${num}`;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return map;
}

@Injectable()
export class PortalService {
  constructor(
    private repo: PortalRepository,
    private mail: MailService,
    private documents: DocumentsService,
    private storage: StorageService,
    private evaluator: ChecklistEvaluatorService,
  ) {}

  async getBookingData(token: string) {
    const booking = await this.repo.findBookingByToken(token);
    if (!booking) throw new NotFoundException('Booking not found');

    const publicProfile = await this.repo.findPublicProfile(booking.userId);
    if (!publicProfile) throw new NotFoundException('Booking not found');

    const sentDepositInvoice = booking.invoices[0] ?? null;
    const activeContract = booking.contracts?.[0] ?? null;
    // Only SENT and SIGNED are meaningful states for the client
    const contractStatus = activeContract?.status === 'SENT' || activeContract?.status === 'SIGNED'
      ? activeContract.status
      : null;

    // Exclude voided contract PDFs from the portal — clients only see the active signed contract
    const activeContractId = activeContract?.id ?? null;
    const portalDocs = booking.documents.filter(
      (doc) => doc.type !== 'CONTRACT' || doc.contractId === activeContractId,
    );
    const signedContractDoc = portalDocs.find((d) => d.type === 'CONTRACT') ?? null;
    const documents = portalDocs.map((doc) => ({
      id: doc.id,
      type: doc.type as 'CONTRACT' | 'INVOICE' | 'SONG_LIST',
      label: labelDocument(doc),
      url: this.storage.getPublicUrl(doc.storageKey),
      createdAt: doc.createdAt.toISOString(),
    }));

    const signedContractUrl = signedContractDoc
      ? this.storage.getPublicUrl(signedContractDoc.storageKey)
      : null;

    return {
      booking: {
        id: booking.id,
        date: booking.date.toISOString(),
        fee: booking.fee != null ? Number(booking.fee).toFixed(2) : null,
        title: booking.title,
        status: booking.status,
        customerName: booking.customer.name,
        customerGreetingName: booking.customer.greetingName ?? null,
        venueName: booking.venue?.name ?? null,
        sets: booking.sets.map((s) => ({
          order: s.order,
          label: s.label,
          startTime: s.startTime,
          duration: s.duration,
          packageId: s.packageId,
        })),
        formats: booking.packages.map((bpf) => ({
          id: bpf.packageId,
          label: bpf.package.label,
          icon: bpf.package.icon,
          order: bpf.order,
        })),
        contractSignedAt: activeContract?.status === 'SIGNED'
          ? activeContract.signedAt?.toISOString() ?? null
          : null,
      },
      publicProfile: buildPortalPublicProfile(publicProfile),
      signedContractUrl,
      documents,
      hasMusicForm: !!booking.musicFormConfig,
      hasMusicFormResponse: !!booking.musicFormResponse,
      contractStatus,
      depositInvoiceDueDate: sentDepositInvoice?.dueDate?.toISOString() ?? null,
    };
  }

  async getContractContent(token: string) {
    const booking = await this.repo.findBookingByToken(token);
    if (!booking) throw new NotFoundException('Booking not found');

    const contract = booking.contracts?.[0] ?? null;
    if (!contract || contract.status !== 'SENT') {
      if (contract?.status === 'SIGNED') throw new BadRequestException('already_signed');
      throw new NotFoundException('Contract not found');
    }

    return { content: contract.content, title: bookingDisplayTitle(booking) };
  }

  async signContract(token: string, signatureBase64: string, req: Request) {
    const booking = await this.repo.findBookingByToken(token);
    if (!booking) throw new NotFoundException('Booking not found');

    const contract = booking.contracts?.[0] ?? null;
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status === 'SIGNED') throw new BadRequestException('Contract already signed');
    if (contract.status !== 'SENT') throw new BadRequestException('Contract must be in SENT status to sign');

    // Context still needed for musicianName/customerName resolution used inside generateAndStoreSignedContractPdf.
    // The second substitution pass on already-substituted content is a no-op.
    const [publicProfile, context] = await Promise.all([
      this.repo.findPublicProfile(booking.userId),
      this.mail.buildContext(booking.userId, booking.id),
    ]);
    if (!publicProfile) throw new NotFoundException('Booking not found');

    const signedAt = new Date();
    const ip = this.extractIp(req);

    await this.documents.generateAndStoreSignedContractPdf(
      booking.userId,
      booking.id,
      contract.id,
      contract.content,
      context,
      resolveDisplayName(publicProfile),
      booking.customer.name,
      signatureBase64,
      signedAt,
      ip,
    );

    await this.repo.markContractSigned(contract.id, ip, signatureBase64);
    await this.evaluator.evaluate(booking.id).catch(() => {});

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

    await this.evaluator.evaluate(data.id).catch(() => {});

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

    const title = bookingDisplayTitle(booking);
    const musicianName = resolveDisplayName(publicProfile);

    const { buffer } = await this.documents.generateAndStoreSongListPdf(
      bookingData.userId,
      bookingData.id,
      {
        musicianName,
        customerName: booking.customer.name,
        bookingDate: booking.date.toISOString().split('T')[0],
        venueName: booking.venue?.name ?? null,
        specialRequests,
        selectedSongs,
        notes: dto.notes ?? null,
        submittedAt: submittedAt.toISOString().replace('T', ' ').split('.')[0] + ' UTC',
      },
    );

    if (!publicProfile.email) return;

    const grouped = this.groupSongsForEmail(specialRequests, selectedSongs);
    const body = this.buildSongListEmailBody({
      grouped,
      notes: dto.notes ?? null,
      customerName: booking.customer.name,
      bookingTitle: title,
      bookingId: bookingData.id,
    });

    await this.mail.send({
      to: publicProfile.email,
      subject: `${booking.customer.name} has submitted their song requests for ${title}`,
      body: body.replace(/\n/g, '<br>'),
      attachments: [{ filename: 'song-list.pdf', content: buffer }],
    });
  }

  private groupSongsForEmail(
    specialRequests: Array<{ key: string; section: string; song?: { title: string; artist?: string | null }; freeText?: string }>,
    selectedSongs: Array<{ title: string; artist?: string | null; genre: string }>,
  ) {
    return {
      bySection: groupBy(specialRequests, (r) => r.section),
      byGenre: groupBy(selectedSongs, (s) => s.genre),
    };
  }

  private buildKeyMomentsText(
    bySection: Map<string, Array<{ key: string; song?: { title: string; artist?: string | null }; freeText?: string }>>,
  ): string {
    if (bySection.size === 0) return '';
    let text = 'KEY MOMENTS\n';
    for (const [section, reqs] of bySection.entries()) {
      text += `\n${section}\n`;
      for (const req of reqs) {
        const artist = req.song?.artist ? ` — ${req.song.artist}` : '';
        const song = req.song ? `${req.song.title}${artist}` : (req.freeText ?? '(no selection)');
        text += `  ${req.key}: ${song}\n`;
      }
    }
    return text + '\n';
  }

  private buildGeneralRequestsText(
    byGenre: Map<string, Array<{ title: string; artist?: string | null }>>,
  ): string {
    if (byGenre.size === 0) return '';
    let text = 'GENERAL REQUESTS\n';
    for (const [genre, songs] of byGenre.entries()) {
      text += `\n${genre}\n`;
      for (const song of songs) {
        const artist = song.artist ? ` — ${song.artist}` : '';
        text += `  ${song.title}${artist}\n`;
      }
    }
    return text + '\n';
  }

  private buildSongListEmailBody(params: {
    grouped: ReturnType<PortalService['groupSongsForEmail']>;
    notes: string | null;
    customerName: string;
    bookingTitle: string;
    bookingId: string;
  }): string {
    const { grouped, notes, customerName, bookingTitle, bookingId } = params;
    const adminUrl = `${process.env.APP_BASE_URL}/admin/bookings/${bookingId}`;
    let body = `${customerName} has submitted their song requests for ${bookingTitle}.\n\n`;
    body += this.buildKeyMomentsText(grouped.bySection);
    body += this.buildGeneralRequestsText(grouped.byGenre);
    if (notes) body += `NOTES\n${notes}\n\n`;
    body += `View booking: ${adminUrl}`;
    return body;
  }

  private async sendSigningNotification(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    booking: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    publicProfile: any,
    signedAt: Date,
  ) {
    if (!publicProfile.email) return;

    const depositInvoice = booking.depositReceivedAt
      ? null
      : await this.repo.findDepositInvoice(booking.id, booking.userId);

    const bookingTitle = bookingDisplayTitle(booking);
    const body = this.buildSigningNotificationBody({
      bookingId: booking.id,
      bookingTitle,
      bookingDate: booking.date.toISOString().split('T')[0],
      customerName: booking.customer.name,
      venueName: booking.venue?.name ?? null,
      signedAt,
      depositReceivedAt: booking.depositReceivedAt ?? null,
      depositInvoice: depositInvoice ?? null,
    });

    await this.mail.send({
      to: publicProfile.email,
      subject: `${booking.customer.name} has signed your contract for ${bookingTitle}`,
      body: body.replace(/\n/g, '<br>'),
    });
  }

  private buildSigningNotificationBody(params: {
    bookingId: string;
    bookingTitle: string;
    bookingDate: string;
    customerName: string;
    venueName: string | null;
    signedAt: Date;
    depositReceivedAt: Date | null;
    depositInvoice: { dueDate: Date | null } | null;
  }): string {
    const { bookingId, bookingTitle, bookingDate, customerName, venueName, signedAt, depositReceivedAt, depositInvoice } = params;
    const adminUrl = `${process.env.APP_BASE_URL}/admin/bookings/${bookingId}`;
    const venueLine = venueName ? `\nVenue: ${venueName}` : '';

    let depositSection = '';
    if (depositReceivedAt) {
      depositSection = `\n\nThe deposit has also been received. Mark this booking as Confirmed:\n${adminUrl}`;
    } else if (depositInvoice) {
      const dueLine = depositInvoice.dueDate
        ? `Awaiting deposit — due ${depositInvoice.dueDate.toISOString().split('T')[0]}.`
        : 'Awaiting deposit.';
      depositSection = `\n\n${dueLine}`;
    }

    return `${customerName} has signed the contract for ${bookingTitle}.\n\nBooking date: ${bookingDate}${venueLine}\nSigned at: ${signedAt.toISOString()}\n\nView booking: ${adminUrl}${depositSection}`;
  }

  private extractIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
    }
    return req.socket?.remoteAddress ?? 'unknown';
  }
}
