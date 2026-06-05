import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAsyncData } from './useAsyncData';
import { clientLogger } from '../services/clientLogger';

// Mock clientLogger
vi.mock('../services/clientLogger', () => ({
  clientLogger: {
    error: vi.fn(),
    errorWithException: vi.fn(),
  },
}));

describe('useAsyncData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start with loading state and fetch data', async () => {
    const fetchFn = vi.fn().mockResolvedValue('test-data');
    const { result } = renderHook(() => useAsyncData(fetchFn));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe('test-data');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('should handle fetch errors and log them', async () => {
    const error = new Error('fetch failed');
    const fetchFn = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() => useAsyncData(fetchFn));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(error);
    expect(clientLogger.errorWithException).toHaveBeenCalledWith(
      'useAsyncData fetch failed',
      error,
      expect.any(Object)
    );
  });

  it('should re-fetch when dependencies change', async () => {
    const fetchFn = vi.fn().mockImplementation((id) => Promise.resolve(`data-${id}`));
    const { result, rerender } = renderHook(({ id }) => useAsyncData(() => fetchFn(id), [id]), {
      initialProps: { id: 1 },
    });

    await waitFor(() => {
      expect(result.current.data).toBe('data-1');
    });

    rerender({ id: 2 });

    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.data).toBe('data-2');
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('should provide a refresh function', async () => {
    const fetchFn = vi.fn().mockResolvedValue('test-data');
    const { result } = renderHook(() => useAsyncData(fetchFn));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('should provide a setData function', async () => {
    const fetchFn = vi.fn().mockResolvedValue('initial');
    const { result } = renderHook(() => useAsyncData(fetchFn));

    await waitFor(() => {
      expect(result.current.data).toBe('initial');
    });

    act(() => {
      result.current.setData('updated');
    });

    expect(result.current.data).toBe('updated');
  });

  it('should handle race conditions: ignore results if dependencies change', async () => {
    let resolve1: (value: string) => void;
    const promise1 = new Promise<string>((resolve) => {
      resolve1 = resolve;
    });

    const fetchFn = vi.fn()
      .mockReturnValueOnce(promise1)
      .mockResolvedValueOnce('second');

    const { result, rerender } = renderHook(({ id }) => useAsyncData(() => fetchFn(id), [id]), {
      initialProps: { id: 1 },
    });

    // Start fetch 1, but it's pending.
    // Trigger fetch 2 by changing deps.
    rerender({ id: 2 });

    await waitFor(() => {
      expect(result.current.data).toBe('second');
    });

    // Resolve fetch 1 now. It should be ignored.
    await act(async () => {
      resolve1!('first');
    });

    expect(result.current.data).toBe('second');
  });

  it('should ignore results if component unmounts', async () => {
    let resolve: (value: string) => void;
    const promise = new Promise<string>((r) => {
      resolve = r;
    });
    const fetchFn = vi.fn().mockReturnValue(promise);
    const onSuccess = vi.fn();

    const { unmount } = renderHook(() => useAsyncData(fetchFn, [], { onSuccess }));

    unmount();

    await act(async () => {
      resolve!('data');
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('should call onSuccess and onError callbacks', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const data = 'test-data';
    const error = new Error('fail');

    const fetchSuccess = vi.fn().mockResolvedValue(data);
    renderHook(
      ({ fn, options }) => useAsyncData(fn, [], options),
      {
        initialProps: {
          fn: fetchSuccess,
          options: { onSuccess, onError } as any
        }
      }
    );

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(data));

    const fetchError = vi.fn().mockRejectedValue(error);
    renderHook(() => useAsyncData(fetchError, [], { onSuccess, onError }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(error));
  });

  it('should use initialData if provided and update after fetch', async () => {
    const fetchFn = vi.fn().mockResolvedValue('new-data');
    const { result } = renderHook(() => 
      useAsyncData(fetchFn, [], { initialData: 'initial' })
    );

    expect(result.current.data).toBe('initial');
    
    await waitFor(() => {
      expect(result.current.data).toBe('new-data');
    });
  });
});
