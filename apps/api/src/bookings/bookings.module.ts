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
import { LineupsModule } from '../lineups/lineups.module';
import { CommunicationsModule } from '../communications/communications.module';
import { DocumentsModule } from '../documents/documents.module';
import { BandCommunicationsController } from './band-communications.controller';
import { BandCommunicationsService } from './band-communications.service';

@Module({
  imports: [MailModule, ChecklistModule, SeriesModule, ContactsModule, LineupsModule, CommunicationsModule, DocumentsModule],
  controllers: [BookingsController, BandCommunicationsController],
  providers: [BookingsService, BookingsRepository, ContractRepository, MusicFormConfigRepository, BandCommunicationsService],
  exports: [BookingsRepository, ContractRepository, MusicFormConfigRepository],
})
export class BookingsModule {}
