import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  afterEach(() => vi.useRealTimers());

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('seed', 250));
    expect(result.current).toBe('seed');
  });

  it('updates only after the delay elapses', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 250), {
      initialProps: { v: 'a' },
    });

    rerender({ v: 'ab' });
    expect(result.current).toBe('a'); // still the old value inside the window

    act(() => vi.advanceTimersByTime(250));
    expect(result.current).toBe('ab');
  });

  it('coalesces rapid changes — only the latest survives the window', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 250), {
      initialProps: { v: 'a' },
    });

    rerender({ v: 'ab' });
    act(() => vi.advanceTimersByTime(100));
    rerender({ v: 'abc' }); // resets the window before 'ab' could land
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(250));
    expect(result.current).toBe('abc');
  });
});
