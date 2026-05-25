import { Injectable, NotFoundException } from '@nestjs/common';
import { join, dirname } from 'path';
import { createRequire } from 'module';
import { PrismaService } from '../prisma/prisma.service';
import { buildInvoiceDefinition, type InvoicePdfData } from './invoice-document';

// Resolve pdfmake relative to this file so the font paths work correctly
// regardless of where the process was started from.
const require_ = createRequire(__filename);
const pdfmake = require_('pdfmake');

const fontDir = join(dirname(require_.resolve('pdfmake/package.json')), 'build/fonts/Roboto');

pdfmake.addFonts({
  Roboto: {
    normal: join(fontDir, 'Roboto-Regular.ttf'),
    bold: join(fontDir, 'Roboto-Medium.ttf'),
    italics: join(fontDir, 'Roboto-Italic.ttf'),
    bolditalics: join(fontDir, 'Roboto-MediumItalic.ttf'),
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

// Minimal shape needed to build PDF data from an already-fetched invoice.
// Accepts Prisma Decimal for amount (hence the any — Number() handles it).
type PreloadedInvoice = {
  invoiceNumber: string | null;
  issueDate: Date | null;
  dueDate: Date | null;
  isDeposit: boolean;
  bookingId: string;
  billToContact: { name: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lineItems: Array<{ description: string; amount: any; order: number }>;
};

@Injectable()
export class PdfService {
  constructor(private prisma: PrismaService) {}

  async buildInvoicePdfData(
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
    if (!invoice.isDeposit) {
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

    return {
      businessName: publicProfile.businessName,
      musicianName: publicProfile.displayName ?? publicProfile.businessName,
      email: publicProfile.email ?? '',
      address: userProfile?.address ?? null,
      bankDetails: userProfile?.bankDetails ?? null,
      vatNumber: userProfile?.vatNumber ?? null,
      logoUrl: publicProfile.logoUrl ?? null,

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

  async generateFromData(data: InvoicePdfData): Promise<Buffer> {
    // pdfmake's Node.js image loader only handles file paths and data URLs,
    // not remote HTTPS URLs. Fetch the logo and convert to a data URL first.
    if (data.logoUrl) {
      data.logoUrl = await fetchAsDataUrl(data.logoUrl);
    }
    const docDef = buildInvoiceDefinition(data);
    return pdfmake.createPdf(docDef).getBuffer() as Promise<Buffer>;
  }

  async generateInvoicePdf(userId: string, invoiceId: string): Promise<Buffer> {
    const data = await this.buildInvoicePdfData(userId, invoiceId);
    return this.generateFromData(data);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  generateContractPdf(_bookingId: string): Promise<Buffer> {
    throw new Error('Contract PDF generation not yet implemented');
  }
}
