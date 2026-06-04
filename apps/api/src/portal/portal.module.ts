import { Module } from '@nestjs/common';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';
import { PortalRepository } from './portal.repository';
import { MailModule } from '../mail/mail.module';
import { DocumentsModule } from '../documents/documents.module';
import { StorageModule } from '../storage/storage.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ChecklistModule } from '../checklist/checklist.module';
import { UserProfileModule } from '../user-profile/user-profile.module';
import { SongsModule } from '../songs/songs.module';
import { BookingsModule } from '../bookings/bookings.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    DocumentsModule,
    StorageModule,
    ChecklistModule,
    UserProfileModule,
    SongsModule,
    BookingsModule,
    InvoicesModule,
  ],
  controllers: [PortalController],
  providers: [PortalService, PortalRepository],
})
export class PortalModule {}
