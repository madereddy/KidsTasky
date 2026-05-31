import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useSleepMode } from './useSleepMode';

describe('useSleepMode', () => {
  afterEach(() => vi.useRealTimers());

  it('enters sleep mode when current time is within sleep window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-30T21:05:00'));
    const { result } = renderHook(() => useSleepMode({ sleepStart: '21:00', sleepEnd: '07:00' }));
    expect(result.current.isSleeping).toBe(true);
  });

  it('not sleeping when outside sleep window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-30T10:00:00'));
    const { result } = renderHook(() => useSleepMode({ sleepStart: '21:00', sleepEnd: '07:00' }));
    expect(result.current.isSleeping).toBe(false);
  });

  it('handles overnight window: morning is sleeping', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-30T03:00:00'));
    const { result } = renderHook(() => useSleepMode({ sleepStart: '22:00', sleepEnd: '07:00' }));
    expect(result.current.isSleeping).toBe(true);
  });

  it('wakes up after advance past sleep end', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-30T06:50:00')); // sleeping (03:00 before end)
    const { result } = renderHook(() => useSleepMode({ sleepStart: '22:00', sleepEnd: '07:00' }));
    expect(result.current.isSleeping).toBe(true);
    act(() => {
      vi.setSystemTime(new Date('2026-05-30T07:05:00'));
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.isSleeping).toBe(false);
  });
});
