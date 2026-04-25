# Phase 1 Core Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the primary centralized calendar view serving as the main dashboard and implement the global navigation structure for the family.

**Architecture:** We will introduce a new `events` domain in our modular backend, add local HTTP routing, and implement a pure React calendar grid UI driven by `date-fns` for robust date math. The UI will sit in standard app layout shifting dynamically between calendar and task views.

**Tech Stack:** React, Tailwind CSS, Exprss/SQLite (Backend), `date-fns` (time manipulation), Vitest (Testing), Supertest.

---

### Task 1: Add Event Data Model & Database Migration

**Files:**
- Create: `src/server/migrations/003_add_events_schema.sql`
- Modify: `src/types.ts:98-100` (append to end of file)
- Create: `src/server/modules/events/db.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/server/modules/events/db.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { db } from '../../db.js';

describe('Events Database Schema', () => {
  it('should successfully insert and retrieve an event', () => {
    const stmt = db.prepare(`
      INSERT INTO events (id, parentId, title, description, startTime, endTime, assignedToId, color) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run('evt_1', 'parent_1', 'Soccer Practice', 'Bring water', 1713950000, 1713953600, 'kid_1', '#FF0000');
    
    const row = db.prepare('SELECT * FROM events WHERE id = ?').get('evt_1') as any;
    expect(row.title).toBe('Soccer Practice');
    expect(row.color).toBe('#FF0000');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/modules/events/db.test.ts`
Expected: FAIL with "no such table: events"

- [ ] **Step 3: Write minimal implementation**

```sql
-- src/server/migrations/003_add_events_schema.sql
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  parentId TEXT,
  title TEXT,
  description TEXT,
  startTime INTEGER,
  endTime INTEGER,
  assignedToId TEXT,
  color TEXT
);

UPDATE schema_version SET version = 3;
```

```typescript
// src/types.ts (Append at the bottom of the file)
export interface CalendarEvent {
  id: string;
  parentId: string;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  assignedToId?: string;
  color: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/modules/events/db.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/migrations/003_add_events_schema.sql src/types.ts src/server/modules/events/db.test.ts
git commit -m "feat: add events table schema and typescript interfaces"
```

---

### Task 2: Events API Module

**Files:**
- Create: `src/server/modules/events/service.ts`
- Create: `src/server/modules/events/routes.ts`
- Modify: `src/server/routes.ts` (Import and use router)
- Create: `src/server/modules/events/api.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/server/modules/events/api.test.ts
// @vitest-environment node
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app, db } from '../../../../server.js';

describe('Events API', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM events').run();
  });

  afterAll(() => {
    db.close();
  });

  it('should POST and GET events for a parent', async () => {
    const postRes = await request(app)
      .post('/api/events')
      .send({
        parentId: 'parent_api_1',
        title: 'Dentist Appt',
        description: 'Teeth cleaning',
        startTime: 1713950000,
        endTime: 1713953600,
        assignedToId: 'kid_2',
        color: '#00FF00'
      });
      
    expect(postRes.status).toBe(200);
    expect(postRes.body.success).toBe(true);

    const getRes = await request(app).get('/api/parents/parent_api_1/events');
    expect(getRes.status).toBe(200);
    expect(getRes.body.length).toBe(1);
    expect(getRes.body[0].title).toBe('Dentist Appt');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/modules/events/api.test.ts`
Expected: FAIL with 404 route not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/server/modules/events/service.ts
import { db } from '../../db.js';
import { CalendarEvent } from '../../../types.js';

export const eventsService = {
  createEvent: (event: Omit<CalendarEvent, 'id'>) => {
    const id = 'evt_' + Math.random().toString(36).substring(2, 9);
    const stmt = db.prepare(`
      INSERT INTO events (id, parentId, title, description, startTime, endTime, assignedToId, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, event.parentId, event.title, event.description, event.startTime, event.endTime, event.assignedToId || null, event.color);
    return id;
  },
  
  getEventsByParent: (parentId: string): CalendarEvent[] => {
    return db.prepare('SELECT * FROM events WHERE parentId = ? ORDER BY startTime ASC').all(parentId) as CalendarEvent[];
  }
};
```

```typescript
// src/server/modules/events/routes.ts
import { Router } from 'express';
import { eventsService } from './service.js';

export const eventsRouter = Router();

eventsRouter.post('/api/events', (req, res) => {
  try {
    const id = eventsService.createEvent(req.body);
    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

eventsRouter.get('/api/parents/:parentId/events', (req, res) => {
  try {
    const events = eventsService.getEventsByParent(req.params.parentId);
    res.json(events);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

*(You must insert the following export into `src/server/routes.ts`)*
```typescript
// src/server/routes.ts (Modifications)
// ADD IMPORT AT TOP:
import { eventsRouter } from './modules/events/routes.js';

// ADD BEFORE `export const apiRouter = router;`:
router.use(eventsRouter);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/modules/events/api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/modules/events/service.ts src/server/modules/events/routes.ts src/server/routes.ts src/server/modules/events/api.test.ts
git commit -m "feat: complete events API endpoints"
```

---

### Task 3: Client HTTP Service for Events

**Files:**
- Create: `src/services/events.ts`
- Create: `src/services/events.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/events.test.ts
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { eventsClientService } from './events';

global.fetch = vi.fn();

describe('eventsClientService', () => {
  it('should call fetch to get events', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ title: 'Fetched Event' }]
    });

    const result = await eventsClientService.getEvents('parent_123');
    expect(global.fetch).toHaveBeenCalledWith('/api/parents/parent_123/events');
    expect(result[0].title).toBe('Fetched Event');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/events.test.ts`
Expected: FAIL due to missing file/export.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/services/events.ts
import { CalendarEvent } from '../types';

export const eventsClientService = {
  getEvents: async (parentId: string): Promise<CalendarEvent[]> => {
    const res = await fetch(`/api/parents/${parentId}/events`);
    if (!res.ok) throw new Error('Failed to fetch events');
    return res.json();
  },
  
  createEvent: async (event: Omit<CalendarEvent, 'id'>): Promise<{ success: boolean; id: string }> => {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
    if (!res.ok) throw new Error('Failed to create event');
    return res.json();
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/events.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/events.ts src/services/events.test.ts
git commit -m "feat: add frontend client service for fetching events"
```

---

### Task 4: UI Shared Bottom Navigation

**Files:**
- Create: `src/components/shared/BottomNav.tsx`
- Create: `src/components/shared/BottomNav.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/shared/BottomNav.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BottomNav } from './BottomNav';

describe('BottomNav', () => {
  it('renders buttons and handles clicks', () => {
    const onSelect = vi.fn();
    render(<BottomNav activeTab="calendar" onTabSelect={onSelect} />);
    
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Tasks'));
    expect(onSelect).toHaveBeenCalledWith('tasks');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/shared/BottomNav.test.tsx`
Expected: FAIL due to missing file.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/shared/BottomNav.tsx
import React from 'react';
import { Calendar, ListTodo, User } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BottomNavProps {
  activeTab: 'calendar' | 'tasks' | string;
  onTabSelect: (tab: string) => void;
  kids?: { id: string; name: string }[];
}

export function BottomNav({ activeTab, onTabSelect, kids = [] }: BottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-pb z-50">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-4">
        <button 
          onClick={() => onTabSelect('calendar')}
          className={cn("flex flex-col items-center justify-center space-y-1 w-full", activeTab === 'calendar' ? "text-blue-600" : "text-gray-500")}
        >
          <Calendar size={24} />
          <span className="text-xs font-medium">Calendar</span>
        </button>
        
        {kids.map(kid => (
          <button 
            key={kid.id}
            onClick={() => onTabSelect(\`kid_\${kid.id}\`)}
            className={cn("flex flex-col items-center justify-center space-y-1 w-full", activeTab === \`kid_\${kid.id}\` ? "text-blue-600" : "text-gray-500")}
          >
            <User size={24} />
            <span className="text-xs font-medium">{kid.name}</span>
          </button>
        ))}

        <button 
          onClick={() => onTabSelect('tasks')}
          className={cn("flex flex-col items-center justify-center space-y-1 w-full", activeTab === 'tasks' ? "text-blue-600" : "text-gray-500")}
        >
          <ListTodo size={24} />
          <span className="text-xs font-medium">Tasks</span>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/shared/BottomNav.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/BottomNav.tsx src/components/shared/BottomNav.test.tsx
git commit -m "feat: global bottom navigation component"
```

---

### Task 5: Basic Calendar Grid (Month View)

**Files:**
- Create: `src/components/calendar/CalendarMonthView.tsx`
- Create: `src/components/calendar/CalendarMonthView.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/calendar/CalendarMonthView.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CalendarMonthView } from './CalendarMonthView';

describe('CalendarMonthView', () => {
  it('renders a calendar UI indicating month view', () => {
    render(<CalendarMonthView events={[]} />);
    // Since we just want the minimal scaffold for now:
    expect(screen.getByText('Month View')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/calendar/CalendarMonthView.test.tsx`
Expected: FAIL 

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/calendar/CalendarMonthView.tsx
import React from 'react';
import { CalendarEvent } from '../../types';

export function CalendarMonthView({ events }: { events: CalendarEvent[] }) {
  // A complete month view mathematical grid will be fleshed out progressively. 
  // For now, we establish the layout boundary.
  return (
    <div className="flex-1 w-full flex flex-col p-4 bg-gray-50 pb-20">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Month View</h2>
      </div>
      <div className="grid grid-cols-7 gap-2 flex-1">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => (
          <div key={day} className="text-center font-semibold text-gray-500">{day}</div>
        ))}
        {/* Placeholder for days */}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="min-h-[80px] bg-white rounded-lg shadow-sm border border-gray-100 p-1">
            <span className="text-sm text-gray-400">{i % 30 + 1}</span>
            <div className="mt-1 space-y-1">
              {events.slice(0,1).map(ev => (
                <div key={ev.id} className="text-[10px] px-1 rounded truncate text-white" style={{ backgroundColor: ev.color }}>
                  {ev.title}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/calendar/CalendarMonthView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/CalendarMonthView.tsx src/components/calendar/CalendarMonthView.test.tsx
git commit -m "feat: foundational calendar month view layout"
```

---
