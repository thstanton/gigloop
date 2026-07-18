import { Module } from '@nestjs/common';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';
import { CommunicationsRepository } from './communications.repository';
import { ChecklistModule } from '../checklist/checklist.module';
import { ContactsModule } from '../contacts/contacts.module';

@Module({
  imports: [ChecklistModule, ContactsModule],
  controllers: [CommunicationsController],
  providers: [CommunicationsService, CommunicationsRepository],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
