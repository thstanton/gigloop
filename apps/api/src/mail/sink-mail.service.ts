import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';

// Email sink for E2E_TEST_MODE (ADR-0048 §4). Extends MailService so it keeps
// the real, Prisma-backed context/template rendering — only the outbound Resend
// calls (`send`/`sendBatch`) are swallowed. The explicit constructor is
// required: without it the subclass drops the `design:paramtypes` metadata Nest
// reads to inject PrismaService.
@Injectable()
export class SinkMailService extends MailService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  override send(): Promise<void> {
    return Promise.resolve();
  }

  override sendBatch(): Promise<void> {
    return Promise.resolve();
  }
}
