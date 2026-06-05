import { Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AuthModule } from '../src/auth/auth.module';
import { StorageService } from '../src/storage/storage.service';
import { MailService } from '../src/mail/mail.service';
import { DistanceMatrixClient } from '../src/contacts/distance-matrix.client';
import { TestAuthGuard } from './test-auth.guard';

// Replaces AuthModule: provides TestAuthGuard as the global APP_GUARD.
@Global()
@Module({ providers: [{ provide: APP_GUARD, useClass: TestAuthGuard }] })
class TestAuthModule {}

const mockStorageService = {
  getPresignedUploadUrl: jest.fn().mockResolvedValue('https://mock-storage.test/presigned'),
  putObject: jest.fn().mockResolvedValue(undefined),
  deleteObject: jest.fn().mockResolvedValue(undefined),
  getPublicUrl: jest.fn().mockReturnValue('https://mock-storage.test/file'),
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
};

const mockDistanceMatrixClient = {
  getDistance: jest.fn().mockResolvedValue({ minutes: 30, distanceMetres: 20000 }),
};

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideModule(AuthModule)
    .useModule(TestAuthModule)
    .overrideProvider(StorageService)
    .useValue(mockStorageService)
    .overrideProvider(MailService)
    .useValue(mockMailService)
    .overrideProvider(DistanceMatrixClient)
    .useValue(mockDistanceMatrixClient)
    .compile();

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
