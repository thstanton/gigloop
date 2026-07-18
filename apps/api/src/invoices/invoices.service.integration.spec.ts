/**
 * Integration tests for InvoicesService — real pdfmake, mocked DB/storage/email.
 * Verifies the full PDF generation path so font load failures are caught here, not in prod.
 */
import { InvoicesService } from './invoices.service';
import { InvoicesRepository } from './invoices.repository';
import { InvoiceLifecycleService } from './invoice-lifecycle.service';
import { DocumentsService } from '../documents/documents.service';
import { StorageService } from '../storage/storage.service';
import { DocumentsRepository } from '../documents/documents.repository';
import { PrismaService } from '../prisma/prisma.service';

const userId = 'u1';
const bookingId = 'b1';
const invoiceId = 'i1';

const draftInvoice = {
  id: invoiceId,
  bookingId,
  userId,
  status: 'DRAFT',
  invoiceNumber: null,
  isDeposit: false,
  issueDate: null,
  dueDate: null,
  billToContact: { name: 'Test Client' },
  lineItems: [{ description: 'Wedding performance', amount: 1500, order: 0 }],
};

const numberedInvoice = {
  ...draftInvoice,
  status: 'DRAFT',
  invoiceNumber: 'INV-2026-001',
  issueDate: new Date('2026-06-01'),
  dueDate: new Date('2026-06-15'),
};

const issuedInvoice = { ...numberedInvoice, status: 'ISSUED' };

function makeSharedSetup() {
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
        defaultPaymentTermsDays: 14,
      }),
    },
    invoice: { findFirst: jest.fn().mockResolvedValue(null) },
  } as unknown as PrismaService;

  const putObjectMock = jest.fn().mockResolvedValue(undefined);
  const mockStorage = {
    putDocument: putObjectMock,
    getPublicUrl: jest.fn().mockReturnValue('https://example.com/doc.pdf'),
  } as unknown as StorageService;

  const mockDocsRepo = {
    findByInvoice: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'd1' }),
  } as unknown as DocumentsRepository;

  const documents = new DocumentsService(mockPrisma, mockDocsRepo, mockStorage);
  return { putObjectMock, mockStorage, documents };
}

// ─── send integration — DRAFT guard ───────────────────────────────────────────
// DRAFT invoices must be issued first; sending a DRAFT is now rejected.

describe('InvoicesService.send (integration) — DRAFT guard', () => {
  let service: InvoicesService;

  beforeEach(() => {
    const shared = makeSharedSetup();

    const mockComms = { sendEmail: jest.fn() } as unknown as import('../communications/communications.service').CommunicationsService;

    const mockInvoicesRepo = {
      findOne: jest.fn().mockResolvedValue(draftInvoice),
      markSentById: jest.fn(),
      markPaidBase: jest.fn(),
      voidInvoice: jest.fn(),
      getUserPaymentTerms: jest.fn().mockResolvedValue(14),
    };

    const lifecycle = new InvoiceLifecycleService(
      mockInvoicesRepo as unknown as InvoicesRepository,
      shared.documents,
      mockComms,
    );

    const mockEvaluator = { evaluate: jest.fn().mockResolvedValue(undefined) } as unknown as import('../checklist/checklist-evaluator.service').ChecklistEvaluatorService;
    const mockChecklistRepo = { resetItemByKey: jest.fn() } as unknown as import('../checklist/checklist.repository').ChecklistRepository;

    service = new InvoicesService(
      mockInvoicesRepo as unknown as InvoicesRepository,
      lifecycle,
      shared.documents,
      mockEvaluator,
      mockChecklistRepo,
      { assertOwned: jest.fn().mockResolvedValue(undefined) } as unknown as import('../contacts/contacts.service').ContactsService,
    );
  });

  it('rejects with BadRequestException — DRAFT must be issued before sending', async () => {
    await expect(
      service.send(userId, bookingId, invoiceId, {
        to: 'client@example.com',
        contactId: 'c1',
        subject: 'Invoice',
        body: '<p>Hi</p>',
      }),
    ).rejects.toThrow('Only issued invoices can be sent');
  });
});

// ─── send integration — ISSUED path ───────────────────────────────────────────
// ISSUED invoices must serve the already-stored PDF rather than re-generating.

describe('InvoicesService.send (integration) — ISSUED invoice', () => {
  let service: InvoicesService;
  let sendEmailMock: jest.Mock;
  let putObjectMock: jest.Mock;

  beforeEach(() => {
    const shared = makeSharedSetup();
    putObjectMock = shared.putObjectMock;

    sendEmailMock = jest.fn().mockResolvedValue(undefined);
    const mockComms = { sendEmail: sendEmailMock } as unknown as import('../communications/communications.service').CommunicationsService;

    // Stub getStoredInvoicePdfBuffer directly — the ISSUED send path calls this instead
    // of generating a new PDF, so we return a buffer without touching R2.
    const storedPdfBuffer = Buffer.from('%PDF-stored');
    jest.spyOn(shared.documents, 'getStoredInvoicePdfBuffer').mockResolvedValue({ buffer: storedPdfBuffer, documentId: 'doc-stored' });

    const mockInvoicesRepo = {
      findOne: jest.fn().mockResolvedValue(issuedInvoice),
      markSentById: jest.fn().mockResolvedValue({ ...issuedInvoice, status: 'SENT' }),
      markPaidBase: jest.fn(),
      voidInvoice: jest.fn(),
      getUserPaymentTerms: jest.fn().mockResolvedValue(14),
    };

    const lifecycle = new InvoiceLifecycleService(
      mockInvoicesRepo as unknown as InvoicesRepository,
      shared.documents,
      mockComms,
    );

    const mockEvaluator = { evaluate: jest.fn().mockResolvedValue(undefined) } as unknown as import('../checklist/checklist-evaluator.service').ChecklistEvaluatorService;
    const mockChecklistRepo = { resetItemByKey: jest.fn() } as unknown as import('../checklist/checklist.repository').ChecklistRepository;

    service = new InvoicesService(
      mockInvoicesRepo as unknown as InvoicesRepository,
      lifecycle,
      shared.documents,
      mockEvaluator,
      mockChecklistRepo,
      { assertOwned: jest.fn().mockResolvedValue(undefined) } as unknown as import('../contacts/contacts.service').ContactsService,
    );
  });

  it('sends the stored PDF without regenerating (putObject not called)', async () => {
    await service.send(userId, bookingId, invoiceId, {
      // issueDate omitted — ISSUED invoices already have dates set at issue time
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
    // Stored PDF is served — no new PDF was generated
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it('passes the stored Document id to sendEmail for audit trail (tenant-scoped: documentId belongs to same userId)', async () => {
    // The communication record is created with documentId so the comms log can link to the PDF.
    // Document.userId = invoice sender's userId — cross-tenant access is structurally impossible
    // because Communication.userId + Document.userId are both scoped to the same user at creation.
    await service.send(userId, bookingId, invoiceId, {
      to: 'client@example.com',
      contactId: 'c1',
      subject: 'Invoice INV-2026-001',
      body: '<p>Please find attached</p>',
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const [options] = sendEmailMock.mock.calls[0];
    expect(options.documentId).toBe('doc-stored');
    expect(options.userId).toBe(userId);
  });
});

// ─── markSent integration — ISSUED path ───────────────────────────────────────
// For ISSUED invoices, mark-sent simply transitions to SENT — no PDF generation needed
// because the PDF was already stored at issue time.

describe('InvoicesService.markSent (integration) — ISSUED invoice', () => {
  let service: InvoicesService;
  let putObjectMock: jest.Mock;
  let markSentByIdMock: jest.Mock;

  beforeEach(() => {
    const shared = makeSharedSetup();
    putObjectMock = shared.putObjectMock;

    const mockComms = { sendEmail: jest.fn() } as unknown as import('../communications/communications.service').CommunicationsService;

    markSentByIdMock = jest.fn().mockResolvedValue({ ...issuedInvoice, status: 'SENT' });
    const mockInvoicesRepo = {
      findOne: jest.fn().mockResolvedValue(issuedInvoice),
      markSentById: markSentByIdMock,
      markPaidBase: jest.fn(),
      voidInvoice: jest.fn(),
      getUserPaymentTerms: jest.fn().mockResolvedValue(14),
    };

    const lifecycle = new InvoiceLifecycleService(
      mockInvoicesRepo as unknown as InvoicesRepository,
      shared.documents,
      mockComms,
    );

    const mockEvaluator = { evaluate: jest.fn().mockResolvedValue(undefined) } as unknown as import('../checklist/checklist-evaluator.service').ChecklistEvaluatorService;
    const mockChecklistRepo = { resetItemByKey: jest.fn() } as unknown as import('../checklist/checklist.repository').ChecklistRepository;

    service = new InvoicesService(
      mockInvoicesRepo as unknown as InvoicesRepository,
      lifecycle,
      shared.documents,
      mockEvaluator,
      mockChecklistRepo,
      { assertOwned: jest.fn().mockResolvedValue(undefined) } as unknown as import('../contacts/contacts.service').ContactsService,
    );
  });

  it('transitions ISSUED to SENT without generating a new PDF', async () => {
    // Dates omitted — ISSUED invoice already has dates set at issue time
    const result = await service.markSent(userId, bookingId, invoiceId, {});

    expect(result.status).toBe('SENT');
    // PDF was stored at issue time — mark-sent must not generate or store another
    expect(putObjectMock).not.toHaveBeenCalled();
    expect(markSentByIdMock).toHaveBeenCalledWith(invoiceId);
  });
});

// ─── issue integration ─────────────────────────────────────────────────────────

describe('InvoicesService.issue (integration)', () => {
  let service: InvoicesService;
  let putObjectMock: jest.Mock;

  beforeEach(() => {
    const shared = makeSharedSetup();
    putObjectMock = shared.putObjectMock;

    const mockComms = { sendEmail: jest.fn() } as unknown as import('../communications/communications.service').CommunicationsService;

    const mockInvoicesRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(draftInvoice)
        .mockResolvedValueOnce(issuedInvoice),
      assignAndMarkIssued: jest.fn().mockResolvedValue(numberedInvoice),
      markPaidBase: jest.fn(),
      voidInvoice: jest.fn(),
      getUserPaymentTerms: jest.fn().mockResolvedValue(14),
    };

    const lifecycle = new InvoiceLifecycleService(
      mockInvoicesRepo as unknown as InvoicesRepository,
      shared.documents,
      mockComms,
    );

    const mockEvaluator = { evaluate: jest.fn().mockResolvedValue(undefined) } as unknown as import('../checklist/checklist-evaluator.service').ChecklistEvaluatorService;
    const mockChecklistRepo = { resetItemByKey: jest.fn() } as unknown as import('../checklist/checklist.repository').ChecklistRepository;

    service = new InvoicesService(
      mockInvoicesRepo as unknown as InvoicesRepository,
      lifecycle,
      shared.documents,
      mockEvaluator,
      mockChecklistRepo,
      { assertOwned: jest.fn().mockResolvedValue(undefined) } as unknown as import('../contacts/contacts.service').ContactsService,
    );
  });

  it('generates a valid PDF and stores it to storage when issuing a draft invoice', async () => {
    await service.issue(userId, bookingId, invoiceId, {
      issueDate: '2026-06-01',
      dueDate: '2026-06-15',
    });

    expect(putObjectMock).toHaveBeenCalledTimes(1);
    const [key, buffer] = putObjectMock.mock.calls[0];
    expect(key).toContain(invoiceId);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });
});
