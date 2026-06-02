import { Module } from '@nestjs/common';
import { DigestRepository } from './digest.repository';

@Module({
  providers: [DigestRepository],
})
export class DigestModule {}
