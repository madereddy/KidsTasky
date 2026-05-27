# Group B — Family Wall Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the KidsTasky "Wall Mode" into a production-ready home hub with sync diagnostics, per-parent calendar visibility, and a unified touch-first Quick Add panel.

**Architecture:** Extend `sync_connections` and `sync_calendars` tables to track reliability and visibility. Build a `QuickAddModal` that switches between Event, Task, and List Item modes. Polish `CalendarView` with persistent wall profiles.

**Tech Stack:** React 19, Express 5, Better-SQLite3, Lucide Icons, Date-fns

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/server/migrations/032_add_wall_profiles.sql` | Create | Table for per-user calendar visibility |
| `src/types.ts` | Modify | Add visibility types and sync status fields |
| `src/server/modules/sync/routes.ts` | Modify | Return structured sync results with diagnostics |
| `src/server/modules/settings/routes.ts` | Modify | CRUD for calendar visibility profiles |
| `src/services/settings.ts` | Modify | Client methods for visibility profiles |
| `src/components/calendar/QuickAddModal.tsx` | Create | Unified modal for events/tasks/list items |
| `src/components/calendar/CalendarView.tsx` | Modify | Integration of QuickAdd and Wall visibility profiles |
| `src/components/parent/SettingsView.tsx` | Modify | Display sync diagnostics and last sync status |

---

### Task 1: Migration 032 — Calendar Visibility Profiles

**Files:**
- Create: `src/server/migrations/032_add_wall_profiles.sql`

- [ ] **Step 1: Create migration file**

```sql
CREATE TABLE IF NOT EXISTS calendar_visibility (
  userId TEXT NOT NULL,
  calendarId TEXT NOT NULL,
  isVisible INTEGER DEFAULT 1,
  PRIMARY KEY (userId, calendarId)
);

CREATE TABLE IF NOT EXISTS user_settings (
  userId TEXT PRIMARY KEY,
  defaultWallProfile TEXT DEFAULT 'family',
  wallAutoRefresh INTEGER DEFAULT 1
);
```

- [ ] **Step 2: Verify migration runs**

Run: `pnpm run dev`
Expected: Migration 032 applies.

- [ ] **Step 3: Commit**

```bash
git add src/server/migrations/032_add_wall_profiles.sql
git commit -m "feat: migration 032 for calendar visibility profiles"
```

---

### Task 2: Sync Diagnostics API

**Files:**
- Modify: `src/server/modules/sync/routes.ts`
- Modify: `src/services/sync.ts`

- [ ] **Step 1: Update sync-now route to return full diagnostics**

The `syncGoogleConnectionNow` service already returns `SyncNowResult`. Update the route to return it instead of just `{ success: true }`.

```typescript
// In src/server/modules/sync/routes.ts
syncRouter.post('/sync/:id/now', authenticateUser, async (req, res) => {
  try {
    const connection = syncService.getConnectionById(req.params.id);
    if (!connection || connection.parentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });
    
    const result = await syncService.syncGoogleConnectionNow(connection as any);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

- [ ] **Step 2: Update client service**

```typescript
// In src/services/sync.ts
syncNow: async (id: string): Promise<SyncNowResult> => {
  return fetchAPI(`/sync/${id}/now`, { method: 'POST' });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/server/modules/sync/routes.ts src/services/sync.ts
git commit -m "feat: sync diagnostics API returns structured results"
```

---

### Task 3: Calendar Visibility API

**Files:**
- Modify: `src/server/modules/settings/routes.ts`
- Modify: `src/services/settings.ts`

- [ ] **Step 1: Add visibility routes**

```typescript
// In src/server/modules/settings/routes.ts
settingsRouter.get('/settings/visibility', authenticateUser, (req, res) => {
  const userId = (req as any).user.uid;
  const rows = db.prepare('SELECT calendarId, isVisible FROM calendar_visibility WHERE userId = ?').all(userId);
  res.json(rows);
});

settingsRouter.post('/settings/visibility', authenticateUser, (req, res) => {
  const userId = (req as any).user.uid;
  const { calendarId, isVisible } = req.body;
  db.prepare(`
    INSERT INTO calendar_visibility (userId, calendarId, isVisible)
    VALUES (?, ?, ?)
    ON CONFLICT(userId, calendarId) DO UPDATE SET isVisible = excluded.isVisible
  `).run(userId, calendarId, isVisible ? 1 : 0);
  res.json({ success: true });
});
```

- [ ] **Step 2: Commit**

```bash
git add src/server/modules/settings/routes.ts
git commit -m "feat: calendar visibility API routes"
```

---

### Task 4: Unified QuickAddModal

**Files:**
- Create: `src/components/calendar/QuickAddModal.tsx`

- [ ] **Step 1: Create the component with tabbed interface**

```tsx
import React, { useState } from 'react';
import { X, Calendar, CheckSquare, List } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AddEventModal } from './AddEventModal';
// Assume we create slim versions or reuse components

export function QuickAddModal({ onClose, onRefresh, kids, parentId }: any) {
  const [tab, setTab] = useState<'event' | 'task' | 'list'>('event');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex gap-2 p-1 bg-ui-soft rounded-xl">
            <button onClick={() => setTab('event')} className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all", tab === 'event' ? "bg-white text-blue-600 shadow-sm" : "text-ui-muted")}>
              <Calendar size={16} /> Event
            </button>
            <button onClick={() => setTab('task')} className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all", tab === 'task' ? "bg-white text-green-600 shadow-sm" : "text-ui-muted")}>
              <CheckSquare size={16} /> Task
            </button>
            <button onClick={() => setTab('list')} className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all", tab === 'list' ? "bg-white text-amber-600 shadow-sm" : "text-ui-muted")}>
              <List size={16} /> Item
            </button>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-ui-soft-2 rounded-full"><X size={20} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {tab === 'event' && (
            <div className="p-1">
               {/* Embed AddEventModal content or redirect logic */}
               <p className="p-10 text-center text-ui-muted">Event Form Integration</p>
            </div>
          )}
          {/* ... other tabs ... */}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calendar/QuickAddModal.tsx
git commit -m "feat: initial QuickAddModal with tabbed UI"
```

---

### Task 5: Settings UI — Sync Diagnostics & Visibility

**Files:**
- Modify: `src/components/parent/SettingsView.tsx`

- [ ] **Step 1: Add sync diagnostics display**

Show `lastSyncAt` and `lastSyncStatus` in the connections list. Add a "Diagnostic" button that shows the `errors[]` from the last sync result.

- [ ] **Step 2: Add Visibility toggles per calendar**

Allow parents to toggle visibility for the Wall separately from the "enabled" sync state.

- [ ] **Step 3: Commit**

```bash
git add src/components/parent/SettingsView.tsx
git commit -m "feat: Settings UI diagnostic and visibility enhancements"
```

---

### Task 6: Final Integration in CalendarView

**Files:**
- Modify: `src/components/calendar/CalendarView.tsx`

- [ ] **Step 1: Wire QuickAddModal**
- [ ] **Step 2: Apply per-parent visibility filters**
- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/CalendarView.tsx
git commit -m "feat: CalendarView integration for QuickAdd and visibility"
```
