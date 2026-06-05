import { useState, useEffect, useCallback, useRef } from 'react';
import { clientLogger } from '../services/clientLogger';

export interface AsyncDataState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

export interface UseAsyncDataOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (err: Error) => void;
  initialData?: T;
}

export function useAsyncData<T>(
  fetchFn: () => Promise<T>,
  deps: any[] = [],
  options: UseAsyncDataOptions<T> = {}
): AsyncDataState<T> {
  const { onSuccess, onError, initialData } = options;
  const [data, setData] = useState<T | null>(initialData ?? null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);
  const requestCountRef = useRef(0);
  
  // Use refs for fetchFn and callbacks to avoid them triggering re-fetches
  // unless they are explicitly included in deps by the user.
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const executeFetch = useCallback(async () => {
    const currentRequestCount = ++requestCountRef.current;
    
    setLoading(true);
    setError(null);

    try {
      const result = await fetchFnRef.current();
      
      if (!mountedRef.current || currentRequestCount !== requestCountRef.current) {
        return;
      }

      setData(result);
      onSuccessRef.current?.(result);
    } catch (err) {
      if (!mountedRef.current || currentRequestCount !== requestCountRef.current) {
        return;
      }

      const normalizedError = err instanceof Error ? err : new Error(String(err));
      setError(normalizedError);
      
      clientLogger.errorWithException('useAsyncData fetch failed', normalizedError, {
        deps,
      });
      
      onErrorRef.current?.(normalizedError);
    } finally {
      if (mountedRef.current && currentRequestCount === requestCountRef.current) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    executeFetch();
  }, [executeFetch]);

  const refresh = useCallback(async () => {
    await executeFetch();
  }, [executeFetch]);

  return {
    data,
    loading,
    error,
    refresh,
    setData,
  };
}
