import { useCallback, useRef, useState } from 'react';

export function useAsyncActionMap() {
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>({});
  const pendingRef = useRef<Record<string, boolean>>({});

  const isPending = useCallback(
    (key: string) => Boolean(pendingRef.current[key]),
    [],
  );

  const start = useCallback((key: string) => {
    pendingRef.current = { ...pendingRef.current, [key]: true };
    setPendingActions((prev) => ({ ...prev, [key]: true }));
  }, []);

  const finish = useCallback((key: string) => {
    if (!pendingRef.current[key]) return;
    const nextRef = { ...pendingRef.current };
    delete nextRef[key];
    pendingRef.current = nextRef;
    setPendingActions((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const run = useCallback(
    async <T,>(key: string, action: () => Promise<T>): Promise<T | undefined> => {
      if (pendingRef.current[key]) return undefined;
      start(key);
      try {
        return await action();
      } finally {
        finish(key);
      }
    },
    [finish, start],
  );

  return {
    pendingActions,
    isPending,
    start,
    finish,
    run,
  };
}
