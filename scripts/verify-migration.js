import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.DB_PATH || 'database.db';
const db = new Database(dbPath);

try {
  const tableInfo = db.prepare("PRAGMA table_info(list_items)").all();
  const hasUsageCount = tableInfo.some((col) => col.name === 'usageCount');
  console.log('list_items has usageCount:', hasUsageCount);

  const itemStatsInfo = db.prepare("PRAGMA table_info(item_stats)").all();
  console.log('item_stats table exists:', itemStatsInfo.length > 0);
  
  if (itemStatsInfo.length > 0) {
      console.log('item_stats columns:', itemStatsInfo.map((c) => c.name).join(', '));
  }
} catch (error) {
  console.error('Verification failed:', error);
}
db.close();
