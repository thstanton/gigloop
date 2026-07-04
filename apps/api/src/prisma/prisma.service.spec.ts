import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
    jest.useFakeTimers();
    // Silence the retry warnings in test output.
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('connects on the first attempt when the database is available', async () => {
    const connect = jest.spyOn(service, '$connect').mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('retries and succeeds after transient cold-start failures', async () => {
    const connect = jest
      .spyOn(service, '$connect')
      .mockRejectedValueOnce(new Error('P1001'))
      .mockRejectedValueOnce(new Error('P1001'))
      .mockResolvedValueOnce(undefined);

    const pending = service.onModuleInit();
    await jest.runAllTimersAsync();
    await expect(pending).resolves.toBeUndefined();

    expect(connect).toHaveBeenCalledTimes(3);
  });

  it('rethrows once the attempt cap is exhausted', async () => {
    const connect = jest
      .spyOn(service, '$connect')
      .mockRejectedValue(new Error('P1001'));

    const pending = service.onModuleInit();
    // Attach the rejection handler before advancing timers so the eventual
    // rejection is never briefly unhandled.
    const assertion = expect(pending).rejects.toThrow('P1001');
    await jest.runAllTimersAsync();
    await assertion;

    // 5 attempts (MAX_CONNECT_ATTEMPTS), then rethrow.
    expect(connect).toHaveBeenCalledTimes(5);
  });
});
