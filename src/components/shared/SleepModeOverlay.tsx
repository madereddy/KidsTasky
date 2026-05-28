// src/components/shared/SleepModeOverlay.tsx
import React, { useState, useEffect } from 'react';
import { Moon } from 'lucide-react';

export function SleepModeOverlay({ isActive, fixedTime }: { isActive: boolean; fixedTime?: string }) {
  const [timeStr, setTimeStr] = useState(fixedTime || new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));

  useEffect(() => {
    if (fixedTime || !isActive) return;
    const interval = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
    }, 60000);
    return () => clearInterval(interval);
  }, [isActive, fixedTime]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-ui-deep flex flex-col items-center justify-center">
      <Moon className="text-ui-muted w-12 h-12 mb-4" />
      <h1 className="text-6xl font-light text-ui-secondary tracking-wider">
        {timeStr}
      </h1>
    </div>
  );
}
