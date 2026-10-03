import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { isEnabled } = vi.hoisted(() => ({ isEnabled: vi.fn(() => true) }));
vi.mock('../featureFlags', () => ({ isEnabled }));

import { APPEARANCE_STORAGE_KEY, useAppearance } from './useAppearance';

function mockColorScheme(initial: boolean) {
  let matches = initial;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const media = {
    get matches() { return matches; },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener)),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  } as unknown as MediaQueryList;
  vi.spyOn(window, 'matchMedia').mockReturnValue(media);

  return {
    media,
    setDark(value: boolean) {
      matches = value;
      const event = { matches: value, media: '(prefers-color-scheme: dark)' } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

describe('useAppearance', () => {
  beforeEach(() => {
    isEnabled.mockReturnValue(true);
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    vi.restoreAllMocks();
  });

  it('applies the saved Dark preference on admin routes and persists changes', () => {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, 'dark');
    mockColorScheme(false);

    const { result } = renderHook(() => useAppearance('/admin'));
    expect(result.current).toMatchObject({ preference: 'dark', resolved: 'dark' });
    expect(document.documentElement).toHaveClass('dark');

    act(() => result.current.setPreference('light'));
    expect(result.current.resolved).toBe('light');
    expect(window.localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('tracks OS changes while System is selected', () => {
    const colorScheme = mockColorScheme(false);
    const { result } = renderHook(() => useAppearance('/admin/bookings'));
    expect(result.current.resolved).toBe('light');

    act(() => colorScheme.setDark(true));
    expect(result.current.resolved).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('keeps the flag-off app light and does not listen to the OS', () => {
    isEnabled.mockReturnValue(false);
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, 'dark');
    const colorScheme = mockColorScheme(true);

    const { result } = renderHook(() => useAppearance('/admin'));
    expect(result.current).toMatchObject({ preference: 'dark', resolved: 'light' });
    expect(document.documentElement).not.toHaveClass('dark');
    expect(colorScheme.media.addEventListener).not.toHaveBeenCalled();
  });

  it('forces portal routes light when navigating from admin', () => {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, 'dark');
    mockColorScheme(false);
    const { result, rerender } = renderHook(({ pathname }) => useAppearance(pathname), {
      initialProps: { pathname: '/admin' },
    });
    expect(result.current.resolved).toBe('dark');

    rerender({ pathname: '/booking/client-token' });
    expect(result.current.resolved).toBe('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('falls back to System when localStorage cannot be read', () => {
    mockColorScheme(true);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage blocked');
    });

    const { result } = renderHook(() => useAppearance('/admin'));
    expect(result.current).toMatchObject({ preference: 'system', resolved: 'dark' });
  });

  it('keeps every instance in sync when one sets the preference', () => {
    mockColorScheme(false);
    const first = renderHook(() => useAppearance('/admin'));
    const second = renderHook(() => useAppearance('/admin'));

    act(() => second.result.current.setPreference('dark'));
    expect(first.result.current).toMatchObject({ preference: 'dark', resolved: 'dark' });
    expect(document.documentElement).toHaveClass('dark');
  });
});
