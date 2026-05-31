import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { verifyToken } from '@clerk/backend';

jest.mock('@clerk/backend', () => ({ verifyToken: jest.fn() }));
const mockVerifyToken = verifyToken as jest.Mock;

function makeContext(headers: Record<string, string> = {}, isPublic = false) {
  const request: Record<string, unknown> = { headers };
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(isPublic),
  } as unknown as Reflector;
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { guard: new AuthGuard(reflector), context, request };
}

describe('AuthGuard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('allows public routes without verifying the token', async () => {
    const { guard, context } = makeContext({}, true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when Authorization header is missing', async () => {
    const { guard, context } = makeContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when scheme is not Bearer', async () => {
    const { guard, context } = makeContext({ authorization: 'Basic abc123' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when verifyToken rejects', async () => {
    mockVerifyToken.mockRejectedValue(new Error('invalid token'));
    const { guard, context } = makeContext({ authorization: 'Bearer bad-token' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('sets userId on the request and returns true for a valid token', async () => {
    mockVerifyToken.mockResolvedValue({ sub: 'user_abc123' });
    const { guard, context, request } = makeContext({ authorization: 'Bearer valid-token' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.userId).toBe('user_abc123');
  });
});
