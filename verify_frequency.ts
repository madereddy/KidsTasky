
import { db } from './src/server/db.js';
import { listsService } from './src/server/modules/lists/service.ts';
import { randomUUID } from 'crypto';

async function test() {
  console.log('Starting verification test...');

  const parentId = 'test-parent-' + randomUUID();
  const list = listsService.createList(parentId, 'Test List', 'shopping');
  console.log('Created test list:', list.id);

  const items = ['Milk', 'Bread', 'Milk', 'Eggs', 'Milk', 'Bread'];
  console.log('Adding items:', items);

  for (const item of items) {
    listsService.addItem(list.id, item);
  }

  console.log('Verifying item_stats...');
  const stats = db.prepare('SELECT * FROM item_stats WHERE parentId = ? ORDER BY usageCount DESC').all(parentId) as any[];
  console.log('Stats:', stats);

  if (stats.length !== 3) {
    throw new Error(`Expected 3 unique items in stats, found ${stats.length}`);
  }

  const milkStat = stats.find(s => s.text === 'milk');
  if (!milkStat || milkStat.usageCount !== 3) {
    throw new Error(`Expected milk usageCount to be 3, found ${milkStat?.usageCount}`);
  }

  const breadStat = stats.find(s => s.text === 'bread');
  if (!breadStat || breadStat.usageCount !== 2) {
    throw new Error(`Expected bread usageCount to be 2, found ${breadStat?.usageCount}`);
  }

  console.log('Verifying getFrequentItems...');
  const frequent = listsService.getFrequentItems(parentId, 2);
  console.log('Frequent items (limit 2):', frequent);

  if (frequent.length !== 2) {
    throw new Error(`Expected 2 frequent items, found ${frequent.length}`);
  }

  if (frequent[0] !== 'milk' || frequent[1] !== 'bread') {
    throw new Error(`Expected [milk, bread], found [${frequent.join(', ')}]`);
  }

  console.log('Test passed successfully!');
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
