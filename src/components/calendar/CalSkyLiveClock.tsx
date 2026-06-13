import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

export function CalSkyLiveClock({ use24h = false }: { use24h?: boolean }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  return (
    <div>
      <div className="text-6xl font-black tabular-nums leading-none text-gray-900 dark:text-white">
        {format(now, use24h ? 'H:mm' : 'h:mm')}
        {!use24h && <span className="text-2xl font-semibold ml-2 text-gray-400 dark:text-gray-500">{format(now, 'a')}</span>}
      </div>
      <div className="mt-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em]">
        {format(now, 'EEEE')}
      </div>
      <div className="text-base font-semibold text-gray-600 dark:text-gray-300 mt-0.5">
        {format(now, 'MMMM d, yyyy')}
      </div>
    </div>
  );
}
