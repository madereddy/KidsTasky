import { useState, useEffect } from 'react';

function isInSleepWindow(now: string, start: string, end: string): boolean {
  if (start <= end) return now >= start && now < end;
  // overnight window (e.g., 22:00 → 07:00)
  return now >= start || now < end;
}

function getCurrentHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

interface SleepModeSettings {
  sleepStart?: string;
  sleepEnd?: string;
}

export function useSleepMode(settings: SleepModeSettings) {
  const [isSleeping, setIsSleeping] = useState(false);

  useEffect(() => {
    const { sleepStart = '22:00', sleepEnd = '07:00' } = settings;

    function checkSleepTime() {
      const hhmm = getCurrentHHMM();
      setIsSleeping(isInSleepWindow(hhmm, sleepStart, sleepEnd));
    }

    checkSleepTime();
    const id = setInterval(checkSleepTime, 60_000);
    return () => clearInterval(id);
  }, [settings.sleepStart, settings.sleepEnd]);

  return { isSleeping };
}
