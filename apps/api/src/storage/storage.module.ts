import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { FakeStorageService } from './fake-storage.service';
import { pickAdapter } from '../common/test-mode';

@Global()
@Module({
  providers: [{ provide: StorageService, useClass: pickAdapter(StorageService, FakeStorageService) }],
  exports: [StorageService],
})
export class StorageModule {}
