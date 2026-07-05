import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PortalRepository } from './portal.repository';
import { PublicProfileRepository } from '../user-profile/public-profile.repository';
import { SongsRepository } from '../songs/songs.repository';
import { ContractRepository } from '../bookings/contract.repository';
import { MusicFormConfigRepository } from '../bookings/music-form-config.repository';
import { InvoicesRepository } from '../invoices/invoices.repository';
import { MailService } from '../mail/mail.service';
import { DocumentsService } from '../documents/documents.service';
import { StorageService } from '../storage/storage.service';
import { ChecklistEvaluatorService } from '../checklist/checklist-evaluator.service';
import {
  resolveContractVisibility,
  resolveMusicFormVisibility,
  resolveDocumentVisibility,
  type ContractStatus,
} from './portal-visibility';
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

/**
 * Whether a stored Document should appear on the client portal — the boolean projection of the
 * shared per-document authority (`resolveDocumentVisibility`, #580), so the portal filter and the
 * admin per-row indicator can never disagree (ADR-0054). UPLOADs are never client-visible;
 * CONTRACT is limited to the active contract (superseded copies drop off); INVOICE is gated on
 * delivery status; a cancelled booking hides the contract concern entirely (#579).
 */
export function isPortalVisibleDocument(
  doc: { type: string; contractId?: string | null; invoice?: { status: string } | null },
  activeContractId: string | null,
  bookingCancelled = false,
): boolean {
  return resolveDocumentVisibility(doc, activeContractId, bookingCancelled).visible;
}

// Access-controlled portal download routes (ADR-0059, #655). Emitted into the
// portal payload and consumed as bare <a href> values, so they carry the full
// path including the global `api` prefix and rely on the frontend's /api rewrite
// (vercel.json) / vite dev proxy to reach the API. The portalToken in the path
// is the auth, so a top-level navigation is sufficient and the endpoint 302s.
function portalDocumentRoute(token: string, documentId: string): string {
  return `/api/booking/${token}/documents/${documentId}`;
}

function portalSignedContractRoute(token: string): string {
  return `/api/booking/${token}/signed-contract`;
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

function buildBookingSummary(
  booking: {
    id: string;
    date: Date;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fee: any;
    title: string | null;
    status: string;
    customer: { name: string; greetingName: string | null };
    venue: { name: string } | null;
    sets: Array<{
      order: number;
      label: string | null;
      startTime: string | null;
      duration: number;
      packageId: string | null;
    }>;
    packages: Array<{
      id: string;
      order: number;
      label: string;
      icon: string;
    }>;
  },
  activeContract: { status: string; signedAt: Date | null } | null,
) {
  return {
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
      id: bpf.id,
      label: bpf.label,
      icon: bpf.icon,
      order: bpf.order,
    })),
    contractSignedAt:
      activeContract?.status === 'SIGNED' ? activeContract.signedAt?.toISOString() ?? null : null,
  };
}

@Injectable()
export class PortalService {
  constructor(
    private repo: PortalRepository,
    private publicProfileRepo: PublicProfileRepository,
    private songsRepo: SongsRepository,
    private invoicesRepo: InvoicesRepository,
    private mail: MailService,
    private documents: DocumentsService,
    private storage: StorageService,
    private evaluator: ChecklistEvaluatorService,
    private contractRepo: ContractRepository,
    private musicFormRepo: MusicFormConfigRepository,
  ) {}

  async getBookingData(token: string) {
    const booking = await this.repo.findBookingByToken(token);
    if (!booking) throw new NotFoundException('Booking not found');

    const publicProfile = await this.publicProfileRepo.findByUserId(booking.userId);
    if (!publicProfile) throw new NotFoundException('Booking not found');

    const sentDepositInvoice = booking.invoices[0] ?? null;
    const activeContract = booking.contracts?.[0] ?? null;
    // Route the portal's own contract visibility through the shared authority (ADR-0054) — the
    // signing CTA / signed-download are shown only when the authority says the contract is visible
    // (SENT/SIGNED). `contractStatus` still carries the concrete status the renderer needs.
    // Cancelling a booking hides the whole contract concern (#579, outermost gate).
    const bookingCancelled = booking.status === 'CANCELLED';
    const contractVerdict = resolveContractVisibility(
      (activeContract?.status ?? null) as ContractStatus | null,
      bookingCancelled,
    );
    const contractStatus =
      contractVerdict?.visible && activeContract ? (activeContract.status as 'SENT' | 'SIGNED') : null;

    const activeContractId = activeContract?.id ?? null;
    // On a cancelled booking the contract concern is hidden entirely (#579): passing
    // `bookingCancelled` drops the CONTRACT document rows, which also nulls `signedContractUrl`
    // below — so the signed-contract download disappears alongside the CTA.
    const portalDocs = booking.documents.filter((doc) =>
      isPortalVisibleDocument(doc, activeContractId, bookingCancelled),
    );
    const signedContractDoc = portalDocs.find((d) => d.type === 'CONTRACT') ?? null;
    const documents = portalDocs.map((doc) => ({
      id: doc.id,
      type: doc.type as 'CONTRACT' | 'INVOICE' | 'SONG_LIST',
      label: labelDocument(doc),
      // Access-controlled app route, not a public R2 URL (ADR-0059, #655). The
      // portalToken is in the path, so a plain <a href> navigation carries all the
      // auth needed; the endpoint 302s to storage after re-checking visibility.
      // The `/api` prefix is deliberate — the browser hits the frontend origin,
      // whose vercel.json rewrite (and the vite dev proxy) forwards /api/* to the API.
      url: portalDocumentRoute(token, doc.id),
      createdAt: doc.createdAt.toISOString(),
    }));

    const signedContractUrl = signedContractDoc
      ? portalSignedContractRoute(token)
      : null;

    return {
      booking: buildBookingSummary(booking, activeContract),
      publicProfile: buildPortalPublicProfile(publicProfile),
      signedContractUrl,
      documents,
      hasMusicForm:
        resolveMusicFormVisibility(
          !!booking.musicFormConfig,
          booking.musicFormConfig?.publishedAt != null,
        )?.visible ?? false,
      hasMusicFormResponse: !!booking.musicFormResponse,
      contractStatus,
      depositInvoiceDueDate: sentDepositInvoice?.dueDate?.toISOString() ?? null,
    };
  }

  // Resolve a portal document to its current storage URL (ADR-0059, #655). Access
  // is gated exactly as the portal payload is: the doc must belong to this token's
  // booking AND pass the shared visibility authority — so a doc the portal would
  // hide (e.g. an ISSUED-but-unsent invoice, or a cancelled booking's contract) is
  // never served. Still the public storage URL; the presigned-GET cutover is #656.
  async resolvePortalDocumentUrl(token: string, documentId: string): Promise<string> {
    const booking = await this.repo.findBookingByToken(token);
    if (!booking) throw new NotFoundException('Document not found');

    const activeContractId = booking.contracts?.[0]?.id ?? null;
    const bookingCancelled = booking.status === 'CANCELLED';
    const doc = booking.documents.find((d) => d.id === documentId);
    if (!doc || !isPortalVisibleDocument(doc, activeContractId, bookingCancelled)) {
      throw new NotFoundException('Document not found');
    }
    return this.storage.getPublicUrl(doc.storageKey);
  }

  // Variant of the above that resolves the booking's signed contract without the
  // caller needing its document id (feeds `signedContractUrl`). Mirrors the
  // `portalDocs.find(d => d.type === 'CONTRACT')` resolution in getBookingData.
  async resolvePortalSignedContractUrl(token: string): Promise<string> {
    const booking = await this.repo.findBookingByToken(token);
    if (!booking) throw new NotFoundException('Signed contract not found');

    const activeContractId = booking.contracts?.[0]?.id ?? null;
    const bookingCancelled = booking.status === 'CANCELLED';
    const doc = booking.documents.find(
      (d) => d.type === 'CONTRACT' && isPortalVisibleDocument(d, activeContractId, bookingCancelled),
    );
    if (!doc) throw new NotFoundException('Signed contract not found');
    return this.storage.getPublicUrl(doc.storageKey);
  }

  async getContractContent(token: string) {
    const booking = await this.repo.findBookingByToken(token);
    if (!booking) throw new NotFoundException('Booking not found');

    // The contract concern is fully hidden on a cancelled booking (#579): the token stays valid, so
    // guard the content endpoint itself — not just the CTA — against a stale tab or direct request.
    if (booking.status === 'CANCELLED') throw new NotFoundException('Contract not found');

    const contract = booking.contracts?.[0] ?? null;
    if (contract?.status === 'SIGNED') throw new BadRequestException('already_signed');
    if (!contract || contract.status !== 'SENT') throw new NotFoundException('Contract not found');

    return { content: contract.content, title: bookingDisplayTitle(booking) };
  }

  async signContract(token: string, signatureBase64: string, req: Request) {
    const booking = await this.repo.findBookingByToken(token);
    if (!booking) throw new NotFoundException('Booking not found');

    // Closing the real leak: cancelling a booking does not void its contract and the portal token
    // stays valid, so a stale tab or direct POST could otherwise sign a cancelled gig (#579).
    if (booking.status === 'CANCELLED') throw new NotFoundException('Contract not found');

    const contract = booking.contracts?.[0] ?? null;
    this.validateContractForSigning(contract);

    const [publicProfile, context] = await Promise.all([
      this.publicProfileRepo.findByUserId(booking.userId),
      this.mail.buildContext(booking.userId, booking.id),
    ]);
    if (!publicProfile) throw new NotFoundException('Booking not found');

    const signedAt = new Date();
    const ip = req.ip ?? 'unknown';

    await this.documents.generateAndStoreSignedContractPdf(
      booking.userId,
      booking.id,
      contract!.id,
      contract!.content,
      context,
      resolveDisplayName(publicProfile),
      booking.customer.name,
      signatureBase64,
      signedAt,
      ip,
    );

    await this.contractRepo.markContractSigned(contract!.id, ip, signatureBase64);
    await this.evaluator.evaluate(booking.id).catch(() => {});

    await this.sendSigningNotification(booking, publicProfile, signedAt);
  }

  // #533: single gate for client access to the music form — reads the shared authority so the
  // portal endpoints, the `hasMusicForm` link, and the admin indicator can never disagree.
  private isMusicFormClientVisible(
    config: { publishedAt?: Date | null } | null | undefined,
  ): boolean {
    return resolveMusicFormVisibility(!!config, config?.publishedAt != null)?.visible ?? false;
  }

  async getMusicFormData(token: string) {
    const data = await this.repo.findMusicFormDataByToken(token);
    if (!data) throw new NotFoundException('Booking not found');
    // #533: a draft (unpublished) form is inaccessible to the client — indistinguishable from
    // "not found" so a token holder cannot fetch it directly. Gate via the shared authority.
    if (!this.isMusicFormClientVisible(data.musicFormConfig)) {
      throw new NotFoundException('Music form not found');
    }

    const config = data.musicFormConfig as { keyMoments: unknown; enabledGenres: string[] };
    const [songs, allSongs] = await Promise.all([
      this.songsRepo.findByGenres(data.userId, config.enabledGenres),
      this.songsRepo.findAll(data.userId, undefined, true),
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
    // #533: submissions are gated on publication too (not just the read) — a token holder cannot
    // POST to a draft form.
    if (!this.isMusicFormClientVisible(data.musicFormConfig)) {
      throw new NotFoundException('Music form not found');
    }

    await this.assertSongIdsOwned(data.userId, dto);

    const submittedAt = new Date();
    await this.musicFormRepo.upsertMusicFormResponse(
      data.id,
      data.userId,
      dto.selectedSongIds,
      dto.specialRequests,
      dto.notes,
    );

    await this.evaluator.evaluate(data.id).catch(() => {});

    this.generateSongListAndNotify(data, dto, submittedAt).catch(() => {});
  }

  private async assertSongIdsOwned(userId: string, dto: SubmitMusicFormDto) {
    const allIds = [
      ...dto.selectedSongIds,
      ...dto.specialRequests.map((r) => r.songId).filter((id): id is string => !!id),
    ];
    if (!allIds.length) return;
    const owned = await this.songsRepo.findByIds(userId, allIds);
    const ownedIds = new Set(owned.map((s) => s.id));
    const unknown = allIds.filter((id) => !ownedIds.has(id));
    if (unknown.length > 0) throw new BadRequestException('Unknown song IDs submitted');
  }

  private async generateSongListAndNotify(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bookingData: { id: string; userId: string; musicFormConfig: any },
    dto: SubmitMusicFormDto,
    submittedAt: Date,
  ) {
    const [booking, publicProfile, songs] = await Promise.all([
      this.musicFormRepo.findBookingForSongList(bookingData.id),
      this.publicProfileRepo.findByUserId(bookingData.userId),
      this.songsRepo.findByIds(bookingData.userId, [
        ...dto.selectedSongIds,
        ...dto.specialRequests.map((r) => r.songId).filter((id): id is string => !!id),
      ]),
    ]);

    if (!booking || !publicProfile) return;

    const songMap = new Map(songs.map((s) => [s.id, s]));
    const config = bookingData.musicFormConfig as {
      keyMoments: Array<{ label: string; section: string }>;
      enabledGenres: string[];
    };

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

    const brandColour = (publicProfile.clientPortalConfig as { brandColour?: string } | null)?.brandColour ?? '#1a1a1a';

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
        logoUrl: publicProfile.logoUrl ?? null,
        businessName: publicProfile.businessName,
        email: publicProfile.email ?? null,
        brandColour,
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
    specialRequests: Array<{
      key: string;
      section: string;
      song?: { title: string; artist?: string | null };
      freeText?: string;
    }>,
    selectedSongs: Array<{ title: string; artist?: string | null; genre: string }>,
  ) {
    return {
      bySection: groupBy(specialRequests, (r) => r.section),
      byGenre: groupBy(selectedSongs, (s) => s.genre),
    };
  }

  private buildKeyMomentsText(
    bySection: Map<
      string,
      Array<{ key: string; song?: { title: string; artist?: string | null }; freeText?: string }>
    >,
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
      : await this.invoicesRepo.findDepositInvoice(booking.id, booking.userId);

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
    const {
      bookingId,
      bookingTitle,
      bookingDate,
      customerName,
      venueName,
      signedAt,
      depositReceivedAt,
      depositInvoice,
    } = params;
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

  private validateContractForSigning(contract: { status: string } | null) {
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status === 'SIGNED') throw new BadRequestException('Contract already signed');
    if (contract.status !== 'SENT')
      throw new BadRequestException('Contract must be in SENT status to sign');
  }

}
