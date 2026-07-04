import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Neon scales the compute to zero after inactivity (#612). A cold resume can
// take longer than a single connect attempt allows, so a bare `$connect()`
// crashes the whole app at boot. Retry with linear backoff: the first attempt
// wakes the compute; a later one connects once it is up. Paired with a raised
// `connect_timeout` on DATABASE_URL so each attempt waits out the resume.
const MAX_CONNECT_ATTEMPTS = 5;
const RETRY_BASE_MS = 2000;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    for (let attempt = 1; ; attempt++) {
      try {
        await this.$connect();
        return;
      } catch (err) {
        if (attempt >= MAX_CONNECT_ATTEMPTS) throw err;
        const delayMs = attempt * RETRY_BASE_MS;
        this.logger.warn(
          `Database connect attempt ${attempt}/${MAX_CONNECT_ATTEMPTS} failed ` +
            `(${(err as Error).message}); retrying in ${delayMs}ms — likely a Neon cold start.`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}
