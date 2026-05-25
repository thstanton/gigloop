import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MailService } from './mail.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
