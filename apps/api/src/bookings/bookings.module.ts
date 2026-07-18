import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingsRepository } from './bookings.repository';
import { ContractRepository } from './contract.repository';
import { MusicFormConfigRepository } from './music-form-config.repository';
import { MailModule } from '../mail/mail.module';
import { ChecklistModule } from '../checklist/checklist.module';
import { SeriesModule } from '../series/series.module';
import { ContactsModule } from '../contacts/contacts.module';

@Module({
  imports: [MailModule, ChecklistModule, SeriesModule, ContactsModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsRepository, ContractRepository, MusicFormConfigRepository],
  exports: [BookingsRepository, ContractRepository, MusicFormConfigRepository],
})
export class BookingsModule {}
