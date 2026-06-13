import { useCallback, useRef, useEffect, useState } from 'react';

export function useIdleTimers(
  WALL_IDLE_MS = 5 * 60 * 1000,
  SLEEP_IDLE_MS = 15 * 60 * 1000
) {
  const [isWallMode, setIsWallMode] = useState(false);
  const [isCalSleeping, setIsCalSleeping] = useState(false);

  const wallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetIdleTimers = useCallback(() => {
    setIsCalSleeping(false);
    if (wallTimerRef.current) clearTimeout(wallTimerRef.current);
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    wallTimerRef.current = setTimeout(() => setIsWallMode(true), WALL_IDLE_MS);
    sleepTimerRef.current = setTimeout(() => setIsCalSleeping(true), SLEEP_IDLE_MS);
  }, [WALL_IDLE_MS, SLEEP_IDLE_MS]);

  useEffect(() => {
    const evts = ['mousemove', 'mousedown', 'keydown', 'touchstart'] as const;
    evts.forEach((e) => document.addEventListener(e, resetIdleTimers, { passive: true }));
    resetIdleTimers();
    return () => {
      evts.forEach((e) => document.removeEventListener(e, resetIdleTimers));
      if (wallTimerRef.current) clearTimeout(wallTimerRef.current);
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    };
  }, [resetIdleTimers]);

  return {
    isWallMode,
    setIsWallMode,
    isCalSleeping,
    setIsCalSleeping,
    resetIdleTimers
  };
}
