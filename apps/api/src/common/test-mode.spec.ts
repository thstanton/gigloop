import { E2E_TEST_MODE_FLAG, isE2ETestMode, pickAdapter } from './test-mode';

describe('isE2ETestMode', () => {
  afterEach(() => {
    delete process.env[E2E_TEST_MODE_FLAG];
  });

  it('is off when E2E_TEST_MODE is unset', () => {
    expect(isE2ETestMode()).toBe(false);
  });

  it('is off when E2E_TEST_MODE is "false"', () => {
    process.env[E2E_TEST_MODE_FLAG] = 'false';
    expect(isE2ETestMode()).toBe(false);
  });

  it('is on when E2E_TEST_MODE is "true"', () => {
    process.env[E2E_TEST_MODE_FLAG] = 'true';
    expect(isE2ETestMode()).toBe(true);
  });

  it('is on when E2E_TEST_MODE is "1"', () => {
    process.env[E2E_TEST_MODE_FLAG] = '1';
    expect(isE2ETestMode()).toBe(true);
  });
});

describe('pickAdapter', () => {
  const real = { name: 'real' };
  const fake = { name: 'fake' };

  it('selects the fake adapter in test mode', () => {
    expect(pickAdapter(real, fake, true)).toBe(fake);
  });

  it('selects the real adapter outside test mode', () => {
    expect(pickAdapter(real, fake, false)).toBe(real);
  });

  it('defaults its decision to the E2E_TEST_MODE env flag', () => {
    process.env[E2E_TEST_MODE_FLAG] = 'true';
    expect(pickAdapter(real, fake)).toBe(fake);
    delete process.env[E2E_TEST_MODE_FLAG];
    expect(pickAdapter(real, fake)).toBe(real);
  });
});
