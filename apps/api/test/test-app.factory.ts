import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AuthGuard } from '../src/auth/auth.guard';
import { StorageService } from '../src/storage/storage.service';
import { MailService } from '../src/mail/mail.service';
import { DistanceMatrixClient } from '../src/contacts/distance-matrix.client';
import { TestAuthGuard } from './test-auth.guard';

const mockStorageService = {
  getPresignedUploadUrl: jest.fn().mockResolvedValue('https://mock-storage.test/presigned'),
  putObject: jest.fn().mockResolvedValue(undefined),
  deleteObject: jest.fn().mockResolvedValue(undefined),
  getPublicUrl: jest.fn().mockReturnValue('https://mock-storage.test/file'),
};

const mockMailService = {
  send: jest.fn().mockResolvedValue(undefined),
  sendBatch: jest.fn().mockResolvedValue(undefined),
  renderTemplate: jest.fn().mockResolvedValue({ html: '<p>mock</p>', missingVariables: [] }),
};

const mockDistanceMatrixClient = {
  getDistance: jest.fn().mockResolvedValue({ minutes: 30, distanceMetres: 20000 }),
};

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(APP_GUARD)
    .useClass(TestAuthGuard)
    .overrideGuard(AuthGuard)
    .useClass(TestAuthGuard)
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
