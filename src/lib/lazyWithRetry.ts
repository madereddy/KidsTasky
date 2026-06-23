import { lazy } from 'react';

export const lazyWithRetry = <T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  key: string
) => lazy(async () => {
  const retryKey = `kidtasker:lazy-retry:${key}`;
  try {
    const mod = await importer();
    sessionStorage.removeItem(retryKey);
    return mod;
  } catch (error) {
    if (sessionStorage.getItem(retryKey) !== '1') {
      sessionStorage.setItem(retryKey, '1');
      if (typeof window !== 'undefined') {
        if ('serviceWorker' in navigator) {
          try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((r) => r.update().catch(() => undefined)));
          } catch {}
        }
        if ('caches' in window) {
          try {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          } catch {}
        }
      }
      window.location.reload();
    }
    throw error;
  }
});

export const safePrefetch = (importer: () => Promise<unknown>) => {
  importer().catch(() => undefined);
};
