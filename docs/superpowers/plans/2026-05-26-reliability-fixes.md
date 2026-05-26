# Reliability Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 14 reliability issues (auth gaps, data integrity bugs, frontend error handling) to make KidsTasky safe for long-term family use.

**Architecture:** Backend fixes add `authenticateUser` middleware + `getParentId()` ownership helper to all unprotected routes, enable SQLite foreign keys, and fix star accounting with proper transactions. Frontend fixes add error handling, retry logic, and socket callback stability.

**Tech Stack:** Express 5, better-sqlite3, Socket.IO, React 19, Vitest + Supertest

---

### Task 1: Database integrity — foreign keys + synchronous mode

**Files:**
- Modify: `src/server/db.ts`

- [ ] **Step 1: Add foreign_keys and fix synchronous pragma**

```typescript
// In src/server/db.ts, after line 27 (journal_mode), add:
db.pragma('foreign_keys = ON');
// And change line 28 from:
db.pragma('synchronous = NORMAL');
// To:
db.pragma('synchronous = FULL');
```

- [ ] **Step 2: Run tests to verify no FK violations in existing schema**

Run: `npx vitest run`
Expected: All tests pass (in-memory DB runs migrations fresh each time)

- [ ] **Step 3: Commit**

```
feat: enable foreign key enforcement and PRAGMA synchronous = FULL
```

---

### Task 2: Auth middleware helper — add `getParentId` utility

**Files:**
- Modify: `src/server/middleware/auth.ts`

Add a helper that extracts parentId from the JWT user, handling both parent and kid roles.

- [ ] **Step 1: Add getParentId helper to auth middleware**

```typescript
// Append to src/server/middleware/auth.ts:

export function getParentId(req: Request): string {
  const user = (req as any).user;
  return user.role === 'parent' ? user.uid : user.parentId;
}
```

- [ ] **Step 2: Commit**

```
feat: add getParentId helper to auth middleware
```

---

### Task 3: Secure events routes

**Files:**
- Modify: `src/server/modules/events/routes.ts`

All 4 routes currently have zero auth. Add `authenticateUser` + parentId ownership checks.

- [ ] **Step 1: Add auth to all event routes**

Replace entire `src/server/modules/events/routes.ts` with version that:
- Imports `authenticateUser` and `getParentId` from auth middleware
- `POST /events`: add `authenticateUser`, use `getParentId(req)` as the parentId (ignore body.parentId)
- `GET /parents/:parentId/events`: add `authenticateUser`, verify `getParentId(req) === req.params.parentId`
- `PUT /events/:id`: add `authenticateUser`, verify event.parentId matches `getParentId(req)`
- `DELETE /events/:id`: add `authenticateUser`, verify event.parentId matches `getParentId(req)`

- [ ] **Step 2: Run event tests**

Run: `npx vitest run src/server/modules/events/`
Expected: Tests pass (they already send auth tokens)

- [ ] **Step 3: Commit**

```
fix: add auth + ownership checks to all event routes
```

---

### Task 4: Secure notifications routes

**Files:**
- Modify: `src/server/modules/notifications/routes.ts`

- [ ] **Step 1: Add auth + ownership to notification routes**

- `GET /parents/:parentId/notifications`: add `authenticateUser`, verify parentId ownership
- `PUT /notifications/:id/read`: add `authenticateUser`, verify notification belongs to user's family (query notification, check parentId)

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```
fix: add auth + ownership checks to notification routes
```

---

### Task 5: Secure sync routes

**Files:**
- Modify: `src/server/modules/sync/routes.ts`

- [ ] **Step 1: Add auth to unprotected sync routes**

- `GET /settings/:parentId/connections`: add `authenticateUser`, verify parentId ownership
- `DELETE /settings/connections/:id`: add `authenticateUser`, query connection to verify parentId ownership before delete

- [ ] **Step 2: Run sync tests**

Run: `npx vitest run src/server/modules/sync/`
Expected: PASS

- [ ] **Step 3: Commit**

```
fix: add auth + ownership checks to sync routes
```

---

### Task 6: Secure task + reward routes

**Files:**
- Modify: `src/server/modules/tasks/routes.ts`
- Modify: `src/server/modules/rewards/routes.ts`

- [ ] **Step 1: Add auth + ownership to task mutation routes**

- `POST /tasks`: add `authenticateUser`, override `req.body.parentId` with `getParentId(req)`
- `POST /completions`: add `authenticateUser`, verify task belongs to user's family
- `DELETE /completions/:completionId`: add `authenticateUser`, query completion, verify kidId belongs to user's family
- `PUT /tasks/:taskId/archive`: add `authenticateUser`, verify task.parentId matches

- [ ] **Step 2: Add auth to reward mutation routes**

- `POST /rewards`: add `authenticateUser`, override parentId with `getParentId(req)`
- `DELETE /rewards/:id`: add `authenticateUser`, verify reward.parentId
- `POST /claimedRewards`: add `authenticateUser`, verify kidId belongs to user's family
- `PUT /allowances/:id/pay`: add `authenticateUser`, verify allowance.parentId

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```
fix: add auth + ownership checks to task and reward routes
```

---

### Task 7: Fix stars accounting bugs

**Files:**
- Modify: `src/server/modules/tasks/service.ts`

Three bugs:
1. `INSERT OR REPLACE` in createCompletion double-awards stars on retry
2. `deleteCompletion` never refunds stars
3. (claimReward already uses db.transaction — safe under SQLite's serialized writes)

- [ ] **Step 1: Fix createCompletion to use INSERT...ON CONFLICT DO NOTHING**

```typescript
createCompletion: (data: any) => {
  const id = `${data.taskId}_${data.dateString}_${data.count || 1}`;
  const result = db.prepare(`
    INSERT INTO completions (id, taskId, kidId, completedAt, dateString, count)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(id, data.taskId, data.kidId, Date.now(), data.dateString, data.count || null);
  // Only award stars if a row was actually inserted
  if (result.changes > 0) {
    const task = db.prepare('SELECT starValue FROM tasks WHERE id = ?').get(data.taskId) as { starValue: number } | undefined;
    const stars = task?.starValue ?? 1;
    db.prepare('UPDATE users SET earnedStars = earnedStars + ? WHERE uid = ?').run(stars, data.kidId);
  }
  return id;
},
```

- [ ] **Step 2: Fix deleteCompletion to refund stars**

```typescript
deleteCompletion: (completionId: string) => {
  const completion = db.prepare("SELECT * FROM completions WHERE id = ?").get(completionId) as any;
  if (completion) {
    const task = db.prepare('SELECT starValue FROM tasks WHERE id = ?').get(completion.taskId) as { starValue: number } | undefined;
    const stars = task?.starValue ?? 1;
    db.prepare('UPDATE users SET earnedStars = MAX(0, earnedStars - ?) WHERE uid = ?').run(stars, completion.kidId);
  }
  db.prepare("DELETE FROM completions WHERE id = ?").run(completionId);
},
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```
fix: prevent double star awards on retry, refund stars on completion delete
```

---

### Task 8: Secure Socket.IO join-room

**Files:**
- Modify: `src/server/socket.ts`

- [ ] **Step 1: Add JWT verification to join-room**

```typescript
import { Server } from "socket.io";
import jwt from 'jsonwebtoken';
import { getJwtSecret } from './config.js';

let io: Server;

export const socketWrapper = {
  init: (serverIo: Server) => {
    io = serverIo;
    io.on('connection', (socket) => {
      socket.on('join-room', (parentId: string, token?: string) => {
        try {
          if (!token) {
            console.warn(`Socket ${socket.id} join-room rejected: no token`);
            return;
          }
          const payload = jwt.verify(token, getJwtSecret()) as { uid: string; role: string; parentId: string };
          const expectedParentId = payload.role === 'parent' ? payload.uid : payload.parentId;
          if (expectedParentId !== parentId) {
            console.warn(`Socket ${socket.id} join-room rejected: parentId mismatch`);
            return;
          }
          socket.join(parentId);
          console.log(`Socket ${socket.id} joined room for parent: ${parentId}`);
        } catch (err) {
          console.warn(`Socket ${socket.id} join-room rejected: invalid token`);
        }
      });
    });
  },
  // ... emitStaleData unchanged
};
```

- [ ] **Step 2: Update client to pass token on join-room**

In `src/hooks/useSocket.ts`, update `initSocket` to pass the JWT:

```typescript
socket.on('connect', () => {
  const token = localStorage.getItem('kidtasker_token');
  socket?.emit('join-room', parentId, token);
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```
fix: require JWT auth for Socket.IO join-room
```

---

### Task 9: Fix email validation in auth routes

**Files:**
- Modify: `src/server/modules/auth/routes.ts`

- [ ] **Step 1: Add isEmail() validator and increase password minimum**

Change line 15 from:
```typescript
body('email').isString().notEmpty(),
body('password').isString().isLength({ min: 4 }),
```
To:
```typescript
body('email').isEmail(),
body('password').isString().isLength({ min: 8 }),
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: PASS (test fixtures should already use valid emails)

- [ ] **Step 3: Commit**

```
fix: validate email format and require 8+ char passwords
```

---

### Task 10: Fix IMAP connection leak in worker

**Files:**
- Modify: `src/server/worker.ts`

- [ ] **Step 1: Add try/finally around IMAP operations**

Refactor the IMAP section (lines 121-139) to use try/finally per connection:

```typescript
for (const conn of manualConns) {
  let connection;
  try {
    const config = { imap: { user: conn.email, password: conn.appPassword, host: 'imap.gmail.com', port: 993, tls: true, authTimeout: 3000 } };
    connection = await imaps.connect(config);
    await connection.openBox('INBOX');
    const messages = await connection.search(['UNSEEN'], { bodies: ['HEADER', 'TEXT'], markSeen: true });
    for (const msg of messages) {
      // ... existing message processing ...
    }
  } catch (connErr) {
    console.error(`[Worker] IMAP error for ${conn.email}:`, connErr);
  } finally {
    try { connection?.end(); } catch {}
  }
}
```

- [ ] **Step 2: Add empty response check to magic service**

In `src/server/modules/magic/service.ts`, change line 24 from:
```typescript
const parsed = JSON.parse(response.text || '{}');
```
To:
```typescript
if (!response.text) throw new Error('Empty response from Gemini API');
const parsed = JSON.parse(response.text);
```

- [ ] **Step 3: Commit**

```
fix: close IMAP connections on error, validate Gemini response
```

---

### Task 11: Fix stale socket callbacks

**Files:**
- Modify: `src/hooks/useSocket.ts`

The `listeners` array captures stale closures. Use refs instead.

- [ ] **Step 1: Rewrite useSocketStaleData with useRef**

```typescript
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let listeners: Array<{ current: (data: any) => void }> = [];

export const initSocket = (parentId: string) => {
  if (!socket) {
    socket = io(window.location.origin);
    socket.on('connect', () => {
      const token = localStorage.getItem('kidtasker_token');
      socket?.emit('join-room', parentId, token);
    });

    socket.on('stale-data', (data) => {
      console.log('Received stale-data event:', data);
      listeners.forEach(ref => ref.current(data));
    });
  }
};

export const useSocketStaleData = (onStaleData: (data: { entity: string, timestamp: number }) => void) => {
  const callbackRef = useRef(onStaleData);
  callbackRef.current = onStaleData;

  useEffect(() => {
    listeners.push(callbackRef);
    return () => {
      listeners = listeners.filter(ref => ref !== callbackRef);
    };
  }, []);
};
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```
fix: use refs for socket listeners to prevent stale closures
```

---

### Task 12: Add error handling to KidDashboard

**Files:**
- Modify: `src/components/kid/KidDashboard.tsx`

- [ ] **Step 1: Add try/catch to claimReward**

```typescript
const claimReward = async (rewardId: string, xpCost: number) => {
  try {
    await rewardService.claimReward(profile.uid, rewardId, xpCost);
    setClaimedRewards([...claimedRewards, { id: 'tmp_' + Date.now(), kidId: profile.uid, rewardId, createdAt: Date.now() }]);
    onProfileUpdate();
  } catch (e) {
    console.error("Failed to claim reward", e);
    alert("Could not claim reward. Please try again.");
  }
};
```

- [ ] **Step 2: Add try/catch to executeCompletion**

Wrap the network calls in try/catch, revert optimistic state on failure:

```typescript
const executeCompletion = async () => {
  if (!confirmTask) return;
  const { taskId, count, xpReward } = confirmTask;
  const task = tasks.find(t => t.id === taskId);
  const stars = task?.starValue ?? 1;
  setConfirmTask(null);
  setXpAnimation({ amount: xpReward, active: true });
  setStarsAwarded(stars);
  setShowStarBurst(true);
  setTimeout(() => setShowStarBurst(false), 1200);

  try {
    await tasksClientService.completeTask(taskId, profile.uid, today, count);
    await userService.updateUserXP(profile.uid, xpReward);
    setCompletions([...completions, { 
      id: `${taskId}_${today}_${count || 1}`, 
      taskId, 
      kidId: profile.uid, 
      completedAt: { seconds: Date.now()/1000 }, 
      dateString: today, 
      count 
    }]);
    onProfileUpdate();
  } catch (e) {
    console.error("Failed to complete task", e);
    setXpAnimation({ amount: 0, active: false });
    alert("Could not save completion. Please try again.");
  }
  setTimeout(() => {
    setXpAnimation({ amount: 0, active: false });
  }, 2500);
};
```

- [ ] **Step 3: Fix progress bar to only count today's tasks**

Change lines 249-250 from:
```typescript
const totalSlots = tasks.reduce((acc: number, t: Task) => acc + (t.frequency === 'twice-daily' ? 2 : 1), 0);
```
To:
```typescript
const todayTasks = tasks.filter((t: Task) => shouldShowToday(t));
const totalSlots = todayTasks.reduce((acc: number, t: Task) => acc + (t.frequency === 'twice-daily' ? 2 : 1), 0);
```

- [ ] **Step 4: Commit**

```
fix: add error handling to task completion and reward claims, fix progress bar
```

---

### Task 13: Fix silent init failures + add category refetch

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add error state and retry to App init**

Add `initError` state. On catch, set it. Show retry button instead of blank screen:

```typescript
const [initError, setInitError] = useState(false);
```

In the catch block:
```typescript
} catch (e) {
  console.error("Auth initialization failed", e);
  setInitError(true);
}
```

Add retry UI after loading check:
```typescript
if (initError) {
  return (
    <div className="min-h-screen bg-ui-soft flex items-center justify-center flex-col gap-4">
      <p className="text-ui-muted font-medium">Failed to connect to server</p>
      <button 
        onClick={() => { setInitError(false); setLoading(true); window.location.reload(); }}
        className="px-6 py-3 bg-sky-500 text-white font-bold rounded-xl"
      >
        Retry
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add category refetch via socket**

Add `useSocketStaleData` to App.tsx to refetch categories when stale-data fires for categories:

```typescript
import { initSocket, useSocketStaleData } from './hooks/useSocket';

// Inside App component, after categories state:
const refreshCategories = useCallback(async () => {
  if (!profile) return;
  const parentId = profile.role === 'parent' ? profile.uid : profile.parentId;
  if (parentId) {
    const cats = await categoryService.getCategories(parentId);
    setCategories(cats || []);
  }
}, [profile]);

useSocketStaleData(useCallback((data) => {
  if (data.entity === 'categories') {
    refreshCategories();
  }
}, [refreshCategories]));
```

- [ ] **Step 3: Commit**

```
fix: show retry on init failure, refetch categories via socket
```

---

### Task 14: Add HTTP retry logic

**Files:**
- Modify: `src/services/http.ts`

- [ ] **Step 1: Add retry with exponential backoff for transient failures**

```typescript
export async function fetchAPI(endpoint: string, options?: RequestInit, retries = 2) {
  const token = localStorage.getItem('kidtasker_token');
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', 'application/json');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(API_BASE + endpoint, {
        ...options,
        headers
      });
      if (!res.ok) {
        // Don't retry client errors (4xx)
        if (res.status >= 400 && res.status < 500) {
          let msg = 'API Error: ' + res.status;
          try {
            const err = await res.json();
            if (err && err.error) msg = err.error;
          } catch (e) {}
          throw new HttpError(res.status, msg);
        }
        // Retry server errors (5xx)
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
          continue;
        }
        let msg = 'API Error: ' + res.status;
        try {
          const err = await res.json();
          if (err && err.error) msg = err.error;
        } catch (e) {}
        throw new HttpError(res.status, msg);
      }
      return await res.json();
    } catch (err) {
      if (err instanceof HttpError) throw err;
      // Network error — retry
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
        continue;
      }
      throw new HttpError(0, 'Network error: unable to reach server');
    }
  }
}
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```
feat: add retry with exponential backoff for transient HTTP failures
```
