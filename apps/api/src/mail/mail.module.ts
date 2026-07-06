import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MailService } from './mail.service';
import { SinkMailService } from './sink-mail.service';
import { pickAdapter } from '../common/test-mode';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [{ provide: MailService, useClass: pickAdapter(MailService, SinkMailService) }],
  exports: [MailService],
})
export class MailModule {}
