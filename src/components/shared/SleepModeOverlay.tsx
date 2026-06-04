// src/components/shared/SleepModeOverlay.tsx
import React, { useState, useEffect } from 'react';
import { Moon } from 'lucide-react';

function formatTime(use24h: boolean): string {
  return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: !use24h });
}

export function SleepModeOverlay({ isActive, fixedTime, use24h = false, onDismiss }: { isActive: boolean; fixedTime?: string; use24h?: boolean; onDismiss?: () => void }) {
  const [timeStr, setTimeStr] = useState(fixedTime || formatTime(use24h));

  useEffect(() => {
    if (fixedTime || !isActive) return;
    setTimeStr(formatTime(use24h));
    const interval = setInterval(() => {
      setTimeStr(formatTime(use24h));
    }, 60000);
    return () => clearInterval(interval);
  }, [isActive, fixedTime, use24h]);

  if (!isActive) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-ui-deep flex flex-col items-center justify-center cursor-pointer"
      onClick={onDismiss}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') onDismiss?.(); }}
      tabIndex={0}
      role="button"
      aria-label="Dismiss sleep screen"
    >
      <Moon className="text-ui-muted w-12 h-12 mb-4" />
      <h1 className="text-6xl font-light text-ui-secondary tracking-wider">
        {timeStr}
      </h1>
    </div>
  );
}
