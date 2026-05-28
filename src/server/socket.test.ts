import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { socketWrapper } from './socket.js';

describe('socketWrapper stale-data coalescing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('coalesces rapid stale-data emits per parent/entity', () => {
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    const on = vi.fn();
    socketWrapper.init({ on, to } as any);

    socketWrapper.emitStaleData('p1', 'events');
    socketWrapper.emitStaleData('p1', 'events');
    socketWrapper.emitStaleData('p1', 'events');

    expect(emit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(210);
    expect(to).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('does not coalesce different entities', () => {
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    const on = vi.fn();
    socketWrapper.init({ on, to } as any);

    socketWrapper.emitStaleData('p1', 'events');
    socketWrapper.emitStaleData('p1', 'settings');
    vi.advanceTimersByTime(210);

    expect(to).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenCalledTimes(2);
  });
});
