import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { ContactsRepository } from './contacts.repository';
import { TravelTimeService } from './travel-time.service';
import { DistanceMatrixClient } from './distance-matrix.client';
import { FixedDistanceMatrixClient } from './fixed-distance-matrix.client';
import { UserProfileModule } from '../user-profile/user-profile.module';
import { ChecklistModule } from '../checklist/checklist.module';
import { pickAdapter } from '../common/test-mode';

@Module({
  imports: [UserProfileModule, ChecklistModule],
  controllers: [ContactsController],
  providers: [
    ContactsService,
    ContactsRepository,
    TravelTimeService,
    { provide: DistanceMatrixClient, useClass: pickAdapter(DistanceMatrixClient, FixedDistanceMatrixClient) },
  ],
})
export class ContactsModule {}
