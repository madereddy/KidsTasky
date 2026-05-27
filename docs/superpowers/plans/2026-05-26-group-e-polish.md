# Group E: Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA installability, countdown widgets in calendar, family pinboard (single sticky note per family), and kid avatars (preset emoji or photo upload).

**Architecture:** PWA manifest + icons in `public/` — Vite serves `public/` as-is, no build changes. Countdown widgets filter the already-fetched `calendarFilteredEvents` array client-side — no new API endpoint. Family notes: single-row upsert via `ON CONFLICT(parentId)`. Avatar priority: `avatarUrl` > `avatarPreset` emoji > initial-letter fallback.

**Tech Stack:** React 19, Tailwind CSS v4, better-sqlite3, Express 5, existing `/photos/upload` API

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `public/manifest.json` | PWA manifest |
| Create | `public/icon-192.png` | PWA icon placeholder |
| Create | `public/icon-512.png` | PWA icon placeholder |
| Modify | `index.html` | Link manifest, theme-color meta |
| Modify | `src/main.tsx` | Service worker registration |
| Create | `src/server/migrations/030_add_family_notes.sql` | family_notes table |
| Create | `src/server/modules/notes/routes.ts` | GET/PUT /family-notes/:parentId |
| Create | `src/server/modules/notes/service.ts` | getNotes, upsertNote |
| Modify | `src/server/routes.ts` | register notesRouter |
| Create | `src/services/notes.ts` | client service |
| Create | `src/components/shared/FamilyNote.tsx` | pinboard sticky note component |
| Modify | `src/components/parent/ParentDashboard.tsx` | FamilyNote integration |
| Modify | `src/components/kid/KidDashboard.tsx` | FamilyNote integration |
| Modify | `src/components/calendar/CalendarView.tsx` | countdown widgets in wall mode |
| Create | `src/server/migrations/031_add_user_avatar.sql` | avatarPreset + avatarUrl columns |
| Modify | `src/server/modules/users/routes.ts` | PUT /users/:uid/avatar |
| Modify | `src/server/modules/users/service.ts` | setAvatar |
| Modify | `src/services/users.ts` | updateAvatar client method |
| Create | `src/components/shared/AvatarPicker.tsx` | preset emoji grid + photo upload |
| Modify | `src/components/parent/AddKidForm.tsx` | AvatarPicker |
| Modify | `src/components/parent/ParentDashboard.tsx` | avatar display for kids |
| Modify | `src/components/kid/KidDashboard.tsx` | avatar display for self |
| Modify | `src/components/kid/TaskCard.tsx` | avatar display |
| Modify | `src/components/calendar/AgendaView.tsx` | avatar display |
| Create | `src/server/modules/notes/api.test.ts` | notes tests |

---

### Task 1: PWA manifest and icons

**Files:**
- Create: `public/manifest.json`
- Create: `public/icon-192.png` (placeholder)
- Create: `public/icon-512.png` (placeholder)
- Modify: `index.html`
- Modify: `src/main.tsx`

- [ ] **Step 1: Write manifest.json**

```json
{
  "name": "KidsTasky",
  "short_name": "KidsTasky",
  "description": "Gamified family task manager",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Create placeholder icons**

If ImageMagick is available:

```bash
convert -size 192x192 xc:#3b82f6 -fill white -font Arial -pointsize 60 -gravity Center -annotate 0 "KT" public/icon-192.png
convert -size 512x512 xc:#3b82f6 -fill white -font Arial -pointsize 160 -gravity Center -annotate 0 "KT" public/icon-512.png
```

If not available, copy any existing PNG from the project and rename it as a placeholder. Replace with real branded icons before production deployment.

- [ ] **Step 3: Update index.html**

Add inside `<head>`:

```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#3b82f6" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="KidsTasky" />
<link rel="apple-touch-icon" href="/icon-192.png" />
```

- [ ] **Step 4: Register service worker in src/main.tsx**

```bash
cat src/main.tsx
```

Add service worker registration (Group D's `push.ts` also calls `register('/sw.js')` — browsers deduplicate registrations for the same scope):

```typescript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(console.warn);
}
```

Add before `ReactDOM.createRoot(...)`.

- [ ] **Step 5: Verify PWA in browser**

```bash
npm run dev
```

Chrome DevTools → Application → Manifest → confirm loads without errors. Stop server.

- [ ] **Step 6: Commit**

```bash
git add public/manifest.json public/icon-192.png public/icon-512.png index.html src/main.tsx
git commit -m "feat: PWA manifest, icons, and service worker registration"
```

---

### Task 2: Countdown widgets in CalendarView

**Files:**
- Modify: `src/components/calendar/CalendarView.tsx`

- [ ] **Step 1: Read CalendarView to find calendarFilteredEvents and isWallMode**

```bash
grep -n "calendarFilteredEvents\|filteredEvents\|applyWallFilter\|isWallMode\|wallMode\|isCountdown" src/components/calendar/CalendarView.tsx | head -25
```

Use **`calendarFilteredEvents`** — the array after member color + source calendar filters are applied, but **before** `applyWallFilter` (today/week/allday). Do NOT use the post-`applyWallFilter` `filteredEvents` — the wall filter strips non-allday events which would hide countdown chips in `allday` mode. Do NOT use raw `events` state — that ignores member/source filters entirely.

- [ ] **Step 2: Add countdown derivation**

Add near where `calendarFilteredEvents` (or equivalent) is derived:

```typescript
const countdownEvents = useMemo(() => {
  const now = Date.now();
  return calendarFilteredEvents  // use the already-filtered array
    .filter(e => e.isCountdown && e.startTime > now)
    .sort((a, b) => a.startTime - b.startTime)
    .slice(0, 3); // max 3 per spec
}, [calendarFilteredEvents]);

function daysUntil(ts: number): number {
  return Math.ceil((ts - Date.now()) / (1000 * 60 * 60 * 24));
}
```

- [ ] **Step 3: Render countdown strip in wall mode**

Add inside the CalendarView JSX, rendered only when `isWallMode` is true (the prop/state exists at line 50 of CalendarView):

```tsx
{isWallMode && (
  <div className="flex gap-3 px-4 py-2 overflow-x-auto min-h-[72px] items-center">
    {countdownEvents.length === 0 ? (
      <p className="text-sm text-gray-400 italic">No countdowns set.</p>
    ) : (
      countdownEvents.map(event => {
        const days = daysUntil(event.startTime);
        return (
          <div
            key={event.id}
            className="flex-shrink-0 flex items-center gap-2 rounded-xl px-4 py-2 text-white"
            style={{ backgroundColor: event.color || '#6366f1' }}
          >
            <div className="text-center">
              <span className="text-2xl font-bold">{days}</span>
              <span className="text-xs ml-1 opacity-90">day{days !== 1 ? 's' : ''}</span>
            </div>
            <div className="text-sm font-medium truncate max-w-[100px]">{event.title}</div>
          </div>
        );
      })
    )}
  </div>
)}
```

- [ ] **Step 4: Start dev server and verify visually**

```bash
npm run dev
```

Login → Calendar → create event with "Countdown" toggle enabled → switch to wall mode → confirm chip appears. Create event without countdown → confirm it doesn't appear. Stop server.

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/CalendarView.tsx
git commit -m "feat: countdown widgets in calendar wall mode"
```

---

### Task 3: Migration 030 — family_notes table

**Files:**
- Create: `src/server/migrations/030_add_family_notes.sql`

- [ ] **Step 1: Write migration**

```sql
CREATE TABLE IF NOT EXISTS family_notes (
  id TEXT PRIMARY KEY,
  parentId TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL DEFAULT '',
  updatedByName TEXT NOT NULL DEFAULT '',
  updatedAt INTEGER NOT NULL
);
```

Column notes:
- `parentId UNIQUE` enables `ON CONFLICT(parentId) DO UPDATE` upsert (single note per family)
- `updatedByName` stores the display name of who last edited (shown in component footer)
- Do NOT add `UPDATE schema_version` — migration runner is filename-based

- [ ] **Step 2: Verify migration runs**

```bash
npm run dev
```

Check logs for `Running migration: 030_add_family_notes.sql`. Stop server.

- [ ] **Step 3: Commit**

```bash
git add src/server/migrations/030_add_family_notes.sql
git commit -m "feat: migration 030 family_notes table"
```

---

### Task 4: Notes API

**Files:**
- Create: `src/server/modules/notes/service.ts`
- Create: `src/server/modules/notes/routes.ts`
- Modify: `src/server/routes.ts`
- Create: `src/server/modules/notes/api.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/server/modules/notes/api.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../../server.js';
import { db } from '../../db.js';

const SECRET = process.env.JWT_SECRET || 'test-secret';

describe('family notes', () => {
  const parentId = 'notes_test_parent';
  let token: string;

  beforeEach(() => {
    db.prepare("DELETE FROM family_notes WHERE parentId = ?").run(parentId);
    db.prepare("DELETE FROM users WHERE uid = ?").run(parentId);
    db.prepare("INSERT INTO users (uid, role, name, email, parentId, passwordHash) VALUES (?, 'parent', 'TestUser', 'notes@test.com', ?, 'x')")
      .run(parentId, parentId);
    token = jwt.sign({ uid: parentId, role: 'parent', parentId }, SECRET);
  });

  it('returns empty note for new family', async () => {
    const res = await request(app)
      .get(`/api/family-notes/${parentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.content).toBe('');
  });

  it('saves note and retrieves it with updatedByName', async () => {
    await request(app)
      .put(`/api/family-notes/${parentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Remember soccer practice Tuesday!' });

    const res = await request(app)
      .get(`/api/family-notes/${parentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.content).toBe('Remember soccer practice Tuesday!');
    expect(res.body.updatedByName).toBe('TestUser');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/server/modules/notes/api.test.ts
```

Expected: both FAIL — routes don't exist.

- [ ] **Step 3: Write service.ts**

```typescript
// src/server/modules/notes/service.ts
import { db } from '../../db.js';

export const notesService = {
  getNote: (parentId: string): { content: string; updatedByName: string; updatedAt: number } => {
    const row = db.prepare("SELECT content, updatedByName, updatedAt FROM family_notes WHERE parentId = ?")
      .get(parentId) as any;
    return row ?? { content: '', updatedByName: '', updatedAt: 0 };
  },

  upsertNote: (parentId: string, content: string, updatedByName: string): void => {
    const id = 'note_' + parentId;
    db.prepare(`
      INSERT INTO family_notes (id, parentId, content, updatedByName, updatedAt)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(parentId) DO UPDATE SET
        content = excluded.content,
        updatedByName = excluded.updatedByName,
        updatedAt = excluded.updatedAt
    `).run(id, parentId, content, updatedByName, Date.now());
  },
};
```

- [ ] **Step 4: Write routes.ts**

```typescript
// src/server/modules/notes/routes.ts
import { Router, Request, Response } from 'express';
import { param, body, validationResult } from 'express-validator';
import { notesService } from './service.js';
import { authenticateUser, getParentId } from '../../middleware/auth.js';
import { db } from '../../db.js';

export const notesRouter = Router();

const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

notesRouter.get('/family-notes/:parentId', authenticateUser, [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const userParentId = getParentId(req);
  if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
  res.json(notesService.getNote(req.params.parentId));
});

notesRouter.put('/family-notes/:parentId', authenticateUser, [
  param('parentId').isString().notEmpty(),
  body('content').isString(),
  validate
], (req: Request, res: Response) => {
  const userParentId = getParentId(req);
  if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
  const callerUid = (req as any).user.uid;
  const callerUser = db.prepare("SELECT name FROM users WHERE uid = ?").get(callerUid) as any;
  const updatedByName = callerUser?.name || 'Unknown';
  notesService.upsertNote(req.params.parentId, req.body.content ?? '', updatedByName);
  res.json({ success: true });
});
```

- [ ] **Step 5: Register notesRouter in src/server/routes.ts**

This file (`src/server/routes.ts`) is the central router hub — NOT `server.ts`. All routers are registered here and benefit from the `staleData` Socket.IO broadcast middleware.

Add:
```typescript
import { notesRouter } from './modules/notes/routes.js';
// ...
router.use(notesRouter);
```

Add the import alongside existing module imports (alphabetically or at the end). Add `router.use(notesRouter)` alongside existing `router.use(...)` calls.

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run src/server/modules/notes/api.test.ts
```

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/migrations/030_add_family_notes.sql src/server/modules/notes/ src/server/routes.ts
git commit -m "feat: family notes API (pinboard)"
```

---

### Task 5: FamilyNote component and dashboard integration

**Files:**
- Create: `src/services/notes.ts`
- Create: `src/components/shared/FamilyNote.tsx`
- Modify: `src/components/parent/ParentDashboard.tsx`
- Modify: `src/components/kid/KidDashboard.tsx`

- [ ] **Step 1: Create client service**

```typescript
// src/services/notes.ts
import { fetchAPI } from './http';

export const notesClientService = {
  getNote: (parentId: string): Promise<{ content: string; updatedByName: string; updatedAt: number }> =>
    fetchAPI(`/family-notes/${parentId}`),

  saveNote: (parentId: string, content: string): Promise<void> =>
    fetchAPI(`/family-notes/${parentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),
};
```

- [ ] **Step 2: Create FamilyNote component**

```tsx
// src/components/shared/FamilyNote.tsx
import React, { useState, useEffect, useRef } from 'react';
import { notesClientService } from '../../services/notes';

interface Props {
  parentId: string;
  readOnly?: boolean;
}

export function FamilyNote({ parentId, readOnly = false }: Props) {
  const [content, setContent] = useState('');
  const [updatedByName, setUpdatedByName] = useState('');
  const [updatedAt, setUpdatedAt] = useState(0);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    notesClientService.getNote(parentId).then(d => {
      setContent(d.content || '');
      setUpdatedByName(d.updatedByName || '');
      setUpdatedAt(d.updatedAt || 0);
    });
  }, [parentId]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setContent(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await notesClientService.saveNote(parentId, val).catch(console.warn);
      setSaving(false);
    }, 1000);
  }

  function formatRelativeTime(ts: number): string {
    if (!ts) return '';
    const diff = Date.now() - ts;
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
  }

  return (
    <div className="relative bg-yellow-50 border border-yellow-200 rounded-xl p-3 shadow-sm">
      <div className="text-xs font-semibold text-yellow-700 mb-1 flex items-center justify-between">
        <span>📌 Family Note</span>
        {saving && <span className="text-gray-400 font-normal">Saving…</span>}
      </div>
      {readOnly ? (
        <p className="text-sm whitespace-pre-wrap text-gray-700 min-h-[40px]">
          {content || <span className="text-gray-400 italic">No note yet</span>}
        </p>
      ) : (
        <textarea
          value={content}
          onChange={handleChange}
          placeholder="Write a family note…"
          rows={3}
          className="w-full text-sm bg-transparent resize-none outline-none text-gray-700 placeholder-gray-400"
        />
      )}
      {updatedByName && updatedAt > 0 && (
        <p className="text-xs text-gray-400 mt-1">
          Last updated by {updatedByName}, {formatRelativeTime(updatedAt)}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add FamilyNote to ParentDashboard**

Import and render editable:

```tsx
import { FamilyNote } from '../shared/FamilyNote';

// In JSX (e.g., sidebar or below invite code section):
<FamilyNote parentId={profile.uid} readOnly={false} />
```

- [ ] **Step 4: Add FamilyNote to KidDashboard**

Import and render read-only:

```tsx
import { FamilyNote } from '../shared/FamilyNote';

// In JSX:
<FamilyNote parentId={profile.parentId!} readOnly={true} />
```

- [ ] **Step 5: Start dev server and verify**

```bash
npm run dev
```

Login as parent → type note → auto-saves → footer shows "Last updated by [name], just now". Login as kid → note appears read-only. Stop server.

- [ ] **Step 6: Commit**

```bash
git add src/services/notes.ts src/components/shared/FamilyNote.tsx src/components/parent/ParentDashboard.tsx src/components/kid/KidDashboard.tsx
git commit -m "feat: family pinboard note on both dashboards"
```

---

### Task 6: Migration 031 — avatar columns

**Files:**
- Create: `src/server/migrations/031_add_user_avatar.sql`

- [ ] **Step 1: Write migration**

```sql
ALTER TABLE users ADD COLUMN avatarPreset TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN avatarUrl TEXT DEFAULT NULL;
```

- [ ] **Step 2: Verify migration runs**

```bash
npm run dev
```

Check logs for `Running migration: 031_add_user_avatar.sql`. Stop server.

- [ ] **Step 3: Commit**

```bash
git add src/server/migrations/031_add_user_avatar.sql
git commit -m "feat: migration 031 avatar columns"
```

---

### Task 7: Avatar API and type update

**Files:**
- Modify: `src/types.ts`
- Modify: `src/server/modules/users/service.ts`
- Modify: `src/server/modules/users/routes.ts`
- Modify: `src/services/users.ts`

- [ ] **Step 1: Add avatar fields to UserProfile type**

In `src/types.ts`, add to `UserProfile`:

```typescript
avatarPreset?: string;
avatarUrl?: string;
```

- [ ] **Step 2: Add setAvatar to users/service.ts**

```typescript
setAvatar: (uid: string, avatarPreset: string | null, avatarUrl: string | null) => {
  db.prepare("UPDATE users SET avatarPreset = ?, avatarUrl = ? WHERE uid = ?")
    .run(avatarPreset, avatarUrl, uid);
},
```

- [ ] **Step 3: Add route in users/routes.ts**

```typescript
usersRouter.put('/users/:uid/avatar', authenticateUser, [
  param('uid').isString().notEmpty(),
  body('avatarPreset').isString().optional({ nullable: true }),
  body('avatarUrl').isString().optional({ nullable: true }),
  validate
], (req: Request, res: Response) => {
  const caller = (req as any).user;
  const targetUid = req.params.uid as string;
  const callerParentId = getParentId(req);

  const target = userService.getUser(targetUid) as any;
  if (!target) return res.status(404).json({ error: 'User not found' });

  // Permission: caller must be in the same family (same parentId) OR be the target user
  const targetFamily = target.parentId ?? target.uid;
  const isSelf = caller.uid === targetUid;
  const isFamilyMember = callerParentId === targetFamily;
  if (!isSelf && !isFamilyMember) return res.status(403).json({ error: 'Forbidden' });

  const { avatarPreset = null, avatarUrl = null } = req.body;
  userService.setAvatar(targetUid, avatarPreset, avatarUrl);
  res.json({ success: true });
});
```

`authenticateUser` and `getParentId` are already imported in users/routes.ts.

- [ ] **Step 4: Add updateAvatar to src/services/users.ts**

```bash
cat src/services/users.ts | tail -20
```

Add:

```typescript
updateAvatar: (uid: string, avatarPreset: string | null, avatarUrl: string | null): Promise<void> =>
  fetchAPI(`/users/${uid}/avatar`, {
    method: 'PUT',
    body: JSON.stringify({ avatarPreset, avatarUrl }),
  }),
```

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/server/modules/users/service.ts src/server/modules/users/routes.ts src/services/users.ts
git commit -m "feat: avatar API endpoint and client method"
```

---

### Task 8: AvatarDisplay and AvatarPicker components

**Files:**
- Create: `src/components/shared/AvatarPicker.tsx`

24 preset emojis — no duplicates:

```
🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐸
🐙 🦋 🐢 🦄 🐝 🐧 🦅 🦉 🐬 🦜 🌟 🎮
```

Note: `🦋` appears only once (index 13). `🦜` (parrot) is at index 21.

- [ ] **Step 1: Write AvatarPicker.tsx**

```tsx
// src/components/shared/AvatarPicker.tsx
import React, { useRef } from 'react';
import { userService } from '../../services/users';

const PRESET_AVATARS = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊',
  '🐻', '🐼', '🐨', '🐯', '🦁', '🐸',
  '🐙', '🦋', '🐢', '🦄', '🐝', '🐧',
  '🦅', '🦉', '🐬', '🦜', '🌟', '🎮',
];

export interface AvatarState {
  avatarPreset?: string;
  avatarUrl?: string;
  name: string;
}

interface PickerProps {
  uid: string;
  current: AvatarState;
  onUpdated: (avatarPreset: string | null, avatarUrl: string | null) => void;
}

export function AvatarDisplay({ avatarPreset, avatarUrl, name, size = 40 }: AvatarState & { size?: number }) {
  const style: React.CSSProperties = { width: size, height: size };

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ ...style, borderRadius: '50%', objectFit: 'cover' }}
      />
    );
  }
  if (avatarPreset) {
    return (
      <div
        style={{ ...style, fontSize: size * 0.6, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {avatarPreset}
      </div>
    );
  }
  return (
    <div
      style={{ ...style, fontSize: size * 0.4, borderRadius: '50%', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function AvatarPicker({ uid, current, onUpdated }: PickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  // uid === '__new__' means the user hasn't been created yet — skip server call, just update local state
  const isNew = uid === '__new__';

  async function selectPreset(emoji: string) {
    if (!isNew) {
      await userService.updateAvatar(uid, emoji, null);
    }
    onUpdated(emoji, null);
  }

  async function uploadPhoto(file: File) {
    const formData = new FormData();
    formData.append('photo', file);
    const res = await fetch('/api/photos/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('kidtasker_token')}` },
      body: formData,
    });
    if (!res.ok) { console.error('Photo upload failed'); return; }
    const data = await res.json();
    // Response is a FamilyPhoto: { id, parentId, url, uploadedAt }
    if (data.url) {
      if (!isNew) {
        await userService.updateAvatar(uid, null, data.url);
      }
      onUpdated(null, data.url);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <AvatarDisplay {...current} size={48} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="text-xs text-blue-500 underline"
        >
          Upload Photo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) uploadPhoto(file);
          }}
        />
      </div>
      <div className="grid grid-cols-6 gap-2">
        {PRESET_AVATARS.map(emoji => (
          <button
            key={emoji}
            type="button"
            onClick={() => selectPreset(emoji)}
            className={`text-2xl rounded-lg p-1 hover:bg-gray-100 ${
              current.avatarPreset === emoji ? 'ring-2 ring-blue-500 bg-blue-50' : ''
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/AvatarPicker.tsx
git commit -m "feat: AvatarDisplay and AvatarPicker components"
```

---

### Task 9: Wire avatars into UI

**Files:**
- Modify: `src/components/parent/AddKidForm.tsx`
- Modify: `src/components/parent/ParentDashboard.tsx`
- Modify: `src/components/kid/KidDashboard.tsx`
- Modify: `src/components/kid/TaskCard.tsx`
- Modify: `src/components/calendar/AgendaView.tsx`

- [ ] **Step 1: Add AvatarPicker to AddKidForm**

In `src/components/parent/AddKidForm.tsx`:

```tsx
import { AvatarPicker, AvatarState } from '../shared/AvatarPicker';
import { userService } from '../../services/users';

// Add state:
const [kidAvatar, setKidAvatar] = useState<{ preset: string | null; url: string | null }>({ preset: null, url: null });

// After name input in the form:
<div className="mt-2">
  <label className="text-xs text-gray-500">Avatar (optional)</label>
  <AvatarPicker
    uid="__new__"
    current={{ avatarPreset: kidAvatar.preset ?? undefined, name: name || '?' }}
    onUpdated={(preset, url) => setKidAvatar({ preset, url })}
  />
</div>

// In submit handler, after the kid uid is returned:
if (kidAvatar.preset || kidAvatar.url) {
  await userService.updateAvatar(newKidUid, kidAvatar.preset, kidAvatar.url).catch(console.warn);
}
```

Adapt `newKidUid` to whatever variable name holds the created kid's uid after creation.

- [ ] **Step 2: Add avatar display to kid list in ParentDashboard**

Import `AvatarDisplay`:
```tsx
import { AvatarDisplay, AvatarPicker } from '../shared/AvatarPicker';
```

Add state:
```typescript
const [editingAvatarFor, setEditingAvatarFor] = useState<UserProfile | null>(null);
```

In the kids list, replace initial-letter circles with:
```tsx
<button onClick={() => setEditingAvatarFor(kid)}>
  <AvatarDisplay
    avatarPreset={kid.avatarPreset}
    avatarUrl={kid.avatarUrl}
    name={kid.name}
    size={32}
  />
</button>
```

Add avatar edit modal:
```tsx
{editingAvatarFor && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white rounded-2xl p-6 w-80">
      <h3 className="font-semibold mb-3">{editingAvatarFor.name}'s Avatar</h3>
      <AvatarPicker
        uid={editingAvatarFor.uid}
        current={editingAvatarFor}
        onUpdated={(preset, url) => {
          setKids(prev => prev.map(k =>
            k.uid === editingAvatarFor.uid
              ? { ...k, avatarPreset: preset ?? undefined, avatarUrl: url ?? undefined }
              : k
          ));
          setEditingAvatarFor(null);
        }}
      />
      <button onClick={() => setEditingAvatarFor(null)} className="mt-3 text-sm text-gray-500">Cancel</button>
    </div>
  </div>
)}
```

- [ ] **Step 3: Add avatar to KidDashboard**

```tsx
import { AvatarDisplay, AvatarPicker } from '../shared/AvatarPicker';

const [editingAvatar, setEditingAvatar] = useState(false);
// Track local avatar state so it updates without page refresh:
const [localAvatar, setLocalAvatar] = useState<{ preset?: string; url?: string }>({
  preset: profile.avatarPreset,
  url: profile.avatarUrl,
});

// In header, replace initial-letter circle with:
<button onClick={() => setEditingAvatar(true)}>
  <AvatarDisplay
    avatarPreset={localAvatar.preset ?? profile.avatarPreset}
    avatarUrl={localAvatar.url ?? profile.avatarUrl}
    name={profile.name}
    size={48}
  />
</button>

{editingAvatar && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white rounded-2xl p-6 w-80">
      <h3 className="font-semibold mb-3">My Avatar</h3>
      <AvatarPicker
        uid={profile.uid}
        current={{ ...profile, ...localAvatar, name: profile.name }}
        onUpdated={(preset, url) => {
          setLocalAvatar({ preset: preset ?? undefined, url: url ?? undefined });
          setEditingAvatar(false);
        }}
      />
      <button onClick={() => setEditingAvatar(false)} className="mt-3 text-sm text-gray-500">Cancel</button>
    </div>
  </div>
)}
```

- [ ] **Step 4: Add avatar to TaskCard**

In `src/components/kid/TaskCard.tsx`, if the kid's profile is available as a prop, add `AvatarDisplay` next to the kid's name if shown. Read the current component to understand what props are available:

```bash
grep -n "kidName\|kidId\|profile\|assignedKid" src/components/kid/TaskCard.tsx | head -10
```

If kid profile data is passed down, add:
```tsx
import { AvatarDisplay } from '../shared/AvatarPicker';

// Next to the kid name display:
<AvatarDisplay
  avatarPreset={kid?.avatarPreset}
  avatarUrl={kid?.avatarUrl}
  name={kid?.name || '?'}
  size={20}
/>
```

If kid profile isn't available in TaskCard props, skip AvatarDisplay here (don't add a new fetch inside TaskCard — pass it down from the parent).

- [ ] **Step 5: Add avatar to AgendaView**

In `src/components/calendar/AgendaView.tsx`, check if assigned member info is displayed:

```bash
grep -n "assignedTo\|member\|color\|avatar" src/components/calendar/AgendaView.tsx | head -10
```

If event assignee is shown (by name or colored dot), replace/augment with `AvatarDisplay`:

```tsx
import { AvatarDisplay } from '../shared/AvatarPicker';

// Where assignee is shown:
{assignedMember && (
  <AvatarDisplay
    avatarPreset={assignedMember.avatarPreset}
    avatarUrl={assignedMember.avatarUrl}
    name={assignedMember.name}
    size={20}
  />
)}
```

The `members` array (family members) should already be available in CalendarView and passed down as props.

- [ ] **Step 6: Start dev server and verify visually**

```bash
npm run dev
```

1. Login as parent → kid list → avatar circles show emoji/initials
2. Click kid avatar → picker opens → select emoji → avatar updates immediately
3. Login as kid → tap avatar in header → picker opens
4. Agenda view → events with assignees show avatar
Stop server.

- [ ] **Step 7: Commit**

```bash
git add src/components/parent/AddKidForm.tsx src/components/parent/ParentDashboard.tsx src/components/kid/KidDashboard.tsx src/components/kid/TaskCard.tsx src/components/calendar/AgendaView.tsx
git commit -m "feat: kid avatars wired into dashboards, TaskCard, and AgendaView"
```

---

### Task 10: Run full test suite

- [ ] **Step 1: Run all tests**

```bash
npm run test
```

Expected: all tests PASS.

- [ ] **Step 2: Type check**

```bash
npm run lint
```

Fix any type errors.

- [ ] **Step 3: Final commit if any fixes**

```bash
git add -p
git commit -m "fix: Group E type errors and test failures"
```
