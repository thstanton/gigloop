import { describe, it, expect } from 'vitest';
import { resolveApiBaseUrl } from './apiBaseUrl';

describe('resolveApiBaseUrl', () => {
  it('defaults to the relative /api base when unset', () => {
    expect(resolveApiBaseUrl(undefined)).toBe('/api');
  });

  it('defaults to the relative /api base when empty', () => {
    expect(resolveApiBaseUrl('')).toBe('/api');
  });

  it('uses the provided base when set', () => {
    expect(resolveApiBaseUrl('https://staging-api.example.com/api')).toBe(
      'https://staging-api.example.com/api',
    );
  });
});
