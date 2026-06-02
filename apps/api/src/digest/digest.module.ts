import { Module } from '@nestjs/common';
import { DigestRepository } from './digest.repository';
import { DigestService } from './digest.service';

@Module({
  providers: [DigestRepository, DigestService],
})
export class DigestModule {}
