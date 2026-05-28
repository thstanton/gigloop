import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingsRepository } from './bookings.repository';
import { MailModule } from '../mail/mail.module';
import { ChecklistModule } from '../checklist/checklist.module';

@Module({
  imports: [MailModule, ChecklistModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsRepository],
})
export class BookingsModule {}
