import { db } from '../src/server/db.js';

try {
  const tableInfo = db.prepare("PRAGMA table_info(list_items)").all();
  const hasUsageCount = tableInfo.some((col: any) => col.name === 'usageCount');
  console.log('list_items has usageCount:', hasUsageCount);

  const itemStatsInfo = db.prepare("PRAGMA table_info(item_stats)").all();
  console.log('item_stats table exists:', itemStatsInfo.length > 0);
  
  if (itemStatsInfo.length > 0) {
      console.log('item_stats columns:', itemStatsInfo.map((c: any) => c.name).join(', '));
  }
} catch (error) {
  console.error('Verification failed:', error);
}
process.exit(0);
