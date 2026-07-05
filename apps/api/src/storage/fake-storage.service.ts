import { Injectable } from '@nestjs/common';
import { StorageService } from './storage.service';

// In-memory stand-in for StorageService, used only when E2E_TEST_MODE is on
// (ADR-0048 §4). Extends the real service so it shares the `StorageService` DI
// token and stays type-compatible; every outbound method is overridden and
// `onModuleInit` is a no-op so the missing R2 env vars don't throw at boot.
@Injectable()
export class FakeStorageService extends StorageService {
  private readonly store = new Map<string, { buffer: Buffer; contentType: string }>();

  override onModuleInit(): void {
    // no R2 client — everything is served from the in-memory store
  }

  override getPresignedUploadUrl(key: string): Promise<string> {
    return Promise.resolve(`http://localhost/fake-storage/upload/${encodeURIComponent(key)}`);
  }

  override putObject(key: string, buffer: Buffer, contentType: string): Promise<void> {
    this.store.set(key, { buffer, contentType });
    return Promise.resolve();
  }

  override deleteObject(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  override getObject(key: string): Promise<Buffer> {
    const entry = this.store.get(key);
    return Promise.resolve(entry?.buffer ?? Buffer.from(''));
  }

  override getPublicUrl(key: string): string {
    return `http://localhost/fake-storage/${encodeURIComponent(key)}`;
  }
}
