import { Global, Module } from '@nestjs/common';
import { CommunicationsModule } from '../communications/communications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MailService } from './mail.service';

@Global()
@Module({
  imports: [PrismaModule, CommunicationsModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
