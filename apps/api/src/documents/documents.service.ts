import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';
import { createRequire } from 'module';
import type { Document } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { DocumentsRepository } from './documents.repository';
import { buildInvoiceDefinition, type InvoicePdfData } from './invoice-document';
import { buildSongListDefinition, type SongListPdfData } from './song-list-document';
import { renderTiptapToPdfmake } from '../mail/tiptap-pdfmake';
import type { EmailContext } from '../mail/mail.service';
import { substituteTiptapVariables } from '../mail/tiptap-portal';

// Resolve pdfmake relative to this file so font paths work correctly
// regardless of where the process was started from.
const require_ = createRequire(__filename);
const pdfmake = require_('pdfmake');

const fontDir = join(dirname(require_.resolve('pdfmake/package.json')), 'build/fonts/Roboto');
const customFontsDir = join(dirname(__filename), 'fonts');

pdfmake.addFonts({
  Roboto: {
    normal: join(fontDir, 'Roboto-Regular.ttf'),
    bold: join(fontDir, 'Roboto-Medium.ttf'),
    italics: join(fontDir, 'Roboto-Italic.ttf'),
    bolditalics: join(fontDir, 'Roboto-MediumItalic.ttf'),
  },
  Caveat: {
    normal: join(customFontsDir, 'Caveat-Regular.ttf'),
  },
  Commissioner: {
    normal: join(customFontsDir, 'Commissioner-Regular.ttf'),
    bold: join(customFontsDir, 'Commissioner-Medium.ttf'),
    italics: join(customFontsDir, 'Commissioner-Italic.ttf'),
    bolditalics: join(customFontsDir, 'Commissioner-MediumItalic.ttf'),
  },
});
pdfmake.setLocalAccessPolicy(() => true);
pdfmake.setUrlAccessPolicy(() => true);

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status} ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') ?? 'image/png';
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

export type DocumentWithUrl = Document & { url: string; contract?: { status: string } | null };

// Minimal shape needed to build PDF data from an already-fetched invoice.
// Accepts Prisma Decimal for amount (hence the any — Number() handles it).
type PreloadedInvoice = {
  invoiceNumber: string | null;
  issueDate: Date | null;
  dueDate: Date | null;
  isDeposit: boolean;
  bookingId: string | null;
  billToContact: { name: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lineItems: Array<{ description: string; amount: any; order: number }>;
};

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private repo: DocumentsRepository,
    private storage: StorageService,
  ) {}

  private formatAddress(profile: { addressLine1: string | null; addressLine2: string | null; city: string | null; postcode: string | null } | null): string | null {
    if (!profile) return null;
    return [profile.addressLine1, profile.addressLine2, profile.city, profile.postcode].filter(Boolean).join('\n') || null;
  }

  // ─── PDF: private ──────────────────────────────────────────────────────────

  private async buildInvoicePdfData(
    userId: string,
    invoiceId: string,
    preloaded?: PreloadedInvoice,
  ): Promise<InvoicePdfData> {
    const invoice = preloaded ?? await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
      include: {
        lineItems: { orderBy: { order: 'asc' } },
        billToContact: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (!invoice.invoiceNumber) throw new NotFoundException('Invoice has not been assigned a number yet');

    const [publicProfile, userProfile] = await Promise.all([
      this.prisma.publicProfile.findUnique({ where: { userId } }),
      this.prisma.userProfile.findUnique({ where: { userId } }),
    ]);

    if (!publicProfile) throw new NotFoundException('Public profile not found');

    let depositTotal: string | null = null;
    if (!invoice.isDeposit && invoice.bookingId) {
      const depositInvoice = await this.prisma.invoice.findFirst({
        where: { bookingId: invoice.bookingId, userId, isDeposit: true },
        include: { lineItems: true },
      });
      if (depositInvoice) {
        const total = depositInvoice.lineItems.reduce(
          (sum, item) => sum + Number(item.amount),
          0,
        );
        depositTotal = total.toFixed(2);
      }
    }

    const brandColour = (publicProfile.clientPortalConfig as { brandColour?: string } | null)?.brandColour ?? '#1a1a1a';

    return {
      businessName: publicProfile.businessName,
      musicianName: publicProfile.displayName ?? publicProfile.businessName,
      email: publicProfile.email ?? '',
      address: this.formatAddress(userProfile),
      bankDetails: userProfile?.bankDetails ?? null,
      vatNumber: userProfile?.vatNumber ?? null,
      vatRate: userProfile?.vatNumber ? (userProfile.vatRate ?? 20) : null,
      logoUrl: publicProfile.logoUrl ?? null,
      brandColour,

      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate ? invoice.issueDate.toISOString().split('T')[0] : '',
      dueDate: invoice.dueDate ? invoice.dueDate.toISOString().split('T')[0] : null,
      isDeposit: invoice.isDeposit,

      clientName: invoice.billToContact.name,

      lineItems: invoice.lineItems.map((item) => ({
        description: item.description,
        amount: Number(item.amount).toFixed(2),
      })),

      depositTotal,
    };
  }

  private async generatePdfBuffer(data: InvoicePdfData): Promise<Buffer> {
    // pdfmake's Node.js image loader only handles file paths and data URLs,
    // not remote HTTPS URLs. Fetch the logo and convert to a data URL first.
    if (data.logoUrl) {
      data.logoUrl = await fetchAsDataUrl(data.logoUrl);
    }
    const docDef = buildInvoiceDefinition(data);
    return pdfmake.createPdf(docDef).getBuffer() as Promise<Buffer>;
  }

  // ─── PDF: public ───────────────────────────────────────────────────────────

  async generateAndStoreInvoicePdf(
    userId: string,
    bookingId: string,
    invoiceId: string,
    preloaded?: PreloadedInvoice,
  ): Promise<{ buffer: Buffer }> {
    const data = await this.buildInvoicePdfData(userId, invoiceId, preloaded);
    const buffer = await this.generatePdfBuffer(data);
    const key = `invoices/${userId}/${bookingId}/${invoiceId}.pdf`;
    await this.storage.putObject(key, buffer, 'application/pdf');
    await this.repo.create(userId, bookingId, 'INVOICE', key, invoiceId);
    return { buffer };
  }

  async generatePreviewPdf(userId: string, invoiceId: string): Promise<Buffer> {
    const data = await this.buildInvoicePdfData(userId, invoiceId);
    return this.generatePdfBuffer(data);
  }

  // ─── Signed contract PDF ───────────────────────────────────────────────────

  async generateAndStoreSignedContractPdf(
    userId: string,
    bookingId: string,
    contractId: string,
    tiptapContent: unknown,
    context: EmailContext,
    musicianName: string,
    customerName: string,
    signatureBase64: string,
    signedAt: Date,
    signedFromIp: string,
  ): Promise<DocumentWithUrl> {
    const substituted = substituteTiptapVariables(tiptapContent, context);
    const contractContent = renderTiptapToPdfmake(substituted);

    const signatureDataUrl = signatureBase64.startsWith('data:')
      ? signatureBase64
      : `data:image/png;base64,${signatureBase64}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docDef: any = {
      pageSize: 'A4',
      pageMargins: [54, 48, 54, 60],
      defaultStyle: { font: 'Roboto', fontSize: 10, color: '#1a1a1a', lineHeight: 1.4 },
      content: [
        { text: musicianName, style: 'header', margin: [0, 0, 0, 4] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 487, y2: 0, lineWidth: 0.5, lineColor: '#e5e5e5' }], margin: [0, 0, 0, 24] },
        ...contractContent,
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 487, y2: 0, lineWidth: 0.5, lineColor: '#e5e5e5' }], margin: [0, 16, 0, 16] },
        { text: 'Electronic Signature', bold: true, fontSize: 11, margin: [0, 0, 0, 8] },
        { text: `Signed by: ${customerName}`, margin: [0, 0, 0, 2] },
        { text: `Date: ${signedAt.toISOString().split('T')[0]}`, margin: [0, 0, 0, 2] },
        { text: `IP address: ${signedFromIp}`, color: '#666666', margin: [0, 0, 0, 12] },
        { image: signatureDataUrl, width: 200, margin: [0, 0, 0, 4] },
      ],
      styles: {
        header: { fontSize: 14, bold: true },
      },
    };

    const buffer: Buffer = await (pdfmake.createPdf(docDef).getBuffer() as Promise<Buffer>);
    return this.storeSignedContractPdf(userId, bookingId, contractId, buffer);
  }

  // ─── Storage: public ───────────────────────────────────────────────────────

  async storeContractPdf(
    userId: string,
    bookingId: string,
    buffer: Buffer,
  ): Promise<DocumentWithUrl> {
    const key = `contracts/${userId}/${bookingId}.pdf`;
    await this.storage.putObject(key, buffer, 'application/pdf');
    const doc = await this.repo.create(userId, bookingId, 'CONTRACT', key);
    return { ...doc, url: this.storage.getPublicUrl(key) };
  }

  async storeSignedContractPdf(
    userId: string,
    bookingId: string,
    contractId: string,
    buffer: Buffer,
  ): Promise<DocumentWithUrl> {
    const key = `contracts/${userId}/${bookingId}/${contractId}-signed.pdf`;
    await this.storage.putObject(key, buffer, 'application/pdf');
    const doc = await this.repo.create(userId, bookingId, 'CONTRACT', key, undefined, contractId);
    return { ...doc, url: this.storage.getPublicUrl(key) };
  }

  async findByBooking(userId: string, bookingId: string): Promise<DocumentWithUrl[]> {
    const docs = await this.repo.findByBooking(userId, bookingId);
    return docs.map((d) => ({ ...d, url: this.storage.getPublicUrl(d.storageKey) }));
  }

  async findByInvoice(userId: string, invoiceId: string): Promise<DocumentWithUrl | null> {
    const doc = await this.repo.findByInvoice(userId, invoiceId);
    if (!doc) return null;
    return { ...doc, url: this.storage.getPublicUrl(doc.storageKey) };
  }

  async findContractForBooking(userId: string, bookingId: string): Promise<DocumentWithUrl | null> {
    const doc = await this.repo.findContractForBooking(userId, bookingId);
    if (!doc) return null;
    return { ...doc, url: this.storage.getPublicUrl(doc.storageKey) };
  }

  async uploadDocument(
    userId: string,
    bookingId: string,
    buffer: Buffer,
    name: string,
  ): Promise<DocumentWithUrl> {
    const documentId = randomUUID();
    const key = `uploads/${userId}/${bookingId}/${documentId}.pdf`;
    await this.storage.putObject(key, buffer, 'application/pdf');
    const doc = await this.repo.create(userId, bookingId, 'UPLOAD', key, undefined, undefined, name);
    return { ...doc, url: this.storage.getPublicUrl(key) };
  }

  async deleteDocument(userId: string, id: string): Promise<void> {
    const doc = await this.repo.findById(id, userId);
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.type !== 'UPLOAD') throw new ForbiddenException('System-generated documents cannot be deleted');
    await this.storage.deleteObject(doc.storageKey);
    await this.repo.delete(id);
  }

  async generateAndStoreSongListPdf(
    userId: string,
    bookingId: string,
    data: SongListPdfData,
  ): Promise<{ buffer: Buffer; url: string }> {
    const docDef = buildSongListDefinition(data);
    const buffer: Buffer = await (pdfmake.createPdf(docDef).getBuffer() as Promise<Buffer>);

    const key = `song-lists/${userId}/${bookingId}.pdf`;
    await this.storage.putObject(key, buffer, 'application/pdf');

    // Replace any existing SONG_LIST document
    const existing = await this.repo.findSongListForBooking(userId, bookingId);
    if (existing) await this.repo.delete(existing.id);

    await this.repo.create(userId, bookingId, 'SONG_LIST', key);
    return { buffer, url: this.storage.getPublicUrl(key) };
  }
}
