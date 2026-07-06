import { Injectable } from '@nestjs/common';
import { StorageService } from './storage.service';

// In-memory stand-in for StorageService, used only when E2E_TEST_MODE is on
// (ADR-0048 §4). Extends the real service so it shares the `StorageService` DI
// token and stays type-compatible; every outbound method is overridden and
// `onModuleInit` is a no-op so the missing R2 env vars don't throw at boot.
// Mirrors the two-bucket surface introduced by ADR-0059 (#656): a public assets
// bucket and a private documents bucket. The fake collapses both onto one
// in-memory store — keys don't collide across the surfaces in practice — and
// serves fake local URLs in place of R2 / presigned links.
@Injectable()
export class FakeStorageService extends StorageService {
  private readonly store = new Map<string, { buffer: Buffer; contentType: string }>();

  override onModuleInit(): void {
    // no R2 client — everything is served from the in-memory store
  }

  // ─── Assets — public bucket ────────────────────────────────────────────────

  override getPresignedUploadUrl(key: string): Promise<string> {
    return Promise.resolve(`http://localhost/fake-storage/upload/${encodeURIComponent(key)}`);
  }

  override getPublicUrl(key: string): string {
    return `http://localhost/fake-storage/${encodeURIComponent(key)}`;
  }

  override deleteAsset(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  // ─── Documents — private bucket ────────────────────────────────────────────

  override putDocument(key: string, buffer: Buffer, contentType: string): Promise<void> {
    this.store.set(key, { buffer, contentType });
    return Promise.resolve();
  }

  override deleteDocument(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  override getDocument(key: string): Promise<Buffer> {
    const entry = this.store.get(key);
    return Promise.resolve(entry?.buffer ?? Buffer.from(''));
  }

  override getPresignedDownloadUrl(key: string): Promise<string> {
    return Promise.resolve(`http://localhost/fake-storage/download/${encodeURIComponent(key)}`);
  }
}
