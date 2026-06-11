
import { db } from './src/server/db.js';
import { listsService } from './src/server/modules/lists/service.ts';
import { randomUUID } from 'crypto';

async function test() {
  console.log('Starting gap reproduction test...');

  const parentId = 'repro-parent-' + randomUUID();
  const list = listsService.createList(parentId, 'Test List', 'shopping');
  console.log('Created test list:', list.id);

  // Add items to stats
  const items = ['Milk', 'Bread', 'Eggs'];
  for (const item of items) {
    // Add multiple times to ensure they are frequent
    listsService.addItem(list.id, item);
    listsService.addItem(list.id, item);
  }

  console.log('Verifying all items are in frequent list...');
  let frequent = listsService.getFrequentItems(parentId, 5);
  console.log('Frequent items:', frequent);
  if (!frequent.includes('milk') || !frequent.includes('bread') || !frequent.includes('eggs')) {
    throw new Error('Initial frequent items missing');
  }

  console.log('Adding Milk to the list (incomplete)...');
  // addItem already added Milk twice above, let's keep it there.
  // The current implementation returns it even if it is on the list.

  frequent = listsService.getFrequentItems(parentId, 5);
  console.log('Frequent items after adding Milk:', frequent);
  
  if (frequent.includes('milk')) {
    console.log('GAP REPRODUCED: "milk" is still in frequent items even though it is active on the list.');
  } else {
    console.log('GAP NOT REPRODUCED: "milk" was filtered out.');
  }

  // Complete milk and see if it returns
  console.log('Completing all items on the list...');
  const listItems = listsService.getListItems(list.id);
  for (const item of listItems) {
    listsService.toggleItem(item.id, true);
  }

  frequent = listsService.getFrequentItems(parentId, 5);
  console.log('Frequent items after completing all:', frequent);
  if (frequent.includes('milk')) {
    console.log('Correct: "milk" is back in frequent items after being completed.');
  } else {
    throw new Error('"milk" should be back in frequent items after completion');
  }

  console.log('Reproduction script finished.');
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
