// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAsyncActionMap } from './useAsyncActionMap';

describe('useAsyncActionMap', () => {
  it('tracks pending state for a running action', async () => {
    const { result } = renderHook(() => useAsyncActionMap());
    let resolveAction: (() => void) | null = null;

    let promise: Promise<void | undefined> | undefined;
    await act(async () => {
      promise = result.current.run('task-1', () => new Promise<void>((resolve) => {
        resolveAction = resolve;
      }));
    });

    await waitFor(() => expect(result.current.isPending('task-1')).toBe(true));

    await act(async () => {
      resolveAction?.();
      await promise;
    });

    expect(result.current.isPending('task-1')).toBe(false);
  });

  it('deduplicates concurrent actions with the same key', async () => {
    const { result } = renderHook(() => useAsyncActionMap());
    let calls = 0;
    let resolveAction: (() => void) | null = null;

    let firstPromise: Promise<string | undefined> | undefined;
    let secondPromise: Promise<string | undefined> | undefined;

    await act(async () => {
      firstPromise = result.current.run('task-1', () => new Promise<string>((resolve) => {
        calls += 1;
        resolveAction = () => resolve('ok');
      }));
      secondPromise = result.current.run('task-1', async () => {
        calls += 1;
        return 'duplicate';
      });
    });

    expect(calls).toBe(1);
    await expect(secondPromise).resolves.toBeUndefined();

    await act(async () => {
      resolveAction?.();
      await firstPromise;
    });
    expect(result.current.isPending('task-1')).toBe(false);
  });
});
