import { useCallback, useState } from 'react';

export function useCelebration() {
  const [celebrationTick, setCelebrationTick] = useState(0);

  const celebrate = useCallback(() => {
    setCelebrationTick((tick) => tick + 1);
  }, []);

  return {
    celebrationTick,
    celebrate,
  };
}
