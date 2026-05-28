import { useEffect, useRef } from 'react';

export function useWakeLock(active: boolean) {
  const lockRef = useRef<any>(null);

  const acquire = async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      lockRef.current = await (navigator as any).wakeLock.request('screen');
    } catch {
      // Ignore unsupported/denied wake lock attempts.
    }
  };

  const release = async () => {
    if (!lockRef.current) return;
    await lockRef.current.release().catch(() => {});
    lockRef.current = null;
  };

  useEffect(() => {
    if (!active) {
      release();
      return;
    }

    acquire();
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && active) acquire();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      release();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active]);
}
