import { logger } from '../lib/logger.js';

export const MAX_NOTIFICATION_CONCURRENCY = 4;

export async function runWithConcurrency<T>(
  items: T[],
  workerFn: (item: T) => Promise<void>,
  concurrency = MAX_NOTIFICATION_CONCURRENCY
) {
  const queue = [...items];
  const runners = new Array(Math.max(1, concurrency)).fill(null).map(async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) return;
      try {
        await workerFn(item);
      } catch (e) {
        logger.error({ error: e }, 'worker_async_item_failed');
      }
    }
  });
  await Promise.all(runners);
}
