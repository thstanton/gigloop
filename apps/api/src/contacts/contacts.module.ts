import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { ContactsRepository } from './contacts.repository';
import { TravelTimeService } from './travel-time.service';
import { DistanceMatrixClient } from './distance-matrix.client';
import { UserProfileModule } from '../user-profile/user-profile.module';

@Module({
  imports: [UserProfileModule],
  controllers: [ContactsController],
  providers: [ContactsService, ContactsRepository, TravelTimeService, DistanceMatrixClient],
})
export class ContactsModule {}
