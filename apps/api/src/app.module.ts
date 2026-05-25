import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { CommunicationsModule } from './communications/communications.module';
import { ContactsModule } from './contacts/contacts.module';
import { DocumentsModule } from './documents/documents.module';
import { HealthModule } from './health/health.module';
import { InvoicesModule } from './invoices/invoices.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { SongsModule } from './songs/songs.module';
import { StorageModule } from './storage/storage.module';
import { TemplatesModule } from './templates/templates.module';
import { UserProfileModule } from './user-profile/user-profile.module';

@Module({
  imports: [PrismaModule, AuthModule, HealthModule, StorageModule, MailModule, UserProfileModule, ContactsModule, BookingsModule, SongsModule, InvoicesModule, TemplatesModule, CommunicationsModule, DocumentsModule],
})
export class AppModule {}
