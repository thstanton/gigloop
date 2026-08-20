import { ArgumentsHost, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { AllExceptionsFilter } from './all-exceptions.filter';

jest.mock('@sentry/nestjs', () => ({ captureException: jest.fn() }));
const mockCaptureException = Sentry.captureException as jest.Mock;

function makeHost(userId?: string) {
  const request: Record<string, unknown> = { method: 'GET', path: '/api/bookings', userId };
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    jest.clearAllMocks();
    filter = new AllExceptionsFilter();
  });

  it('captures a 500 HttpException to Sentry, tagged with userId', () => {
    const { host } = makeHost('user_abc123');
    const exception = new InternalServerErrorException('boom');

    filter.catch(exception, host);

    expect(mockCaptureException).toHaveBeenCalledWith(exception, { tags: { userId: 'user_abc123' } });
  });

  it('captures a generic Error (non-HttpException) to Sentry', () => {
    const { host } = makeHost('user_abc123');
    const exception = new Error('unexpected failure');

    filter.catch(exception, host);

    expect(mockCaptureException).toHaveBeenCalledWith(exception, { tags: { userId: 'user_abc123' } });
  });

  it('omits the userId tag on a portal route with no authenticated user', () => {
    const { host } = makeHost();
    const exception = new Error('unexpected failure');

    filter.catch(exception, host);

    expect(mockCaptureException).toHaveBeenCalledWith(exception, {});
  });

  it('does not capture a 404 to Sentry', () => {
    const { host } = makeHost('user_abc123');
    filter.catch(new NotFoundException(), host);

    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('does not capture a 400 to Sentry', () => {
    const { host } = makeHost('user_abc123');
    filter.catch(new BadRequestException('invalid'), host);

    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});
