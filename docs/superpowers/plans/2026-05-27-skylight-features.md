# Skylight Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap between KidsTasky and Skylight by adding kid calendar view, chore chart grid, homework tracking, event RSVP/attendees, and kiosk mode.

**Architecture:** Five independent phases — each ships working, testable software on its own. No phase depends on another. Work any order. Each phase follows the existing pattern: SQL migration → service → routes → client service → React component.

**Tech Stack:** React 19, TypeScript, Express 5, better-sqlite3, Tailwind CSS v4, Vitest + supertest, date-fns, lucide-react

---

## File Map

| Phase | Creates | Modifies |
|-------|---------|---------|
| 1 – Kid Calendar | — | `App.tsx`, `KidDashboard.tsx` |
| 2 – Chore Chart | `src/components/parent/ChoreChart.tsx` | `src/components/parent/ParentDashboard.tsx` |
| 3 – Homework | `036_add_homework.sql`, `src/server/modules/homework/{service,routes}.ts`, `src/services/homework.ts`, `src/components/homework/{HomeworkView,AddHomeworkModal}.tsx` | `src/server/routes.ts`, `App.tsx`, `src/types.ts` |
| 4 – RSVP | `037_add_event_attendees.sql` | `src/types.ts`, `src/server/modules/events/{service,routes}.ts`, `src/services/events.ts`, `src/components/calendar/{AddEventModal,EventDetailModal,QuickAddModal}.tsx` |
| 5 – Kiosk | `src/hooks/useFullscreen.ts`, `src/hooks/useWakeLock.ts` | `src/components/calendar/CalendarView.tsx`, `App.tsx` |

---

## Phase 1: Kid Calendar View

Kids land on their task board today. Skylight shows kids the shared family calendar. This phase adds a "Calendar" tab to `KidDashboard` that renders `CalendarView` in read-only mode.

**Key facts:**
- `CalendarView` already accepts `isLocked` (read-only) and `userRole` props
- A kid's API calls use `profile.parentId` (their family group key), not `profile.uid`
- `App.tsx` already has `kids` and `memberColorMap` in state — just not passed to `KidDashboard`

### Task 1.1: Pass kids/memberColorMap into KidDashboard

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/kid/KidDashboard.tsx`

- [ ] **Step 1: Update KidDashboard props interface**

In `src/components/kid/KidDashboard.tsx`, add to the props interface:

```tsx
import { UserProfile } from '../../types';
// ...existing imports...
import { CalendarView } from '../calendar/CalendarView';

// Add to existing props interface:
  kids: UserProfile[];
  memberColorMap: Record<string, string>;
```

- [ ] **Step 2: Add calendar tab state to KidDashboard**

Inside `KidDashboard`, add after existing `useState` declarations:

```tsx
const [kidView, setKidView] = useState<'tasks' | 'calendar'>('tasks');
```

- [ ] **Step 3: Add Calendar tab buttons to KidDashboard header area**

Find the section in `KidDashboard.tsx` that renders the streak/XP header row. Add tab switcher below it (before the `KidTaskBoard` render):

```tsx
<div className="flex gap-1 p-1 rounded-2xl bg-ui-soft-2 mb-4 w-fit">
  <button
    onClick={() => setKidView('tasks')}
    className={cn(
      'px-4 py-2 rounded-xl text-sm font-semibold transition-all',
      kidView === 'tasks'
        ? `bg-${currentTheme.primary} text-white shadow-sm`
        : (isDarkMode ? 'text-ui-secondary hover:text-white' : 'text-ui-muted hover:text-ui-primary')
    )}
  >
    {currentTheme.vocab?.hub || 'My Chores'}
  </button>
  <button
    onClick={() => setKidView('calendar')}
    className={cn(
      'px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5',
      kidView === 'calendar'
        ? `bg-${currentTheme.primary} text-white shadow-sm`
        : (isDarkMode ? 'text-ui-secondary hover:text-white' : 'text-ui-muted hover:text-ui-primary')
    )}
  >
    <CalendarDays className="w-4 h-4" /> Calendar
  </button>
</div>
```

Add `CalendarDays` to the existing lucide-react import at the top.

- [ ] **Step 4: Conditionally render CalendarView for kids**

Wrap existing `KidTaskBoard` render with conditional, add CalendarView branch:

```tsx
{kidView === 'tasks' && (
  // ...existing KidTaskBoard JSX...
)}
{kidView === 'calendar' && (
  <CalendarView
    parentId={profile.parentId || profile.uid}
    kids={kids}
    memberColorMap={memberColorMap}
    isLocked={true}
    userRole="kid"
  />
)}
```

- [ ] **Step 5: Update App.tsx to pass kids/memberColorMap to KidDashboard**

Find the `<KidDashboard ...>` render in `App.tsx` and add two props:

```tsx
<KidDashboard
  profile={profile}
  onProgressChange={setProgress}
  categories={categories}
  selectedCategoryId={selectedCategoryId}
  onProfileUpdate={handleProfileUpdate}
  kids={kids}
  memberColorMap={memberColorMap}
/>
```

Note: `kids` is already fetched for parents, but for a kid user the `kids` array in `App.tsx` stays empty (`[]`). That's fine — the calendar still loads events via `parentId`; kids just won't see the member filter bar (it only renders when `kids.length > 0`).

- [ ] **Step 6: Verify in browser**
  - Log in as a kid
  - Confirm "Calendar" tab appears next to the tasks tab
  - Confirm calendar loads family events in read-only mode (no "+ Quick Add" button)
  - Confirm clicking an event opens `EventDetailModal` with no edit controls

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/kid/KidDashboard.tsx
git commit -m "feat: add calendar view tab to kid dashboard"
```

---

## Phase 2: Chore Chart Grid View

Skylight's signature feature is a `Kid × Chore` matrix grid. Each cell shows a checkbox. This is a pure frontend addition — it uses the same `tasks` data already loaded in `ParentDashboard`.

**Key facts:**
- `tasks` array in `ParentDashboard` has `assignedToId` (nullable) and category info
- A task with `null` assignedToId is "up for grabs" — show in a special first column
- We only need to add a toggle button and a new component; no API changes

### Task 2.1: Build ChoreChart component

**Files:**
- Create: `src/components/parent/ChoreChart.tsx`

- [ ] **Step 1: Write a failing test**

Create `src/components/parent/ChoreChart.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { ChoreChart } from './ChoreChart';
import { Task, UserProfile, Category } from '../../types';

const kids: UserProfile[] = [
  { uid: 'k1', name: 'Alice', role: 'kid', parentId: 'p1', xp: 0, stars: 0 } as UserProfile,
  { uid: 'k2', name: 'Bob',   role: 'kid', parentId: 'p1', xp: 0, stars: 0 } as UserProfile,
];
const tasks: Task[] = [
  { id: 't1', title: 'Dishes', assignedKidId: 'k1', parentId: 'p1', status: 'active' } as unknown as Task,
  { id: 't2', title: 'Vacuum', assignedKidId: null,  parentId: 'p1', status: 'active' } as unknown as Task,
];

it('renders kid names as column headers', () => {
  render(<ChoreChart tasks={tasks} kids={kids} categories={[]} />);
  expect(screen.getByText('Alice')).toBeInTheDocument();
  expect(screen.getByText('Bob')).toBeInTheDocument();
});

it('renders task titles as row headers', () => {
  render(<ChoreChart tasks={tasks} kids={kids} categories={[]} />);
  expect(screen.getByText('Dishes')).toBeInTheDocument();
  expect(screen.getByText('Vacuum')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npx vitest run src/components/parent/ChoreChart.test.tsx
```

Expected: fail with "cannot find module"

- [ ] **Step 3: Create ChoreChart component**

```tsx
// src/components/parent/ChoreChart.tsx
import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { Category, Task, UserProfile } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  tasks: Task[];
  kids: UserProfile[];
  categories: Category[];
  memberColorMap?: Record<string, string>;
}

export function ChoreChart({ tasks, kids, categories, memberColorMap = {} }: Props) {
  const activeTasks = tasks.filter((t) => t.status !== 'archived');

  if (activeTasks.length === 0 || kids.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-ui-muted text-sm">
        No tasks or kids to display.
      </div>
    );
  }

  const getCategoryColor = (catId?: string | null) => {
    if (!catId) return '#6366f1';
    return categories.find((c) => c.id === catId)?.color || '#6366f1';
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-ui bg-white shadow-sm">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-ui-soft">
            <th className="text-left px-4 py-3 font-semibold text-ui-secondary min-w-[180px] border-b border-ui">
              Chore
            </th>
            {kids.map((kid) => {
              const color = memberColorMap[kid.uid] ?? '#6366f1';
              return (
                <th key={kid.uid} className="px-4 py-3 font-semibold text-center border-b border-ui min-w-[100px]">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: color }}
                    >
                      {kid.name[0].toUpperCase()}
                    </div>
                    <span className="text-xs text-ui-secondary">{kid.name}</span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {activeTasks.map((task, idx) => (
            <tr
              key={task.id}
              className={cn('transition-colors', idx % 2 === 0 ? 'bg-white' : 'bg-ui-soft/40')}
            >
              <td className="px-4 py-3 font-medium text-ui-primary border-r border-ui">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: getCategoryColor(task.categoryId) }}
                  />
                  {task.title}
                </div>
              </td>
              {kids.map((kid) => {
                const assigned = task.assignedKidId === kid.uid;
                const color = memberColorMap[kid.uid] ?? '#6366f1';
                return (
                  <td key={kid.uid} className="px-4 py-3 text-center border-r border-ui last:border-r-0">
                    {assigned ? (
                      <CheckCircle2
                        className="w-5 h-5 mx-auto"
                        style={{ color }}
                      />
                    ) : (
                      <Circle className="w-5 h-5 mx-auto text-ui-soft-3" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run test — verify PASS**

```bash
npx vitest run src/components/parent/ChoreChart.test.tsx
```

### Task 2.2: Integrate ChoreChart into ParentDashboard

**Files:**
- Modify: `src/components/parent/ParentDashboard.tsx`

- [ ] **Step 1: Find ParentDashboard and locate where ParentTaskBoard renders**

Search for `<ParentTaskBoard` in `src/components/parent/ParentDashboard.tsx`.

- [ ] **Step 2: Add view toggle state and import**

At top of `ParentDashboard.tsx`:

```tsx
import { ChoreChart } from './ChoreChart';
// ...
const [taskDisplayMode, setTaskDisplayMode] = useState<'list' | 'chart'>('list');
```

- [ ] **Step 3: Add toggle buttons above the task board**

Directly above where `<ParentTaskBoard` renders, add:

```tsx
<div className="flex justify-end mb-3">
  <div className={cn('flex gap-1 p-1 rounded-xl', isDarkMode ? 'bg-ui-dark-50' : 'bg-ui-soft-2')}>
    <button
      onClick={() => setTaskDisplayMode('list')}
      className={cn(
        'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1',
        taskDisplayMode === 'list' ? 'bg-sky-500 text-white shadow-sm' : (isDarkMode ? 'text-ui-secondary' : 'text-ui-muted')
      )}
    >
      <List className="w-3.5 h-3.5" /> List
    </button>
    <button
      onClick={() => setTaskDisplayMode('chart')}
      className={cn(
        'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1',
        taskDisplayMode === 'chart' ? 'bg-sky-500 text-white shadow-sm' : (isDarkMode ? 'text-ui-secondary' : 'text-ui-muted')
      )}
    >
      <Grid3x3 className="w-3.5 h-3.5" /> Chart
    </button>
  </div>
</div>
```

Add `List, Grid3x3` to the lucide-react import.

- [ ] **Step 4: Conditionally render ChoreChart vs ParentTaskBoard**

```tsx
{taskDisplayMode === 'list' ? (
  <ParentTaskBoard ... />
) : (
  <ChoreChart
    tasks={tasks}
    kids={kids}
    categories={categories}
    memberColorMap={memberColorMap}
  />
)}
```

`ParentDashboard` will need `kids` and `memberColorMap` as props if not already present — check and add to its Props interface and the call site in `App.tsx` if missing.

- [ ] **Step 5: Verify in browser**
  - Log in as parent, confirm "List | Chart" toggle appears
  - Switch to Chart, confirm grid shows kids as columns and tasks as rows
  - Assigned tasks show colored check, unassigned show grey circle

- [ ] **Step 6: Commit**

```bash
git add src/components/parent/ChoreChart.tsx src/components/parent/ChoreChart.test.tsx src/components/parent/ParentDashboard.tsx
git commit -m "feat: add chore chart grid view to parent task board"
```

---

## Phase 3: Homework Tracking

Separate from chores. Subject + due date + notes + assignee. Visible to both parents (manage) and kids (view their own).

**Key facts:**
- New DB table `homework` — same `parentId` scoping pattern as everything else
- New nav section `'homework'` added to `App.tsx`
- Kid view shows only homework assigned to them (filtered client-side)
- Follow the exact module pattern of `src/server/modules/events/`

### Task 3.1: DB migration

**Files:**
- Create: `src/server/migrations/036_add_homework.sql`

- [ ] **Step 1: Write migration**

```sql
CREATE TABLE IF NOT EXISTS homework (
  id TEXT PRIMARY KEY,
  parentId TEXT NOT NULL,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  notes TEXT,
  dueDate TEXT NOT NULL,           -- YYYY-MM-DD
  assignedToId TEXT,               -- NULL = all kids
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | done
  color TEXT NOT NULL DEFAULT '#6366f1',
  createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_homework_parent ON homework(parentId);
CREATE INDEX IF NOT EXISTS idx_homework_due ON homework(dueDate);
```

- [ ] **Step 2: Verify migration auto-runs**

The DB in `src/server/db.ts` reads all `*.sql` files from the migrations folder on startup. No additional wiring needed — confirm by reading `src/server/db.ts` to verify the pattern.

### Task 3.2: Add Homework type

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add Homework interface after existing interfaces**

```ts
export interface Homework {
  id: string;
  parentId: string;
  title: string;
  subject: string;
  notes?: string;
  dueDate: string;          // YYYY-MM-DD
  assignedToId?: string;
  status: 'pending' | 'done';
  color: string;
  createdAt: number;
}
```

### Task 3.3: Backend service + routes

**Files:**
- Create: `src/server/modules/homework/service.ts`
- Create: `src/server/modules/homework/routes.ts`
- Create: `src/server/modules/homework/api.test.ts`

- [ ] **Step 1: Write failing API test first**

```ts
// src/server/modules/homework/api.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../../../server.js';

let token: string;
let parentId: string;

beforeEach(async () => {
  const reg = await request(app)
    .post('/api/auth/register')
    .send({ email: `hw${Date.now()}@test.com`, password: 'pass', name: 'Parent' });
  token = reg.body.token;
  parentId = reg.body.user.uid;
});

describe('homework API', () => {
  it('creates and retrieves homework', async () => {
    const create = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Math worksheet',
        subject: 'Math',
        dueDate: '2026-06-01',
        color: '#6366f1',
      });
    expect(create.status).toBe(200);
    expect(create.body.id).toBeTruthy();

    const list = await request(app)
      .get(`/api/parents/${parentId}/homework`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].title).toBe('Math worksheet');
  });

  it('marks homework as done', async () => {
    const { body: { id } } = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Reading', subject: 'English', dueDate: '2026-06-01', color: '#6366f1' });

    const patch = await request(app)
      .patch(`/api/homework/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'done' });
    expect(patch.status).toBe(200);
  });

  it('deletes homework', async () => {
    const { body: { id } } = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Science notes', subject: 'Science', dueDate: '2026-06-01', color: '#6366f1' });

    const del = await request(app)
      .delete(`/api/homework/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npx vitest run src/server/modules/homework/api.test.ts
```

Expected: 404 on all routes.

- [ ] **Step 3: Write service**

```ts
// src/server/modules/homework/service.ts
import { db } from '../../db.js';
import { Homework } from '../../../types.js';
import { randomUUID } from 'crypto';

export const homeworkService = {
  create(data: Omit<Homework, 'id' | 'createdAt'>): string {
    const id = 'hw_' + randomUUID();
    db.prepare(`
      INSERT INTO homework (id, parentId, title, subject, notes, dueDate, assignedToId, status, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.parentId, data.title, data.subject, data.notes ?? null,
           data.dueDate, data.assignedToId ?? null, data.status ?? 'pending', data.color);
    return id;
  },

  getByParent(parentId: string): Homework[] {
    return db.prepare('SELECT * FROM homework WHERE parentId = ? ORDER BY dueDate ASC')
      .all(parentId) as Homework[];
  },

  getById(id: string): Homework | undefined {
    return db.prepare('SELECT * FROM homework WHERE id = ?').get(id) as Homework | undefined;
  },

  update(id: string, parentId: string, fields: Partial<Homework>): boolean {
    const allowed = ['title', 'subject', 'notes', 'dueDate', 'assignedToId', 'status', 'color'] as const;
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const key of allowed) {
      if (key in fields) { sets.push(`${key} = ?`); vals.push((fields as any)[key]); }
    }
    if (sets.length === 0) return false;
    vals.push(id, parentId);
    const r = db.prepare(`UPDATE homework SET ${sets.join(', ')} WHERE id = ? AND parentId = ?`).run(...vals);
    return r.changes > 0;
  },

  delete(id: string, parentId: string): boolean {
    const r = db.prepare('DELETE FROM homework WHERE id = ? AND parentId = ?').run(id, parentId);
    return r.changes > 0;
  },
};
```

- [ ] **Step 4: Write routes**

```ts
// src/server/modules/homework/routes.ts
import { Router } from 'express';
import { homeworkService } from './service.js';
import { authenticateUser, getParentId } from '../../middleware/auth.js';

export const homeworkRouter = Router();

homeworkRouter.post('/homework', authenticateUser, (req, res) => {
  try {
    const parentId = getParentId(req);
    const { title, subject, notes, dueDate, assignedToId, color } = req.body;
    if (!title || !subject || !dueDate) return res.status(400).json({ error: 'title, subject, dueDate required' });
    const id = homeworkService.create({ parentId, title, subject, notes, dueDate, assignedToId, color: color || '#6366f1', status: 'pending' });
    res.json({ id });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

homeworkRouter.get('/parents/:parentId/homework', authenticateUser, (req, res) => {
  try {
    const userParentId = getParentId(req);
    if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
    res.json(homeworkService.getByParent(req.params.parentId));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

homeworkRouter.patch('/homework/:id', authenticateUser, (req, res) => {
  try {
    const parentId = getParentId(req);
    const ok = homeworkService.update(req.params.id, parentId, req.body);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

homeworkRouter.delete('/homework/:id', authenticateUser, (req, res) => {
  try {
    const parentId = getParentId(req);
    const ok = homeworkService.delete(req.params.id, parentId);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 5: Register router in src/server/routes.ts**

Open `src/server/routes.ts` (NOT `server.ts`). All individual routers are registered here via `router.use(...)` so that the Socket.IO stale-data broadcaster middleware wraps homework mutations. Add:

```ts
import { homeworkRouter } from './modules/homework/routes.js';
// ...
router.use(homeworkRouter);
```

Add the import alongside the other module imports and the `router.use` alongside the other `router.use` calls.

- [ ] **Step 6: Run tests — verify PASS**

```bash
npx vitest run src/server/modules/homework/api.test.ts
```

- [ ] **Step 7: Commit backend**

```bash
git add src/server/migrations/036_add_homework.sql src/server/modules/homework/ src/types.ts server.ts
git commit -m "feat: add homework backend — migration, service, routes"
```

### Task 3.4: Client service

**Files:**
- Create: `src/services/homework.ts`

- [ ] **Step 1: Write client service**

```ts
// src/services/homework.ts
import { Homework } from '../types';

const token = () => localStorage.getItem('kidtasker_token') || '';
const h = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

export const homeworkClientService = {
  async getHomework(parentId: string): Promise<Homework[]> {
    const r = await fetch(`/api/parents/${parentId}/homework`, { headers: h() });
    if (!r.ok) return [];
    return r.json();
  },
  async createHomework(data: Omit<Homework, 'id' | 'createdAt'>): Promise<{ id: string }> {
    const r = await fetch('/api/homework', { method: 'POST', headers: h(), body: JSON.stringify(data) });
    return r.json();
  },
  async updateHomework(id: string, fields: Partial<Homework>): Promise<void> {
    await fetch(`/api/homework/${id}`, { method: 'PATCH', headers: h(), body: JSON.stringify(fields) });
  },
  async deleteHomework(id: string): Promise<void> {
    await fetch(`/api/homework/${id}`, { method: 'DELETE', headers: h() });
  },
};
```

### Task 3.5: Frontend components

**Files:**
- Create: `src/components/homework/AddHomeworkModal.tsx`
- Create: `src/components/homework/HomeworkView.tsx`

- [ ] **Step 1: AddHomeworkModal**

```tsx
// src/components/homework/AddHomeworkModal.tsx
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { homeworkClientService } from '../../services/homework';
import { UserProfile } from '../../types';
import { cn } from '../../lib/utils';

const SUBJECTS = ['Math', 'English', 'Science', 'History', 'Art', 'Music', 'PE', 'Other'];
const COLORS   = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

interface Props {
  parentId: string;
  kids: UserProfile[];
  onClose: () => void;
  onCreated: () => void;
}

export function AddHomeworkModal({ parentId, kids, onClose, onCreated }: Props) {
  const [title, setTitle]           = useState('');
  const [subject, setSubject]       = useState(SUBJECTS[0]);
  const [dueDate, setDueDate]       = useState('');
  const [notes, setNotes]           = useState('');
  const [assignedToId, setAssigned] = useState('');
  const [color, setColor]           = useState(COLORS[0]);
  const [saving, setSaving]         = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;
    setSaving(true);
    await homeworkClientService.createHomework({
      parentId, title: title.trim(), subject, dueDate,
      notes: notes.trim() || undefined,
      assignedToId: assignedToId || undefined,
      color, status: 'pending',
    });
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-ui">
          <h2 className="text-lg font-bold text-ui-primary">Add Homework</h2>
          <button onClick={onClose} className="p-1 hover:bg-ui-soft rounded-full"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <input
            type="text" placeholder="Assignment title" required
            value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border border-ui bg-ui-soft focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          <div className="flex gap-2 flex-wrap">
            {SUBJECTS.map((s) => (
              <button key={s} type="button" onClick={() => setSubject(s)}
                className={cn('px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
                  subject === s ? 'bg-sky-500 text-white border-sky-500' : 'border-ui text-ui-secondary hover:bg-ui-soft')}
              >{s}</button>
            ))}
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-ui-muted uppercase tracking-wide">Due Date</label>
              <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-ui bg-ui-soft focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
            {kids.length > 0 && (
              <div className="flex-1">
                <label className="text-xs font-semibold text-ui-muted uppercase tracking-wide">Assigned to</label>
                <select value={assignedToId} onChange={(e) => setAssigned(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-ui bg-ui-soft focus:outline-none focus:ring-2 focus:ring-sky-400"
                >
                  <option value="">Everyone</option>
                  {kids.map((k) => <option key={k.uid} value={k.uid}>{k.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="w-full px-4 py-2 rounded-xl border border-ui bg-ui-soft focus:outline-none resize-none"
          />
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className={cn('w-7 h-7 rounded-full transition-all', color === c ? 'ring-2 ring-offset-2 ring-sky-500 scale-110' : '')}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-ui text-ui-secondary hover:bg-ui-soft text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 rounded-xl bg-sky-500 text-white text-sm font-bold hover:bg-sky-600 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: HomeworkView**

```tsx
// src/components/homework/HomeworkView.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, BookOpen, CheckCircle2, Circle, Trash2, Calendar } from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { homeworkClientService } from '../../services/homework';
import { Homework, UserProfile } from '../../types';
import { cn } from '../../lib/utils';
import { AddHomeworkModal } from './AddHomeworkModal';
import { useSocketStaleData } from '../../hooks/useSocket';

interface Props {
  parentId: string;
  kids: UserProfile[];
  userRole: 'parent' | 'kid';
  currentUserId?: string;
}

export function HomeworkView({ parentId, kids, userRole, currentUserId }: Props) {
  const [homework, setHomework] = useState<Homework[]>([]);
  const [showAdd, setShowAdd]   = useState(false);

  const fetchHomework = useCallback(async () => {
    const data = await homeworkClientService.getHomework(parentId);
    setHomework(data);
  }, [parentId]);

  useEffect(() => { fetchHomework(); }, [fetchHomework]);
  useSocketStaleData(fetchHomework);

  const visible = userRole === 'parent'
    ? homework
    : homework.filter((h) => !h.assignedToId || h.assignedToId === currentUserId);

  const pending = visible.filter((h) => h.status === 'pending');
  const done    = visible.filter((h) => h.status === 'done');

  const toggle = async (hw: Homework) => {
    const next = hw.status === 'done' ? 'pending' : 'done';
    await homeworkClientService.updateHomework(hw.id, { status: next });
    fetchHomework();
  };

  const del = async (id: string) => {
    await homeworkClientService.deleteHomework(id);
    fetchHomework();
  };

  const getKidName = (uid?: string) => uid ? (kids.find((k) => k.uid === uid)?.name ?? uid) : 'Everyone';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-100">
            <BookOpen className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-ui-primary">Homework</h2>
            <p className="text-xs text-ui-muted">{pending.length} pending · {done.length} done</p>
          </div>
        </div>
        {userRole === 'parent' && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-500 text-white rounded-xl text-sm font-bold hover:bg-sky-600 transition-colors"
          >
            <Plus size={16} /> Add
          </button>
        )}
      </div>

      {pending.length === 0 && done.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-ui-muted gap-3">
          <BookOpen className="w-12 h-12 opacity-20" />
          <p className="font-semibold">No homework yet</p>
        </div>
      )}

      {pending.length > 0 && (
        <section>
          <p className="text-xs font-bold uppercase tracking-widest text-ui-muted mb-3">Pending</p>
          <div className="flex flex-col gap-2">
            {pending.map((hw) => {
              const overdue = isPast(parseISO(hw.dueDate)) && hw.status === 'pending';
              return (
                <div key={hw.id}
                  className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-ui shadow-sm hover:shadow-md transition-shadow"
                  style={{ borderLeftColor: hw.color, borderLeftWidth: 4 }}
                >
                  <button onClick={() => toggle(hw)} className="shrink-0">
                    <Circle className="w-5 h-5 text-ui-soft-3 hover:text-sky-400 transition-colors" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ui-primary truncate">{hw.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: hw.color + '22', color: hw.color }}>{hw.subject}</span>
                      <span className={cn('text-xs flex items-center gap-1', overdue ? 'text-rose-500 font-semibold' : 'text-ui-muted')}>
                        <Calendar size={11} />{format(parseISO(hw.dueDate), 'MMM d')}{overdue ? ' · Overdue' : ''}
                      </span>
                      <span className="text-xs text-ui-muted">{getKidName(hw.assignedToId)}</span>
                    </div>
                  </div>
                  {userRole === 'parent' && (
                    <button onClick={() => del(hw.id)} className="p-1.5 text-ui-muted hover:text-rose-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <p className="text-xs font-bold uppercase tracking-widest text-ui-muted mb-3">Completed</p>
          <div className="flex flex-col gap-2 opacity-60">
            {done.map((hw) => (
              <div key={hw.id} className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-ui">
                <button onClick={() => toggle(hw)} className="shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ui-primary line-through truncate">{hw.title}</p>
                  <span className="text-xs text-ui-muted">{hw.subject} · {getKidName(hw.assignedToId)}</span>
                </div>
                {userRole === 'parent' && (
                  <button onClick={() => del(hw.id)} className="p-1.5 text-ui-muted hover:text-rose-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {showAdd && (
        <AddHomeworkModal parentId={parentId} kids={kids} onClose={() => setShowAdd(false)} onCreated={fetchHomework} />
      )}
    </div>
  );
}
```

### Task 3.6: Wire into App.tsx navigation

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add homework to activeSection type and default**

```tsx
// Change type declaration:
const [activeSection, setActiveSection] = useState<'tasks' | 'calendar' | 'lists' | 'meals' | 'homework'>('calendar');
```

- [ ] **Step 2: Add Homework nav button** (parent nav section, after Meals button):

```tsx
import { BookOpen } from 'lucide-react';
// ...
<button
  onClick={() => setActiveSection('homework')}
  className={cn(
    'px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5',
    activeSection === 'homework' ? cn(`bg-${currentTheme.primary} text-white shadow-sm`) : (isDarkTheme ? 'text-ui-secondary hover:text-white' : 'text-ui-muted hover:text-ui-primary')
  )}
>
  <BookOpen className="w-4 h-4" /> Homework
</button>
```

- [ ] **Step 3: Add lazy import and render block**

```tsx
const HomeworkView = lazy(() => import('./components/homework/HomeworkView').then((m) => ({ default: m.HomeworkView })));

// In AnimatePresence block, after meals section:
{profile.role === 'parent' && activeSection === 'homework' && (
  <motion.div key="homework-view" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}>
    <HomeworkView parentId={profile.uid} kids={kids} userRole="parent" />
  </motion.div>
)}
```

- [ ] **Step 4: Add homework section to KidDashboard**

In `KidDashboard.tsx`, add a third tab "Homework" and render `HomeworkView` for kids:

```tsx
// Tab button:
<button onClick={() => setKidView('homework')} className={cn(...)}>
  <BookOpen className="w-4 h-4" /> Homework
</button>

// Render:
{kidView === 'homework' && (
  <HomeworkView
    parentId={profile.parentId || profile.uid}
    kids={[]}
    userRole="kid"
    currentUserId={profile.uid}
  />
)}
```

- [ ] **Step 5: Verify end-to-end**
  - Parent can add homework, set subject/due date/assignee
  - Kid sees only their assigned homework
  - Checking off homework updates status immediately
  - Overdue items show in red

- [ ] **Step 6: Commit frontend**

```bash
git add src/services/homework.ts src/components/homework/ src/App.tsx src/components/kid/KidDashboard.tsx
git commit -m "feat: add homework tracking view for parents and kids"
```

---

## Phase 4: Event RSVP / Attendees

Events currently support `assignedToId` (one person). This phase adds a proper `event_attendees` join table so an event can have multiple attendees, each with an RSVP status (`pending | yes | no | maybe`).

**Key facts:**
- Keep `assignedToId` on the events table for backwards compatibility and single-assignee fast-path
- `event_attendees` is additive — no existing events break
- Kids RSVP through `EventDetailModal` (already has kid-accessible read path)

### Task 4.1: DB migration

**Files:**
- Create: `src/server/migrations/037_add_event_attendees.sql`

- [ ] **Step 1: Write migration**

```sql
CREATE TABLE IF NOT EXISTS event_attendees (
  id TEXT PRIMARY KEY,
  eventId TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  userId TEXT NOT NULL,
  rsvp TEXT NOT NULL DEFAULT 'pending',  -- pending | yes | no | maybe
  UNIQUE(eventId, userId)
);

CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON event_attendees(eventId);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user  ON event_attendees(userId);
```

### Task 4.2: Update types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add EventAttendee interface and update CalendarEvent**

```ts
export type RsvpStatus = 'pending' | 'yes' | 'no' | 'maybe';

export interface EventAttendee {
  id: string;
  eventId: string;
  userId: string;
  rsvp: RsvpStatus;
  name?: string;   // joined from users table on read
}

// In CalendarEvent interface, add:
  attendees?: EventAttendee[];
```

### Task 4.3: Backend — attendee service methods

**Files:**
- Modify: `src/server/modules/events/service.ts`
- Modify: `src/server/modules/events/routes.ts`
- Modify: `src/server/modules/events/api.test.ts`

- [ ] **Step 1: Write failing tests for attendee endpoints**

Add to `src/server/modules/events/api.test.ts`:

```ts
describe('event attendees', () => {
  it('adds attendees to an event and lists them', async () => {
    // create a parent + kid
    const parentReg = await request(app).post('/api/auth/register')
      .send({ email: `pa${Date.now()}@t.com`, password: 'x', name: 'Pa' });
    const parentToken = parentReg.body.token;
    const parentId = parentReg.body.user.uid;

    // create event
    const ev = await request(app).post('/api/events')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ title: 'Trip', startTime: Date.now(), endTime: Date.now() + 3600000, color: '#6366f1' });
    const eventId = ev.body.ids[0];

    // add attendee
    const add = await request(app).post(`/api/events/${eventId}/attendees`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ userId: parentId });
    expect(add.status).toBe(200);

    // list attendees via GET /events
    const list = await request(app)
      .get(`/api/parents/${parentId}/events`)
      .set('Authorization', `Bearer ${parentToken}`);
    const found = list.body.find((e: any) => e.id === eventId);
    expect(found.attendees).toHaveLength(1);
    expect(found.attendees[0].userId).toBe(parentId);
  });

  it('updates own RSVP', async () => {
    const reg = await request(app).post('/api/auth/register')
      .send({ email: `rsvp${Date.now()}@t.com`, password: 'x', name: 'User' });
    const token = reg.body.token;
    const uid = reg.body.user.uid;

    const ev = await request(app).post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Party', startTime: Date.now(), endTime: Date.now() + 3600000, color: '#6366f1' });
    const eventId = ev.body.ids[0];

    await request(app).post(`/api/events/${eventId}/attendees`)
      .set('Authorization', `Bearer ${token}`).send({ userId: uid });

    const rsvp = await request(app).patch(`/api/events/${eventId}/attendees/${uid}`)
      .set('Authorization', `Bearer ${token}`).send({ rsvp: 'yes' });
    expect(rsvp.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npx vitest run src/server/modules/events/api.test.ts
```

- [ ] **Step 3: Add attendee methods to eventsService**

First update the import at the top of `src/server/modules/events/service.ts`:

```ts
// Change:
import { CalendarEvent } from '../../../types.js';
// To:
import { CalendarEvent, EventAttendee } from '../../../types.js';
```

Then add to the `eventsService` object:

```ts
// Add to eventsService object in service.ts:
  addAttendee(eventId: string, userId: string): void {
    const id = 'att_' + randomUUID();
    db.prepare(`INSERT OR IGNORE INTO event_attendees (id, eventId, userId) VALUES (?, ?, ?)`)
      .run(id, eventId, userId);
  },

  updateRsvp(eventId: string, userId: string, rsvp: string): boolean {
    const r = db.prepare(`UPDATE event_attendees SET rsvp = ? WHERE eventId = ? AND userId = ?`)
      .run(rsvp, eventId, userId);
    return r.changes > 0;
  },

  removeAttendee(eventId: string, userId: string): void {
    db.prepare(`DELETE FROM event_attendees WHERE eventId = ? AND userId = ?`).run(eventId, userId);
  },

  getAttendeesForEvent(eventId: string): EventAttendee[] {
    return db.prepare(`
      SELECT ea.*, u.name FROM event_attendees ea
      LEFT JOIN users u ON u.uid = ea.userId
      WHERE ea.eventId = ?
    `).all(eventId) as EventAttendee[];
  },
```

- [ ] **Step 4: Update getEventsByParent to join attendees**

In `service.ts`, update `getEventsByParent` to attach attendees to each event:

```ts
getEventsByParent(parentId: string): CalendarEvent[] {
  const events = db.prepare('SELECT * FROM events WHERE parentId = ?').all(parentId) as CalendarEvent[];
  const attendeeMap = new Map<string, EventAttendee[]>();
  const allAttendees = db.prepare(`
    SELECT ea.*, u.name FROM event_attendees ea
    LEFT JOIN users u ON u.uid = ea.userId
    WHERE ea.eventId IN (SELECT id FROM events WHERE parentId = ?)
  `).all(parentId) as EventAttendee[];
  for (const att of allAttendees) {
    if (!attendeeMap.has(att.eventId)) attendeeMap.set(att.eventId, []);
    attendeeMap.get(att.eventId)!.push(att);
  }
  return events.map((e) => ({ ...e, attendees: attendeeMap.get(e.id) ?? [] }));
},
```

- [ ] **Step 5: Add attendee routes to eventsRouter**

```ts
// Add to routes.ts:
eventsRouter.post('/events/:id/attendees', authenticateUser, (req, res) => {
  try {
    const parentId = getParentId(req);
    const event = eventsService.getEventById(req.params.id);
    if (!event || event.parentId !== parentId) return res.status(403).json({ error: 'Forbidden' });
    eventsService.addAttendee(req.params.id, req.body.userId);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

eventsRouter.patch('/events/:id/attendees/:userId', authenticateUser, (req, res) => {
  try {
    const { rsvp } = req.body;
    if (!['pending', 'yes', 'no', 'maybe'].includes(rsvp)) return res.status(400).json({ error: 'Invalid rsvp' });
    const ok = eventsService.updateRsvp(req.params.id, req.params.userId, rsvp);
    if (!ok) return res.status(404).json({ error: 'Attendee not found' });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

eventsRouter.delete('/events/:id/attendees/:userId', authenticateUser, (req, res) => {
  try {
    eventsService.removeAttendee(req.params.id, req.params.userId);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 6: Run tests — verify PASS**

```bash
npx vitest run src/server/modules/events/api.test.ts
```

- [ ] **Step 7: Commit backend**

```bash
git add src/server/migrations/037_add_event_attendees.sql src/server/modules/events/ src/types.ts
git commit -m "feat: add event attendees and RSVP backend"
```

### Task 4.4: Frontend — RSVP UI in EventDetailModal

**Files:**
- Modify: `src/components/calendar/EventDetailModal.tsx`
- Modify: `src/services/events.ts`

- [ ] **Step 1: Add attendee client methods to events service**

Open `src/services/events.ts` and add:

```ts
async addAttendee(eventId: string, userId: string): Promise<void> {
  await fetch(`/api/events/${eventId}/attendees`, {
    method: 'POST', headers: h(), body: JSON.stringify({ userId }),
  });
},
async updateRsvp(eventId: string, userId: string, rsvp: string): Promise<void> {
  await fetch(`/api/events/${eventId}/attendees/${userId}`, {
    method: 'PATCH', headers: h(), body: JSON.stringify({ rsvp }),
  });
},
async removeAttendee(eventId: string, userId: string): Promise<void> {
  await fetch(`/api/events/${eventId}/attendees/${userId}`, {
    method: 'DELETE', headers: h(),
  });
},
```

- [ ] **Step 2: Add attendees section to EventDetailModal**

Open `src/components/calendar/EventDetailModal.tsx`. Inside the modal body, after the existing event details, add an attendees section:

```tsx
// At top of file, add to imports:
import { eventsClientService } from '../../services/events';
import { UserCheck, UserX, UserMinus, HelpCircle, UserPlus } from 'lucide-react';

// Inside the component, after existing state:
const attendees = event.attendees ?? [];

const RSVP_OPTIONS = [
  { value: 'yes',     label: 'Yes',     icon: UserCheck,  color: 'text-emerald-500 bg-emerald-50 border-emerald-200' },
  { value: 'no',      label: 'No',      icon: UserX,      color: 'text-rose-500 bg-rose-50 border-rose-200' },
  { value: 'maybe',   label: 'Maybe',   icon: HelpCircle, color: 'text-amber-500 bg-amber-50 border-amber-200' },
] as const;

// In JSX, add an attendees section before the close button:
{attendees.length > 0 && (
  <div className="border-t border-ui pt-4 mt-4">
    <p className="text-xs font-bold uppercase tracking-widest text-ui-muted mb-3">Attendees</p>
    <div className="flex flex-col gap-2">
      {attendees.map((att) => (
        <div key={att.userId} className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-ui-secondary">{att.name ?? att.userId}</span>
          <div className="flex gap-1">
            {RSVP_OPTIONS.map(({ value, label, icon: Icon, color }) => (
              <button
                key={value}
                onClick={() => eventsClientService.updateRsvp(event.id, att.userId, value).then(onUpdated)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors',
                  att.rsvp === value ? color : 'bg-white border-ui text-ui-muted hover:bg-ui-soft'
                )}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 3: Add "invite attendee" button for parents in EventDetailModal**

After the attendees list (parents only, not locked):

```tsx
{userRole === 'parent' && !isLocked && (
  <div className="mt-2">
    <p className="text-xs font-semibold text-ui-muted mb-1">Add attendee</p>
    <div className="flex gap-2 flex-wrap">
      {kids
        .filter((k) => !attendees.find((a) => a.userId === k.uid))
        .map((k) => (
          <button
            key={k.uid}
            onClick={() => eventsClientService.addAttendee(event.id, k.uid).then(onUpdated)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-ui-soft border border-ui hover:bg-sky-50 hover:border-sky-300 transition-colors"
          >
            <UserPlus size={11} /> {k.name}
          </button>
        ))}
    </div>
  </div>
)}
```

- [ ] **Step 4: Verify RSVP flow end-to-end**
  - Create event as parent
  - Open event detail, add a kid as attendee
  - Switch to kid login, open the same event, confirm RSVP buttons appear
  - Click "Yes" — confirm RSVP persists on reload

- [ ] **Step 5: Commit frontend**

```bash
git add src/services/events.ts src/components/calendar/EventDetailModal.tsx
git commit -m "feat: add attendee list and RSVP controls to event detail modal"
```

---

## Phase 5: Kiosk Mode

Wall mode exists but still requires browser chrome. Kiosk mode requests fullscreen + screen wake lock so the app runs on a mounted tablet without the browser UI showing.

**Key facts:**
- Fullscreen API: `document.documentElement.requestFullscreen()` / `document.exitFullscreen()`
- Screen Wake Lock API: `navigator.wakeLock.request('screen')` — must re-request after `visibilitychange`
- Both are browser APIs — no DB or server changes needed
- ESC naturally exits fullscreen (browser default) — we also add an in-app exit button

### Task 5.1: useFullscreen hook

**Files:**
- Create: `src/hooks/useFullscreen.ts`

- [ ] **Step 1: Write hook**

```ts
// src/hooks/useFullscreen.ts
import { useState, useEffect, useCallback } from 'react';

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const enter = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  const exit = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }
  }, []);

  const toggle = useCallback(() => (isFullscreen ? exit() : enter()), [isFullscreen, enter, exit]);

  return { isFullscreen, enter, exit, toggle };
}
```

### Task 5.2: useWakeLock hook

**Files:**
- Create: `src/hooks/useWakeLock.ts`

- [ ] **Step 1: Write hook**

```ts
// src/hooks/useWakeLock.ts
import { useEffect, useRef } from 'react';

export function useWakeLock(active: boolean) {
  const lockRef = useRef<any>(null);  // WakeLockSentinel not in all TS DOM lib versions

  const acquire = async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      lockRef.current = await (navigator as any).wakeLock.request('screen');
    } catch (_) { /* permission denied or not supported */ }
  };

  const release = async () => {
    if (lockRef.current) {
      await lockRef.current.release().catch(() => {});
      lockRef.current = null;
    }
  };

  useEffect(() => {
    if (active) {
      acquire();
      // Re-acquire after tab becomes visible again (lock released on hide)
      const reacquire = () => { if (document.visibilityState === 'visible' && active) acquire(); };
      document.addEventListener('visibilitychange', reacquire);
      return () => { release(); document.removeEventListener('visibilitychange', reacquire); };
    } else {
      release();
    }
  }, [active]);
}
```

### Task 5.3: Add Kiosk button to CalendarView

**Files:**
- Modify: `src/components/calendar/CalendarView.tsx`

- [ ] **Step 1: Import hooks and add kiosk state**

```tsx
import { useFullscreen } from '../../hooks/useFullscreen';
import { useWakeLock } from '../../hooks/useWakeLock';
import { Maximize2, Minimize2 } from 'lucide-react';

// Inside CalendarView component body:
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
const [isKioskMode, setIsKioskMode] = useState(false);
useWakeLock(isKioskMode);
```

- [ ] **Step 2: Sync kiosk mode with fullscreen state**

```tsx
useEffect(() => {
  if (!isFullscreen && isKioskMode) setIsKioskMode(false);
}, [isFullscreen]);
```

- [ ] **Step 3: Add Kiosk button to the toolbar**

In the right side of the CalendarView toolbar (next to the Wall button), add:

```tsx
<button
  onClick={() => {
    const entering = !isKioskMode;
    setIsKioskMode(entering);
    if (entering) { setIsWallMode(true); toggleFullscreen(); }
    else toggleFullscreen();
  }}
  className={cn(
    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors border',
    isKioskMode
      ? 'bg-indigo-600 text-white border-indigo-600'
      : 'bg-white text-ui-secondary border-ui hover:bg-ui-soft'
  )}
  title="Toggle kiosk / fullscreen mode"
>
  {isKioskMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
  Kiosk
</button>
```

- [ ] **Step 4: Add floating exit button when in kiosk mode**

At bottom of the `CalendarView` JSX (inside the outer div, after the modal renders):

```tsx
{isKioskMode && (
  <button
    onClick={() => { setIsKioskMode(false); toggleFullscreen(); }}
    className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 bg-black/60 text-white rounded-full text-xs font-bold hover:bg-black/80 transition-colors backdrop-blur-sm"
  >
    <Minimize2 size={14} /> Exit Kiosk
  </button>
)}
```

- [ ] **Step 5: Hide App header/footer in kiosk mode**

App.tsx needs to know when kiosk mode is active to hide the top nav and footer. Options:

**Option A (simpler):** Use a CSS body class.

In `CalendarView.tsx`, toggle a body class:

```tsx
useEffect(() => {
  if (isKioskMode) document.body.classList.add('kiosk-mode');
  else document.body.classList.remove('kiosk-mode');
  return () => document.body.classList.remove('kiosk-mode');
}, [isKioskMode]);
```

In `src/index.css` (or the main CSS file), add:

```css
.kiosk-mode header,
.kiosk-mode footer {
  display: none !important;
}
```

- [ ] **Step 6: Verify kiosk flow**
  - Open Calendar tab, click "Kiosk"
  - Browser goes fullscreen, header + footer disappear, wall mode auto-activates
  - "Exit Kiosk" button visible in bottom-right corner
  - Pressing ESC exits fullscreen, kiosk mode deactivates, header/footer return
  - Screen stays on for at least 5 minutes without interaction (if device supports Wake Lock)

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useFullscreen.ts src/hooks/useWakeLock.ts src/components/calendar/CalendarView.tsx
git commit -m "feat: add kiosk mode with fullscreen and screen wake lock"
```

---

## Testing Checklist (all phases)

- [ ] `npx vitest run` — all tests pass
- [ ] `npm run lint` — no type errors
- [ ] Log in as parent: homework tab appears in nav, chore chart grid toggle works, kiosk button in calendar
- [ ] Log in as kid: Calendar tab visible in dashboard, Homework tab visible, RSVP buttons appear on events with attendees
- [ ] Kiosk mode: fullscreen enters/exits cleanly, header/footer hide, "Exit Kiosk" button always reachable

---

## Dependency Order

All five phases are independent. Suggested order for lowest risk:

```
Phase 5 (Kiosk) → Phase 2 (Chore Chart) → Phase 1 (Kid Calendar)
→ Phase 3 (Homework) → Phase 4 (RSVP)
```

Kiosk and Chore Chart are pure frontend with no migrations — lowest risk first. Homework and RSVP touch the DB and should be built with full TDD coverage.
