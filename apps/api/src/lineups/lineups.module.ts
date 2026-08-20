import { Module } from '@nestjs/common';
import { LineupsController } from './lineups.controller';
import { LineupsService } from './lineups.service';
import { LineupsRepository } from './lineups.repository';

@Module({
  controllers: [LineupsController],
  providers: [LineupsService, LineupsRepository],
  exports: [LineupsService],
})
export class LineupsModule {}
