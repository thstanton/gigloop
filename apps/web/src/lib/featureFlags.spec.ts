import { describe, it, expect, afterEach } from 'vitest';
import { resolveFlag, isEnabled } from './featureFlags';

describe('resolveFlag', () => {
  it('is off when unset', () => {
    expect(resolveFlag(undefined)).toBe(false);
  });

  it('is off when empty', () => {
    expect(resolveFlag('')).toBe(false);
  });

  it('is off for "false"', () => {
    expect(resolveFlag('false')).toBe(false);
  });

  it('is off for "0"', () => {
    expect(resolveFlag('0')).toBe(false);
  });

  it('is on for "true"', () => {
    expect(resolveFlag('true')).toBe(true);
  });

  it('is on for "1"', () => {
    expect(resolveFlag('1')).toBe(true);
  });

  it('is on for "TRUE" (case-insensitive)', () => {
    expect(resolveFlag('TRUE')).toBe(true);
  });
});

describe('isEnabled', () => {
  const FLAG = 'VITE_FEATURE_TEST_FLAG';

  afterEach(() => {
    delete (import.meta.env as Record<string, string | undefined>)[FLAG];
  });

  it('reads the flag from import.meta.env and is off when unset', () => {
    expect(isEnabled(FLAG)).toBe(false);
  });

  it('is on when the env var is set to "true"', () => {
    (import.meta.env as Record<string, string | undefined>)[FLAG] = 'true';
    expect(isEnabled(FLAG)).toBe(true);
  });
});
