import { Controller, Get } from '@nestjs/common';

// Intentionally public — excluded from AuthGuard per SPEC
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }
}
