import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';

export const TEST_USER_ID = 'test-user-id';

@Injectable()
export class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (request as any).userId = TEST_USER_ID;
    return true;
  }
}
