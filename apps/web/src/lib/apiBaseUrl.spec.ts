import { describe, it, expect } from 'vitest';
import { resolveApiBaseUrl } from './apiBaseUrl';

const DEV = true;
const DEPLOYED = false;

describe('resolveApiBaseUrl', () => {
  it('uses the provided base when set', () => {
    expect(resolveApiBaseUrl('https://staging-api.example.com/api', DEPLOYED)).toBe(
      'https://staging-api.example.com/api',
    );
  });

  it('uses the provided base when set, in dev too', () => {
    expect(resolveApiBaseUrl('http://localhost:3100/api', DEV)).toBe(
      'http://localhost:3100/api',
    );
  });

  describe('in dev / test / Storybook, where the Vite proxy backs it', () => {
    it('defaults to the relative /api base when unset', () => {
      expect(resolveApiBaseUrl(undefined, DEV)).toBe('/api');
    });

    it('defaults to the relative /api base when empty', () => {
      expect(resolveApiBaseUrl('', DEV)).toBe('/api');
    });
  });

  // Fails closed (#785). These invert the previous deployed-build behaviour: it
  // resolved '' to '/api', which relied on a rewrite pointing at the prod
  // Railway host — so preprod could silently reach the production API. The
  // dev-mode '/api' default above is unchanged and still asserted.
  describe('in a deployed build', () => {
    it('throws rather than defaulting to /api when unset', () => {
      expect(() => resolveApiBaseUrl(undefined, DEPLOYED)).toThrow(
        /VITE_API_BASE_URL is empty/,
      );
    });

    it('throws rather than defaulting to /api when empty', () => {
      expect(() => resolveApiBaseUrl('', DEPLOYED)).toThrow(/VITE_API_BASE_URL is empty/);
    });

    it('never resolves to a relative path a rewrite could map to another environment', () => {
      let resolved: string | undefined;
      try {
        resolved = resolveApiBaseUrl('', DEPLOYED);
      } catch {
        resolved = undefined;
      }
      expect(resolved).not.toBe('/api');
      expect(resolved).toBeUndefined();
    });
  });
});
