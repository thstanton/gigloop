import { Module } from '@nestjs/common';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';
import { SongsRepository } from './songs.repository';

@Module({
  controllers: [SongsController],
  providers: [SongsService, SongsRepository],
})
export class SongsModule {}
