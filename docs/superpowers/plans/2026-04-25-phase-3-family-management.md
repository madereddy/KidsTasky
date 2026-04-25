# Phase 3 Family Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce "smart display" appliance features including universal list management, parental lock controls, and sleep mode scheduling.

**Architecture:** We will create a `lists` schema and API for universal lists (Groceries/To-Dos). We will extend the `family_settings` schema to include a PIN, Sleep Start, and Sleep End time. Frontend components will be introduced that wrap the application in a pin-gate and dim the screen globally during sleep hours.

**Tech Stack:** React, Express/SQLite (Backend), Vitest, Supertest, Tailwind CSS.

---

### Task 1: Lists Database Schema & Service

**Files:**
- Create: `src/server/migrations/005_add_lists_schema.sql`
- Create: `src/server/modules/lists/service.ts`
- Create: `src/server/modules/lists/db.test.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/server/modules/lists/db.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { db } from '../../db.js';

describe('Lists Database Schema', () => {
  it('should create and retrieve a list with items', () => {
    const listStmt = db.prepare(`INSERT INTO lists (id, parentId, title) VALUES (?, ?, ?)`);
    listStmt.run('list_1', 'parent_lists_1', 'Groceries');
    
    const itemStmt = db.prepare(`INSERT INTO list_items (id, listId, text, completed) VALUES (?, ?, ?, ?)`);
    itemStmt.run('item_1', 'list_1', 'Milk', 0);
    
    const listRow = db.prepare('SELECT * FROM lists WHERE id = ?').get('list_1') as any;
    const itemRow = db.prepare('SELECT * FROM list_items WHERE listId = ?').get('list_1') as any;
    
    expect(listRow.title).toBe('Groceries');
    expect(itemRow.text).toBe('Milk');
    expect(itemRow.completed).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/modules/lists/db.test.ts`
Expected: FAIL with "no such table: lists"

- [ ] **Step 3: Write minimal implementation**

```sql
-- src/server/migrations/005_add_lists_schema.sql
CREATE TABLE IF NOT EXISTS lists (
  id TEXT PRIMARY KEY,
  parentId TEXT,
  title TEXT
);

CREATE TABLE IF NOT EXISTS list_items (
  id TEXT PRIMARY KEY,
  listId TEXT,
  text TEXT,
  completed INTEGER DEFAULT 0
);

UPDATE schema_version SET version = 5;
```

```typescript
// Add to src/types.ts (Append at bottom)
export interface AppList {
  id: string;
  parentId: string;
  title: string;
}

export interface AppListItem {
  id: string;
  listId: string;
  text: string;
  completed: number; 
}
```

```typescript
// src/server/modules/lists/service.ts
import { db } from '../../db.js';
import { AppList, AppListItem } from '../../../types.js';

export const listsService = {
  getLists: (parentId: string): AppList[] => {
    return db.prepare('SELECT * FROM lists WHERE parentId = ?').all(parentId) as AppList[];
  },
  getListItems: (listId: string): AppListItem[] => {
    return db.prepare('SELECT * FROM list_items WHERE listId = ?').all(listId) as AppListItem[];
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/modules/lists/db.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/migrations/005_add_lists_schema.sql src/server/modules/lists/service.ts src/server/modules/lists/db.test.ts src/types.ts
git commit -m "feat: add schema and service structure for universal lists"
```

---

### Task 2: Lists API Routes

**Files:**
- Create: `src/server/modules/lists/routes.ts`
- Create: `src/server/modules/lists/api.test.ts`
- Modify: `src/server/routes.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/server/modules/lists/api.test.ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../../../server.js';
import { listsService } from './service.js';

vi.mock('./service.js', () => ({
  listsService: {
    getLists: vi.fn().mockReturnValue([{ id: 'list_xyz', parentId: 'parent_qwe', title: 'Todos' }]),
    getListItems: vi.fn().mockReturnValue([{ id: 'item_abc', listId: 'list_xyz', text: 'Clean room', completed: 0 }])
  }
}));

describe('Lists API', () => {
  it('should return lists for parent and items for a list', async () => {
    const listRes = await request(app).get('/api/parents/parent_qwe/lists');
    expect(listRes.status).toBe(200);
    expect(listRes.body[0].title).toBe('Todos');

    const itemRes = await request(app).get('/api/lists/list_xyz/items');
    expect(itemRes.status).toBe(200);
    expect(itemRes.body[0].text).toBe('Clean room');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/modules/lists/api.test.ts`
Expected: FAIL with 404

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/server/modules/lists/routes.ts
import { Router } from 'express';
import { listsService } from './service.js';

export const listsRouter = Router();

listsRouter.get('/api/parents/:parentId/lists', (req, res) => {
  try {
    const lists = listsService.getLists(req.params.parentId);
    res.json(lists);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

listsRouter.get('/api/lists/:listId/items', (req, res) => {
  try {
    const items = listsService.getListItems(req.params.listId);
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

```typescript
// Modify src/server/routes.ts
// ADD IMPORT AT TOP:
import { listsRouter } from './modules/lists/routes.js';

// ADD BEFORE `export const apiRouter = router;`:
router.use(listsRouter);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/modules/lists/api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/modules/lists/routes.ts src/server/modules/lists/api.test.ts src/server/routes.ts
git commit -m "feat: implement lists and list items API endpoints"
```

---

### Task 3: Settings Schema Updates (Parental PIN & Sleep Mode)

**Files:**
- Create: `src/server/migrations/006_update_family_settings.sql`
- Create: `src/server/modules/settings/features.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/server/modules/settings/features.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { db } from '../../db.js';

describe('Settings Schema Extension for Lock and Sleep', () => {
  it('should allow inserting pin, sleepStart, and sleepEnd into family_settings', () => {
    // Delete if exists
    db.prepare('DELETE FROM family_settings WHERE parentId = ?').run('parent_ext_1');
    const stmt = db.prepare(`
      INSERT INTO family_settings (parentId, locationLat, locationLon, timezone, pin, sleepStart, sleepEnd) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Testing specific lock config: 1234, sleep from 22:00 to 06:00
    stmt.run('parent_ext_1', 0, 0, 'UTC', '1234', '22:00', '06:00');
    
    const row = db.prepare('SELECT pin, sleepStart, sleepEnd FROM family_settings WHERE parentId = ?').get('parent_ext_1') as any;
    expect(row.pin).toBe('1234');
    expect(row.sleepStart).toBe('22:00');
    expect(row.sleepEnd).toBe('06:00');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/modules/settings/features.test.ts`
Expected: FAIL (table family_settings has no column named pin)

- [ ] **Step 3: Write minimal implementation**

```sql
-- src/server/migrations/006_update_family_settings.sql
ALTER TABLE family_settings ADD COLUMN pin TEXT DEFAULT NULL;
ALTER TABLE family_settings ADD COLUMN sleepStart TEXT DEFAULT '22:00';
ALTER TABLE family_settings ADD COLUMN sleepEnd TEXT DEFAULT '06:00';

UPDATE schema_version SET version = 6;
```

```typescript
// Append to src/types.ts -> FamilySettings Interface
// Ensure these map correctly. DO NOT append blindly if it causes duplicate declaration.
// For the sake of the plan, execute a search and replace in types.ts.
// Since we don't have direct find+replace in exact script form easily, we update manually or via sed.
// We expect the worker to update the FamilySettings interface to include:
// pin?: string | null;
// sleepStart?: string;
// sleepEnd?: string;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/modules/settings/features.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/migrations/006_update_family_settings.sql src/server/modules/settings/features.test.ts
git commit -m "feat: add schema fields for parental PIN and sleep schedule"
```

---

### Task 4: Parental Lock PinPad UI Component

**Files:**
- Create: `src/components/parent/PinPad.tsx`
- Create: `src/components/parent/PinPad.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/parent/PinPad.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PinPad } from './PinPad';

describe('PinPad', () => {
  it('calls onComplete with entered pin', () => {
    const onComplete = vi.fn();
    render(<PinPad onComplete={onComplete} />);
    
    // the pinpad should have digit buttons
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('2'));
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByText('4'));
    
    expect(onComplete).toHaveBeenCalledWith('1234');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/parent/PinPad.test.tsx`
Expected: FAIL due to missing file

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/parent/PinPad.tsx
import React, { useState, useEffect } from 'react';

export function PinPad({ onComplete }: { onComplete: (pin: string) => void }) {
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (pin.length === 4) {
      onComplete(pin);
      setPin(''); // Reset after submission attempts
    }
  }, [pin, onComplete]);

  const handlePress = (digit: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + digit);
    }
  };

  return (
    <div className="flex flex-col items-center bg-gray-900 p-6 rounded-2xl max-w-xs mx-auto">
      <h3 className="text-white font-medium mb-4">Enter Parental PIN</h3>
      <div className="flex gap-3 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={\`w-4 h-4 rounded-full border-2 \${i < pin.length ? 'bg-white border-white' : 'border-gray-500'}\`}></div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {['1','2','3','4','5','6','7','8','9'].map(d => (
          <button key={d} onClick={() => handlePress(d)} className="w-16 h-16 rounded-full bg-gray-800 text-white text-xl font-medium focus:bg-gray-700 hover:bg-gray-700">
            {d}
          </button>
        ))}
        <div></div>
        <button onClick={() => handlePress('0')} className="w-16 h-16 rounded-full bg-gray-800 text-white text-xl font-medium focus:bg-gray-700 hover:bg-gray-700">
          0
        </button>
        <button onClick={() => setPin(prev => prev.slice(0, -1))} className="w-16 h-16 rounded-full bg-transparent text-gray-400 text-lg font-medium">
          DEL
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/parent/PinPad.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/parent/PinPad.tsx src/components/parent/PinPad.test.tsx
git commit -m "feat: create Parental Lock PinPad widget"
```

---

### Task 5: Sleep Mode Overlay Component

**Files:**
- Create: `src/components/shared/SleepModeOverlay.tsx`
- Create: `src/components/shared/SleepModeOverlay.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/shared/SleepModeOverlay.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SleepModeOverlay } from './SleepModeOverlay';

describe('SleepModeOverlay', () => {
  it('renders a dark overlay with clock when active', () => {
    // using a fixed string since we bypass dynamic Date() for test stability
    render(<SleepModeOverlay isActive={true} fixedTime="10:00 PM" />);
    expect(screen.getByText('10:00 PM')).toBeInTheDocument();
  });

  it('renders nothing when not active', () => {
    const { container } = render(<SleepModeOverlay isActive={false} fixedTime="10:00 PM" />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/shared/SleepModeOverlay.test.tsx`
Expected: FAIL due to missing file

- [ ] **Step 3: Write minimal implementation**

```tsx
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
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
      <Moon className="text-gray-500 w-12 h-12 mb-4" />
      <h1 className="text-6xl font-light text-gray-400 tracking-wider">
        {timeStr}
      </h1>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/shared/SleepModeOverlay.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/SleepModeOverlay.tsx src/components/shared/SleepModeOverlay.test.tsx
git commit -m "feat: implement global SleepMode screen overlay"
```

---

### Task 6: List Sidebar Component

**Files:**
- Create: `src/components/lists/ListSidebar.tsx`
- Create: `src/components/lists/ListSidebar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/lists/ListSidebar.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ListSidebar } from './ListSidebar';

describe('ListSidebar', () => {
  it('renders list items and handles toggle', () => {
    const onToggle = vi.fn();
    const items = [{ id: '1', listId: 'l1', text: 'Apples', completed: 0 }];
    
    render(<ListSidebar listTitle="Groceries" items={items} onToggleItem={onToggle} isOpen={true} />);
    
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('Apples')).toBeInTheDocument();
    
    // Find checkbox input and click
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    
    expect(onToggle).toHaveBeenCalledWith('1', true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/lists/ListSidebar.test.tsx`
Expected: FAIL due to missing file

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/lists/ListSidebar.tsx
import React from 'react';
import { X } from 'lucide-react';
import { AppListItem } from '../../types';

interface Props {
  listTitle: string;
  items: AppListItem[];
  isOpen: boolean;
  onToggleItem: (id: string, isCompleted: boolean) => void;
  onClose?: () => void;
}

export function ListSidebar({ listTitle, items, isOpen, onToggleItem, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl border-l z-40 transform transition-transform duration-300">
      <div className="p-4 border-b flex justify-between items-center bg-gray-50">
        <h2 className="text-xl font-bold">{listTitle}</h2>
        {onClose && (
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
            <X size={20} />
          </button>
        )}
      </div>
      
      <div className="p-4 overflow-y-auto max-h-[calc(100vh-70px)]">
        {items.length === 0 ? (
          <p className="text-gray-400 text-center mt-10">No items.</p>
        ) : (
          <ul className="space-y-3">
            {items.map(item => (
              <li key={item.id} className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  checked={item.completed === 1}
                  onChange={(e) => onToggleItem(item.id, e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={item.completed === 1 ? 'line-through text-gray-400' : 'text-gray-800'}>
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/lists/ListSidebar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/lists/ListSidebar.tsx src/components/lists/ListSidebar.test.tsx
git commit -m "feat: implement sliding sidebar for universal lists"
```
