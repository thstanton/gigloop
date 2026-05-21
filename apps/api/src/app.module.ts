import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { ContactsModule } from './contacts/contacts.module';
import { HealthModule } from './health/health.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PrismaModule } from './prisma/prisma.module';
import { SongsModule } from './songs/songs.module';
import { UserProfileModule } from './user-profile/user-profile.module';

@Module({
  imports: [PrismaModule, AuthModule, HealthModule, UserProfileModule, ContactsModule, BookingsModule, SongsModule, InvoicesModule],
})
export class AppModule {}
