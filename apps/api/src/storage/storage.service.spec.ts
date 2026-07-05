import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService } from './storage.service';

// Only the presigner is mocked; the real command classes are used so `instanceof`
// and `.input` reflect the actual AWS SDK shapes.
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/x?sig=abc'),
}));

// #656 — StorageService routes by sensitivity class: documents → private bucket,
// assets → public bucket. A wrong bucket here would write customer PII to the
// world-readable bucket, so these assertions guard the core of ADR-0059.
describe('StorageService — two-bucket routing (#656)', () => {
  const OLD_ENV = process.env;
  let service: StorageService;
  let sendMock: jest.Mock;

  const cmdOf = () => sendMock.mock.calls[0][0];

  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      R2_ACCOUNT_ID: 'acc',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET_NAME: 'assets-bucket',
      R2_DOCUMENTS_BUCKET_NAME: 'documents-bucket',
      R2_PUBLIC_URL: 'https://pub.example',
    };
    service = new StorageService();
    service.onModuleInit();
    sendMock = jest.fn().mockResolvedValue({});
    (service as unknown as { client: { send: jest.Mock } }).client = { send: sendMock };
  });

  afterEach(() => {
    process.env = OLD_ENV;
    jest.clearAllMocks();
  });

  it('writes documents to the private documents bucket', async () => {
    await service.putDocument('contracts/u1/b1.pdf', Buffer.from('x'), 'application/pdf');
    expect(cmdOf()).toBeInstanceOf(PutObjectCommand);
    expect(cmdOf().input.Bucket).toBe('documents-bucket');
  });

  it('deletes documents from the private documents bucket', async () => {
    await service.deleteDocument('uploads/u1/b1/d1.pdf');
    expect(cmdOf()).toBeInstanceOf(DeleteObjectCommand);
    expect(cmdOf().input.Bucket).toBe('documents-bucket');
  });

  it('deletes assets from the public assets bucket', async () => {
    await service.deleteAsset('logos/u1');
    expect(cmdOf()).toBeInstanceOf(DeleteObjectCommand);
    expect(cmdOf().input.Bucket).toBe('assets-bucket');
  });

  it('mints a ~60s presigned GET against the private documents bucket', async () => {
    const url = await service.getPresignedDownloadUrl('invoices/u1/inv.pdf');
    expect(url).toBe('https://signed.example/x?sig=abc');
    const [, command, opts] = (getSignedUrl as jest.Mock).mock.calls[0];
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input.Bucket).toBe('documents-bucket');
    expect(opts.expiresIn).toBe(60);
  });

  it('presigns asset uploads against the public assets bucket', async () => {
    await service.getPresignedUploadUrl('photos/u1', 'image/png');
    const [, command] = (getSignedUrl as jest.Mock).mock.calls[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input.Bucket).toBe('assets-bucket');
  });

  it('fails fast at boot if R2_DOCUMENTS_BUCKET_NAME is missing', () => {
    delete process.env.R2_DOCUMENTS_BUCKET_NAME;
    expect(() => new StorageService().onModuleInit()).toThrow(/R2_DOCUMENTS_BUCKET_NAME/);
  });
});
