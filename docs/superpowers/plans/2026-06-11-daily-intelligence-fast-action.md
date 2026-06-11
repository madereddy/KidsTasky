# Daily Intelligence & Fast Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve day-to-day usability by adding a proactive Intelligence Header (Next Up ticker, Meal Plan) and a Fast Action Layer (Frequent Grocery Chips, Routine Power-Ups).

**Architecture:** We will enhance the existing `useWallHomeController` and `useMissionTodayController` hooks to provide contextual data. UI components will be updated to display a unified "Intelligence Header" and interactive "Quick-Add" chips for groceries.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide Icons, SQLite (Better-SQLite3).

---

### Task 1: Database Migration & Frequent Items Tracking

**Files:**
- Modify: `src/server/migrate.ts`
- Modify: `src/server/modules/lists/service.ts`
- Modify: `src/server/db.ts`

- [ ] **Step 1: Add usage tracking to list_items**
Update the schema to include `usageCount` in `list_items` or create a dedicated `item_stats` table for family-wide frequency.

```ts
// src/server/migrate.ts
// Add to the end of the migrations list
db.exec(`
  ALTER TABLE list_items ADD COLUMN usageCount INTEGER DEFAULT 1;
  CREATE TABLE IF NOT EXISTS item_stats (
    parentId TEXT NOT NULL,
    text TEXT NOT NULL,
    usageCount INTEGER DEFAULT 1,
    PRIMARY KEY (parentId, text)
  );
`);
```

- [ ] **Step 2: Update listsService to track usage**
Modify `addItem` and `addItemsToLists` to increment `item_stats`.

```ts
// src/server/modules/lists/service.ts
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

- [ ] **Step 3: Add Get Frequent Items to listsService**
```ts
// src/server/modules/lists/service.ts
getFrequentItems: (parentId: string, limit = 5): string[] => {
  const rows = db.prepare(`
    SELECT text FROM item_stats 
    WHERE parentId = ? 
    ORDER BY usageCount DESC 
    LIMIT ?
  `).all(parentId) as { text: string }[];
  return rows.map(r => r.text);
},
```

- [ ] **Step 4: Commit**
```bash
git add src/server/migrate.ts src/server/modules/lists/service.ts
git commit -m "feat(db): add item frequency tracking for quick-add chips"
```

---

### Task 2: Controller & Hook Enhancements

**Files:**
- Modify: `src/hooks/useWallHomeController.ts`
- Modify: `src/hooks/useMissionTodayController.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Add NextUp and Meal types**
```ts
// src/types.ts
export interface NextUpEvent {
  title: string;
  startTime: number;
  memberName: string;
  memberColor: string;
}

export interface DailyIntelligence {
  nextUp: NextUpEvent | null;
  meal: {
    id: string;
    title: string;
    imageUrl?: string;
    ingredients?: string[];
  } | null;
}
```

- [ ] **Step 2: Update useWallHomeController with NextUp logic**
```ts
// src/hooks/useWallHomeController.ts
// Add calculateNextUp function
const calculateNextUp = (events: CalendarEvent[], kids: UserProfile[], profile: UserProfile): NextUpEvent | null => {
  const now = Date.now();
  const allFamily = [profile, ...kids];
  const upcoming = events
    .filter(e => e.startTime > now && !e.isAllDay)
    .sort((a, b) => a.startTime - b.startTime);

  if (upcoming.length === 0) return null;
  const event = upcoming[0];
  const member = allFamily.find(m => m.uid === event.assignedToId) || profile;

  return {
    title: event.title,
    startTime: event.startTime,
    memberName: member.name,
    memberColor: member.color || '#6366f1'
  };
};
```

- [ ] **Step 3: Integrate into hooks**
Update the return values of `useWallHomeController` and `useMissionTodayController`.

- [ ] **Step 4: Commit**
```bash
git add src/types.ts src/hooks/useWallHomeController.ts src/hooks/useMissionTodayController.ts
git commit -m "feat(hooks): calculate NextUp event and expose in home controllers"
```

---

### Task 3: Intelligent Header Components

**Files:**
- Create: `src/components/shared/IntelligenceHeader.tsx`
- Modify: `src/components/parent/WallHome.tsx`

- [ ] **Step 1: Create IntelligenceHeader component**
Include `NextUpTicker` and `DailyMealCard`.

```tsx
// src/components/shared/IntelligenceHeader.tsx
import React from 'react';
import { Clock, Utensils } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { DailyIntelligence } from '../../types';

export function IntelligenceHeader({ data, onAddIngredients }: { data: DailyIntelligence, onAddIngredients: () => void }) {
  if (!data.nextUp && !data.meal) return null;

  return (
    <div className="flex flex-col gap-4 mb-6">
      {data.nextUp && (
        <div className="bg-ui-soft border border-ui rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-500">
            <Clock className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-ui-muted uppercase tracking-widest">Next Up</p>
            <p className="text-lg font-black">
              <span style={{ color: data.nextUp.memberColor }}>{data.nextUp.memberName}</span>: {data.nextUp.title}
            </p>
          </div>
          <div className="text-right">
             <p className="text-sm font-bold text-sky-500">{formatDistanceToNow(data.nextUp.startTime)} away</p>
          </div>
        </div>
      )}
      
      {data.meal && (
        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600">
            <Utensils className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">Tonight's Meal</p>
            <p className="text-lg font-black">{data.meal.title}</p>
          </div>
          <button 
            onClick={onAddIngredients}
            className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-amber-600 transition-colors"
          >
            + Ingredients
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Integrate into WallHome**
```tsx
// src/components/parent/WallHome.tsx
// Insert <IntelligenceHeader /> above the clock or main agenda
```

- [ ] **Step 3: Commit**
```bash
git add src/components/shared/IntelligenceHeader.tsx src/components/parent/WallHome.tsx
git commit -m "feat(ui): add Intelligence Header with NextUp and Meal Plan to WallHome"
```

---

### Task 4: Frequent Grocery Chips

**Files:**
- Create: `src/components/shared/FrequentItemChips.tsx`
- Modify: `src/components/shared/MissionTodayView.tsx`

- [ ] **Step 1: Create FrequentItemChips component**
```tsx
// src/components/shared/FrequentItemChips.tsx
import React from 'react';

export function FrequentItemChips({ items, onAdd }: { items: string[], onAdd: (item: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 px-2 no-scrollbar">
      {items.map(item => (
        <button
          key={item}
          onClick={() => onAdd(item)}
          className="whitespace-nowrap px-4 py-2 rounded-full border border-ui bg-white/50 backdrop-blur-sm text-sm font-bold hover:bg-sky-500 hover:text-white transition-all active:scale-95"
        >
          + {item}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Integrate into MissionTodayView**
```tsx
// src/components/shared/MissionTodayView.tsx
// Add <FrequentItemChips /> below the MISSION: TODAY header
```

- [ ] **Step 3: Commit**
```bash
git add src/components/shared/FrequentItemChips.tsx src/components/shared/MissionTodayView.tsx
git commit -m "feat(ui): add frequent grocery chips to Today view"
```

---

### Task 5: Routine "Power-Ups" & Expansion

**Files:**
- Modify: `src/components/shared/SwipeableRow.tsx`
- Modify: `src/components/shared/MissionTodayView.tsx`

- [ ] **Step 1: Update SwipeableRow or TaskCard for expansion**
Implement a "collapsed" and "expanded" state for routine cards.

- [ ] **Step 2: Implement progress ring for routines**
```tsx
// src/components/shared/MissionTodayView.tsx
// Inside the filteredItems map for routines:
{item.type === 'routine' && (
  <div className="relative w-8 h-8">
     {/* SVG Progress Circle here */}
  </div>
)}
```

- [ ] **Step 3: Commit**
```bash
git add src/components/shared/MissionTodayView.tsx
git commit -m "feat(ui): add routine progress rings and in-place expansion"
```
