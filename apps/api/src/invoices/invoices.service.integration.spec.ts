/**
 * Integration tests for InvoicesService.send — real pdfmake, mocked DB/storage/email.
 * Verifies the full PDF generation path so font load failures are caught here, not in prod.
 */
import { InvoicesService } from './invoices.service';
import { InvoicesRepository } from './invoices.repository';
import { InvoiceLifecycleService } from './invoice-lifecycle.service';
import { DocumentsService } from '../documents/documents.service';
import { StorageService } from '../storage/storage.service';
import { DocumentsRepository } from '../documents/documents.repository';
import { PrismaService } from '../prisma/prisma.service';

// DocumentsService imports pdfmake and configures fonts at module load time.
// Importing it here is sufficient to exercise the real font path.

const userId = 'u1';
const bookingId = 'b1';
const invoiceId = 'i1';

const numberedInvoice = {
  id: invoiceId,
  bookingId,
  userId,
  status: 'DRAFT',
  invoiceNumber: 'INV-2026-001',
  isDeposit: false,
  issueDate: new Date('2026-06-01'),
  dueDate: new Date('2026-06-15'),
  billToContact: { name: 'Test Client' },
  lineItems: [{ description: 'Wedding performance', amount: 1500, order: 0 }],
};

describe('InvoicesService.send (integration)', () => {
  let service: InvoicesService;
  let sendEmailMock: jest.Mock;
  let putObjectMock: jest.Mock;

  beforeEach(() => {
    const mockPrisma = {
      publicProfile: {
        findUnique: jest.fn().mockResolvedValue({
          businessName: 'Test Musician',
          displayName: 'Test Musician',
          email: 'musician@example.com',
          logoUrl: null,
          clientPortalConfig: { brandColour: '#1a1a1a' },
        }),
      },
      userProfile: {
        findUnique: jest.fn().mockResolvedValue({
          addressLine1: null, addressLine2: null, city: null, postcode: null,
          bankDetails: null, vatNumber: null, vatRate: null,
        }),
      },
      invoice: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;

    putObjectMock = jest.fn().mockResolvedValue(undefined);
    const mockStorage = {
      putObject: putObjectMock,
      getPublicUrl: jest.fn().mockReturnValue('https://example.com/doc.pdf'),
    } as unknown as StorageService;

    const mockDocsRepo = {
      findByInvoice: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'd1' }),
    } as unknown as DocumentsRepository;

    const documents = new DocumentsService(mockPrisma, mockDocsRepo, mockStorage);

    sendEmailMock = jest.fn().mockResolvedValue(undefined);
    const mockComms = { sendEmail: sendEmailMock } as unknown as import('../communications/communications.service').CommunicationsService;

    const mockInvoicesRepo = {
      findOne: jest.fn().mockResolvedValue({ ...numberedInvoice, status: 'DRAFT', invoiceNumber: null }),
      assignInvoiceNumberOnly: jest.fn().mockResolvedValue(numberedInvoice),
      markSentById: jest.fn().mockResolvedValue({ ...numberedInvoice, status: 'SENT' }),
      markPaidBase: jest.fn(),
      voidInvoice: jest.fn(),
    };

    const lifecycle = new InvoiceLifecycleService(
      mockInvoicesRepo as unknown as InvoicesRepository,
      documents,
      mockComms,
    );

    const mockEvaluator = { evaluate: jest.fn().mockResolvedValue(undefined) } as unknown as import('../checklist/checklist-evaluator.service').ChecklistEvaluatorService;
    const mockChecklistRepo = { resetItemByKey: jest.fn() } as unknown as import('../checklist/checklist.repository').ChecklistRepository;

    service = new InvoicesService(
      mockInvoicesRepo as unknown as InvoicesRepository,
      lifecycle,
      documents,
      mockEvaluator,
      mockChecklistRepo,
    );
  });

  it('generates a valid PDF and passes a non-empty Buffer to sendEmail', async () => {
    await service.send(userId, bookingId, invoiceId, {
      issueDate: '2026-06-01',
      dueDate: '2026-06-15',
      to: 'client@example.com',
      contactId: 'c1',
      subject: 'Invoice INV-2026-001',
      body: '<p>Please find attached</p>',
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const [{ attachments }] = sendEmailMock.mock.calls[0];
    expect(attachments).toHaveLength(1);
    expect(attachments[0].filename).toBe('INV-2026-001.pdf');
    expect(Buffer.isBuffer(attachments[0].content)).toBe(true);
    expect(attachments[0].content.length).toBeGreaterThan(0);
    expect(attachments[0].content.slice(0, 4).toString()).toBe('%PDF');
  });
});
