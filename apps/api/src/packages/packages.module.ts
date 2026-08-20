import { Module } from '@nestjs/common';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';
import { PackagesRepository } from './packages.repository';
import { LineupsModule } from '../lineups/lineups.module';

@Module({
  imports: [LineupsModule],
  controllers: [PackagesController],
  providers: [PackagesService, PackagesRepository],
})
export class PackagesModule {}
