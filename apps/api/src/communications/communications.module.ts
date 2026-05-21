import { Module } from '@nestjs/common';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';
import { CommunicationsRepository } from './communications.repository';

@Module({
  controllers: [CommunicationsController],
  providers: [CommunicationsService, CommunicationsRepository],
})
export class CommunicationsModule {}
