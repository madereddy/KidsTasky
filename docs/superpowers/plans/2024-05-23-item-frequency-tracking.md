# Database Migration & Frequent Items Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement family-wide item frequency tracking to power quick-add chips in shopping and routine lists.

**Architecture:** 
- Add `usageCount` to `list_items` (legacy/per-item).
- Add `item_stats` table for family-wide tracking.
- Update `listsService` to increment stats on item addition.
- Add `getFrequentItems` to suggest common items not already on the list.

**Tech Stack:** Node.js, TypeScript, better-sqlite3

---

### Task 1: Verify and Finalize Migration

**Files:**
- Modify: `src/server/migrate.ts`

- [ ] **Step 1: Ensure migration code is correct in `src/server/migrate.ts`**

Ensure the following code is present at the end of `runMigrations`:

```typescript
  // Task 1: Add usage tracking to list_items and item_stats
  try {
    db.exec(`
      ALTER TABLE list_items ADD COLUMN usageCount INTEGER DEFAULT 1;
    `);
  } catch (err: any) {
    if (!err.message.includes('duplicate column name')) {
      throw err;
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS item_stats (
      parentId TEXT NOT NULL,
      text TEXT NOT NULL,
      usageCount INTEGER DEFAULT 1,
      PRIMARY KEY (parentId, text)
    );
  `);
```

- [ ] **Step 2: Run a script to verify migration runs successfully**

Create `scripts/verify-migration.ts`:
```typescript
import { db } from '../src/server/db.js';

try {
  const tableInfo = db.prepare("PRAGMA table_info(list_items)").all();
  const hasUsageCount = tableInfo.some((col: any) => col.name === 'usageCount');
  console.log('list_items has usageCount:', hasUsageCount);

  const itemStatsInfo = db.prepare("PRAGMA table_info(item_stats)").all();
  console.log('item_stats table exists:', itemStatsInfo.length > 0);
} catch (error) {
  console.error('Verification failed:', error);
}
```

Run: `npx tsx scripts/verify-migration.ts`

### Task 2: Verify and Finalize listsService tracking

**Files:**
- Modify: `src/server/modules/lists/service.ts`

- [ ] **Step 1: Ensure `addItem` increments `item_stats`**

Verify `addItem` in `src/server/modules/lists/service.ts` looks like:
```typescript
  addItem: (listId: string, text: string): AppListItem => {
    const id = randomUUID();
    db.prepare('INSERT INTO list_items (id, listId, text, completed) VALUES (?, ?, ?, 0)').run(id, listId, text);

    // Update frequency
    const list = listsService.getListById(listId);
    if (list) {
      db.prepare(`
        INSERT INTO item_stats (parentId, text, usageCount) 
        VALUES (?, ?, 1)
        ON CONFLICT(parentId, text) DO UPDATE SET usageCount = usageCount + 1
      `).run(list.parentId, text.toLowerCase().trim());
    }

    return { id, listId, text, completed: 0 };
  },
```

- [ ] **Step 2: Ensure `addItemsToLists` increments `item_stats`**

Verify `addItemsToLists` in `src/server/modules/lists/service.ts` looks like:
```typescript
  addItemsToLists: (listIds: string[], text: string): AppListItem[] => {
    const uniqueListIds = Array.from(new Set(listIds.filter(Boolean)));
    if (uniqueListIds.length === 0) return [];

    const lists = listsService.getListsByIds(uniqueListIds);
    if (lists.length === 0) return [];

    const parentId = lists[0].parentId;
    const normalizedText = text.toLowerCase().trim();
    const insertItem = db.prepare('INSERT INTO list_items (id, listId, text, completed) VALUES (?, ?, ?, 0)');

    // Update frequency preparation - increment by the number of lists added to
    const updateStats = db.prepare(`
      INSERT INTO item_stats (parentId, text, usageCount)
      VALUES (?, ?, ?)
      ON CONFLICT(parentId, text) DO UPDATE SET usageCount = usageCount + excluded.usageCount
    `);

    const transaction = db.transaction((ids: string[]) => {
      const items = ids.map((listId) => {
        const id = randomUUID();
        insertItem.run(id, listId, text);
        return { id, listId, text, completed: 0 } as AppListItem;
      });

      if (parentId) {
        updateStats.run(parentId, normalizedText, ids.length);
      }

      return items;
    });

    return transaction(uniqueListIds);
  },
```

### Task 3: Verify and Finalize `getFrequentItems`

**Files:**
- Modify: `src/server/modules/lists/service.ts`

- [ ] **Step 1: Ensure `getFrequentItems` is implemented correctly**

Verify `getFrequentItems` in `src/server/modules/lists/service.ts`:
```typescript
  getFrequentItems: (parentId: string, limit = 5): string[] => {
    const rows = db.prepare(`
      SELECT text FROM item_stats 
      WHERE parentId = ? 
      AND text NOT IN (
        SELECT LOWER(TRIM(li.text))
        FROM list_items li
        JOIN lists l ON li.listId = l.id
        WHERE l.parentId = ? AND li.completed = 0
      )
      ORDER BY usageCount DESC 
      LIMIT ?
    `).all(parentId, parentId, limit) as { text: string }[];
    return rows.map(r => r.text);
  },
```

### Task 4: Comprehensive Verification

**Files:**
- Create: `src/server/modules/lists/frequentItems.test.ts`

- [ ] **Step 1: Create a test for frequency tracking and filtering**

Create `src/server/modules/lists/frequentItems.test.ts` with test cases covering:
- `addItem` increments `usageCount` in `item_stats`.
- `addItemsToLists` increments `usageCount` correctly for multiple lists.
- `getFrequentItems` returns most frequent items.
- `getFrequentItems` filters out items that are currently active (incomplete) on any list.

- [ ] **Step 2: Run the test**

Run: `npm test src/server/modules/lists/frequentItems.test.ts`
Expected: PASS

- [ ] **Step 3: Update `AppListItem` type in `src/types.ts`**

Add `usageCount?: number;` to `AppListItem` interface.
