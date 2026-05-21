import { Module } from '@nestjs/common';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { TemplatesRepository } from './templates.repository';

@Module({
  controllers: [TemplatesController],
  providers: [TemplatesService, TemplatesRepository],
})
export class TemplatesModule {}
