import { Module } from '@nestjs/common';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';
import { PortalRepository } from './portal.repository';
import { MailModule } from '../mail/mail.module';
import { DocumentsModule } from '../documents/documents.module';
import { StorageModule } from '../storage/storage.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, MailModule, DocumentsModule, StorageModule],
  controllers: [PortalController],
  providers: [PortalService, PortalRepository],
})
export class PortalModule {}
