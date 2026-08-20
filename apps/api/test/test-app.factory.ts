import { Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AuthModule } from '../src/auth/auth.module';
import { StorageService } from '../src/storage/storage.service';
import { MailService } from '../src/mail/mail.service';
import { DistanceMatrixClient } from '../src/contacts/distance-matrix.client';
import { DocumentsService } from '../src/documents/documents.service';
import { TestAuthGuard } from './test-auth.guard';

// Replaces AuthModule: provides TestAuthGuard as the global APP_GUARD.
@Global()
@Module({ providers: [{ provide: APP_GUARD, useClass: TestAuthGuard }] })
class TestAuthModule {}

export const mockStorageService = {
  // Assets (public bucket)
  getPresignedUploadUrl: jest.fn().mockResolvedValue('https://mock-storage.test/presigned'),
  getPublicUrl: jest.fn().mockReturnValue('https://mock-storage.test/file'),
  deleteAsset: jest.fn().mockResolvedValue(undefined),
  // Documents (private bucket) — ADR-0059 / #656
  putDocument: jest.fn().mockResolvedValue(undefined),
  deleteDocument: jest.fn().mockResolvedValue(undefined),
  getDocument: jest.fn().mockResolvedValue(Buffer.from('%PDF-mock')),
  getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://mock-storage.test/presigned-get'),
};

const mockEmailContext = {
  customerName: 'Test Customer',
  greetingName: 'Test',
  bookingDate: '2027-09-15',
  venueName: '',
  bookingFee: '',
  setsSchedule: '',
  musicianName: 'Test Band',
  musicianEmail: '',
  portalLink: 'https://test.example.com/booking/test-token',
  issueDate: '',
  invoiceTotal: '',
  invoiceDueDate: '',
};

const mockMailService = {
  send: jest.fn().mockResolvedValue(undefined),
  sendBatch: jest.fn().mockResolvedValue(undefined),
  renderTemplate: jest.fn().mockReturnValue({ html: '<p>mock</p>', missingVariables: [] }),
  renderSubject: jest.fn().mockReturnValue({ subject: 'Mock Subject', missingVariables: [] }),
  buildContext: jest.fn().mockResolvedValue(mockEmailContext),
  // #932: CommunicationsService.sendEmail resolves this for every client-facing send.
  getSenderIdentity: jest.fn().mockResolvedValue({ name: mockEmailContext.musicianName, email: mockEmailContext.musicianEmail }),
};

const mockDistanceMatrixClient = {
  getDistance: jest.fn().mockResolvedValue({ minutes: 30, distanceMetres: 20000 }),
};

// Real pdfmake rendering (fonts + layout) is by far the most expensive part of the invoice/contract
// state-transition tests (#948) — most of those tests assert on state/DB, never on PDF content, so
// they don't need it. `documentId` is deliberately left undefined rather than a fake string: it flows
// into Communication.documentId, a real FK to Document, and a fake id would violate it on insert.
export const mockDocumentsService = {
  generateAndStoreInvoicePdf: jest.fn().mockResolvedValue({ buffer: Buffer.from('%PDF-mock'), documentId: undefined }),
  generatePreviewPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-mock')),
  getStoredInvoicePdfBuffer: jest.fn().mockResolvedValue({ buffer: Buffer.from('%PDF-mock'), documentId: undefined }),
  generateAndStoreSignedContractPdf: jest.fn().mockResolvedValue(undefined),
  generateAndStoreSongListPdf: jest.fn().mockResolvedValue({ buffer: Buffer.from('%PDF-mock'), url: '/documents/mock/download' }),
  findByBooking: jest.fn().mockResolvedValue([]),
  findByInvoice: jest.fn().mockResolvedValue(null),
  findContractForBooking: jest.fn().mockResolvedValue(null),
  resolveDownloadTarget: jest.fn().mockResolvedValue({ url: 'https://mock-storage.test/presigned-get' }),
  uploadDocument: jest.fn().mockResolvedValue(undefined),
  deleteDocument: jest.fn().mockResolvedValue(undefined),
};

export interface CreateTestAppOptions {
  // Opt into the real DocumentsService (real pdfmake rendering) instead of the default mock — for
  // the one test per suite that needs to prove real PDF generation still works end-to-end (#948).
  realDocuments?: boolean;
}

export async function createTestApp(options: CreateTestAppOptions = {}): Promise<INestApplication> {
  const moduleBuilder = Test.createTestingModule({ imports: [AppModule] })
    .overrideModule(AuthModule)
    .useModule(TestAuthModule)
    .overrideProvider(StorageService)
    .useValue(mockStorageService)
    .overrideProvider(MailService)
    .useValue(mockMailService)
    .overrideProvider(DistanceMatrixClient)
    .useValue(mockDistanceMatrixClient);

  if (!options.realDocuments) {
    moduleBuilder.overrideProvider(DocumentsService).useValue(mockDocumentsService);
  }

  const moduleRef = await moduleBuilder.compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}
