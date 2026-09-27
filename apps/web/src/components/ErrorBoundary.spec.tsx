import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary, { variantForPathname } from './ErrorBoundary';

const captureException = vi.fn();
vi.mock('@sentry/react', () => ({ captureException: (...args: unknown[]) => captureException(...args) }));

function Bomb(): never {
  throw new Error('Test explosion');
}

describe('ErrorBoundary', () => {
  it('reports the caught error to Sentry exactly once', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeVisible();
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ contexts: expect.objectContaining({ react: expect.anything() }) }),
    );
  });
});

describe('variantForPathname', () => {
  it.each([
    ['/', 'default'],
    ['/sign-in', 'default'],
    ['/sign-up', 'default'],
    ['/booking/tok', 'portal'],
    ['/booking/tok/contract', 'portal'],
    ['/booking/tok/music', 'portal'],
    ['/band/tok', 'portal'],
    ['/admin/portal-preview', 'default'],
    ['/onboarding/profile', 'default'],
    ['/admin/bookings', 'default'],
  ] as const)('%s -> %s', (pathname, expected) => {
    expect(variantForPathname(pathname)).toBe(expected);
  });
});
