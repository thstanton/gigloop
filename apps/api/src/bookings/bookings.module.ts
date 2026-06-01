import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingsRepository } from './bookings.repository';
import { BookingActionsService } from './bookings-actions.service';
import { MailModule } from '../mail/mail.module';
import { ChecklistModule } from '../checklist/checklist.module';
import { SeriesModule } from '../series/series.module';

@Module({
  imports: [MailModule, ChecklistModule, SeriesModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsRepository, BookingActionsService],
})
export class BookingsModule {}
