# Group C: Family & Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add co-parent accounts (second adult sharing a family), task approval UI, and proper token revocation.

**Architecture:** Co-parents join via the existing invite+join flow with `type='coparent'`. The server reads `type` from the DB invite row — never trusts the request body for role assignment. Co-parents get `role='parent'` + `parentId=<owner uid>` in JWT — all existing `getParentId()` queries work automatically. Token revocation uses a `revokedAt` timestamp stored in the DB, checked on every authenticated request. Socket.IO tracks a `uid → Set<string>` map (multiple tabs/devices) for force-logout. Task approval is UI-only — backend routes already exist.

**Tech Stack:** better-sqlite3, Express 5, JWT, Socket.IO, React 19, Tailwind CSS v4, `bcrypt` (already installed)

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/server/migrations/028_add_coparent.sql` | invites.type, users.revokedAt |
| Modify | `src/server/middleware/auth.ts` | revokedAt check on every request |
| Modify | `src/server/socket.ts` | userSocketMap (uid→Set<string>) + emitToUser on socketWrapper |
| Modify | `src/server/modules/invites/service.ts` | type param on createInvite, markCoParentInviteUsed |
| Modify | `src/server/modules/invites/routes.ts` | type param on existing POST /invites |
| Modify | `src/server/modules/users/routes.ts` | co-parent join in existing POST /users, GET co-parents, DELETE co-parent |
| Modify | `src/server/modules/users/service.ts` | createCoParent, removeCoParent, getCoParents |
| Modify | `src/services/invites.ts` | type param on createInvite client helper |
| Modify | `src/services/users.ts` | getCoParents, removeCoParent client helpers |
| Modify | `src/components/parent/SettingsView.tsx` | Co-Parents section |
| Modify | `src/components/onboarding/OnboardingView.tsx` | co-parent join flow |
| Modify | `src/components/auth/LoginView.tsx` | co-parent join option |
| Modify | `src/components/parent/ParentDashboard.tsx` | Pending Approvals section |
| Modify | `src/components/kid/KidDashboard.tsx` | approval status display |
| Modify | `src/components/kid/TaskCard.tsx` | approvalStatus badge |
| Modify | `src/services/tasks.ts` | getPendingCompletions, approveCompletion, rejectCompletion |
| Create | `src/server/modules/users/api.test.ts` | co-parent join/remove tests |
| Create | `src/server/middleware/auth.test.ts` | revokedAt test |

---

### Task 1: Migration 028 — co-parent schema

**Files:**
- Create: `src/server/migrations/028_add_coparent.sql`

- [ ] **Step 1: Write migration**

```sql
ALTER TABLE invites ADD COLUMN type TEXT DEFAULT 'kid';
ALTER TABLE users ADD COLUMN revokedAt INTEGER DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_users_parentId ON users(parentId);
```

Note: Do NOT add `UPDATE schema_version SET version = N` — the migration runner (`src/server/migrate.ts`) tracks applied files by filename, not by a version number. Adding that line would cause a runtime error if `schema_version` table differs.

- [ ] **Step 2: Verify migration runs**

```bash
npm run dev
```

Check server logs — should show `Running migration: 028_add_coparent.sql` with no errors. Stop server.

- [ ] **Step 3: Commit**

```bash
git add src/server/migrations/028_add_coparent.sql
git commit -m "feat: migration 028 add co-parent schema"
```

---

### Task 2: Auth middleware — revokedAt check

**Files:**
- Modify: `src/server/middleware/auth.ts`
- Create: `src/server/middleware/auth.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/server/middleware/auth.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../server.js';
import { db } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

describe('authenticateUser revokedAt', () => {
  const uid = 'user_revoke_test';
  let token: string;

  beforeEach(() => {
    db.prepare("DELETE FROM users WHERE uid = ?").run(uid);
    db.prepare("INSERT INTO users (uid, role, name, email, parentId, passwordHash) VALUES (?, 'parent', 'Test', 'revoke@test.com', ?, 'hash')")
      .run(uid, uid);
    token = jwt.sign({ uid, role: 'parent', parentId: uid }, JWT_SECRET);
  });

  it('allows valid non-revoked token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).not.toBe(401);
  });

  it('rejects revoked token', async () => {
    // Issue token with a known iat (100 seconds ago)
    const issuedAt = Math.floor(Date.now() / 1000) - 100;
    const revokedToken = jwt.sign({ uid, role: 'parent', parentId: uid, iat: issuedAt }, JWT_SECRET);
    // Revoke after token was issued
    db.prepare("UPDATE users SET revokedAt = ? WHERE uid = ?").run(Date.now(), uid);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${revokedToken}`);
    expect(res.status).toBe(401);
  });

  it('allows token issued after revocation', async () => {
    // Revoke, then issue new token
    db.prepare("UPDATE users SET revokedAt = ? WHERE uid = ?").run(Date.now() - 5000, uid);
    const freshToken = jwt.sign({ uid, role: 'parent', parentId: uid }, JWT_SECRET);
    // freshToken.iat = now (in seconds), revokedAt = now-5000ms — fresh token iat*1000 > revokedAt
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${freshToken}`);
    expect(res.status).not.toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/server/middleware/auth.test.ts
```

Expected: `rejects revoked token` FAILS — revoked token still returns 200.

- [ ] **Step 3: Implement revokedAt check**

Replace `src/server/middleware/auth.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config.js';
import { db } from '../db.js';

export function authenticateUser(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, getJwtSecret()) as { uid: string; role: string; parentId: string; iat?: number };
    // Check token revocation — payload.iat is epoch seconds, revokedAt is epoch ms
    const row = db.prepare("SELECT revokedAt FROM users WHERE uid = ?").get(payload.uid) as { revokedAt: number | null } | undefined;
    if (row?.revokedAt && payload.iat && payload.iat * 1000 < row.revokedAt) {
      return res.status(401).json({ error: "Token revoked" });
    }
    (req as any).user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
}

export const requireAuth = authenticateUser;

export function getParentId(req: Request): string {
  const user = (req as any).user;
  return user.role === 'parent' ? user.uid : user.parentId;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/server/middleware/auth.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/middleware/auth.ts src/server/middleware/auth.test.ts
git commit -m "feat: revoke tokens via revokedAt timestamp"
```

---

### Task 3: Socket.IO — uid→socket mapping for force-logout

**Files:**
- Modify: `src/server/socket.ts`

- [ ] **Step 1: Read current socket.ts**

```bash
cat src/server/socket.ts
```

Current structure: `socketWrapper` object with `init` and `emitStaleData` methods. The `join-room` handler already verifies the JWT and extracts `payload.uid`.

- [ ] **Step 2: Add userSocketMap and emitToUser**

The map must be `Map<string, Set<string>>` — one uid can have multiple connections (phone + desktop). Add at module level and wire into the `join-room` handler, then add `emitToUser` to `socketWrapper`:

```typescript
// Add BEFORE the socketWrapper declaration:
const userSocketMap = new Map<string, Set<string>>();
```

Inside `io.on('connection', (socket) => { ... })`, after `socket.join(parentId)` in the `join-room` handler:

```typescript
// Inside the try block, after socket.join(parentId):
const uid = payload.uid;
if (!userSocketMap.has(uid)) userSocketMap.set(uid, new Set());
userSocketMap.get(uid)!.add(socket.id);
```

Also add disconnect cleanup inside `io.on('connection', ...)`, after the `join-room` handler:

```typescript
socket.on('disconnect', () => {
  userSocketMap.forEach((ids, uid) => {
    ids.delete(socket.id);
    if (ids.size === 0) userSocketMap.delete(uid);
  });
});
```

Add `emitToUser` as a method on the `socketWrapper` object (alongside `emitStaleData`):

```typescript
emitToUser: (uid: string, event: string, data?: any) => {
  const socketIds = userSocketMap.get(uid);
  if (socketIds && io) {
    socketIds.forEach(socketId => io.to(socketId).emit(event, data));
  }
},
```

The final `socketWrapper` export now has three methods: `init`, `emitStaleData`, `emitToUser`.

- [ ] **Step 3: Commit**

```bash
git add src/server/socket.ts
git commit -m "feat: uid→socketId map in socketWrapper for force-logout"
```

---

### Task 4: Invites — extend existing flow for co-parent type

**Files:**
- Modify: `src/server/modules/invites/service.ts`
- Modify: `src/server/modules/invites/routes.ts`

- [ ] **Step 1: Read current invites service**

```bash
cat src/server/modules/invites/service.ts
```

- [ ] **Step 2: Extend inviteService with type support**

Modify `createInvite` to accept an optional `type` param (default `'kid'`), and add `markCoParentInviteUsed`:

```typescript
// Modify existing createInvite to accept type:
createInvite: (parentId: string, parentName: string, type: 'kid' | 'coparent' = 'kid') => {
  // Expire existing active invites of the same type for this parent
  db.prepare("UPDATE invites SET status = 'expired' WHERE parentId = ? AND type = ? AND status = 'active'")
    .run(parentId, type);
  const id = Math.random().toString(36).slice(2, 8).toUpperCase();
  db.prepare("INSERT INTO invites (id, parentId, parentName, createdAt, status, type) VALUES (?, ?, ?, ?, 'active', ?)")
    .run(id, parentId, parentName, Date.now(), type);
  return id;
},

// Mark a co-parent invite as used (call after successful join)
markInviteUsed: (code: string) => {
  db.prepare("UPDATE invites SET status = 'used' WHERE id = ?").run(code);
},
```

- [ ] **Step 3: Extend invites/routes.ts**

Add a `type` query param to the existing `POST /invites` and add a route to get the active co-parent invite:

```typescript
// Modify existing POST /invites to pass type:
invitesRouter.post("/invites", [
  body('parentId').isString().notEmpty(),
  body('parentName').isString().notEmpty(),
  body('type').isIn(['kid', 'coparent']).optional(),
  validate
], (req: Request, res: Response) => {
  const type = req.body.type || 'kid';
  const id = inviteService.createInvite(req.body.parentId, req.body.parentName, type);
  res.json({ id });
});

// Add: get active co-parent invite for a parent (authenticated, owner only)
invitesRouter.get("/parents/:parentId/invites/coparent/active", authenticateUser, [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const userParentId = getParentId(req);
  if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
  const invite = db.prepare("SELECT * FROM invites WHERE parentId = ? AND type = 'coparent' AND status = 'active'")
    .get(req.params.parentId);
  res.json(invite || null);
});
```

Add `import { db } from '../../db.js';` to invites/routes.ts.

- [ ] **Step 4: Commit**

```bash
git add src/server/modules/invites/service.ts src/server/modules/invites/routes.ts
git commit -m "feat: extend invites with co-parent type support"
```

---

### Task 5: Users — co-parent join, list, removal

**Files:**
- Modify: `src/server/modules/users/service.ts`
- Modify: `src/server/modules/users/routes.ts`
- Create: `src/server/modules/users/api.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/server/modules/users/api.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../../server.js';
import { db } from '../../db.js';

const SECRET = process.env.JWT_SECRET || 'test-secret';

describe('co-parent flow', () => {
  const ownerUid = 'owner_cp_test';
  let ownerToken: string;

  beforeEach(() => {
    db.prepare("DELETE FROM users WHERE uid LIKE 'owner_cp%' OR uid LIKE 'cp_new%'").run();
    db.prepare("DELETE FROM invites WHERE parentId = ?").run(ownerUid);
    db.prepare("INSERT INTO users (uid, role, name, email, parentId, passwordHash) VALUES (?, 'parent', 'Owner', 'owner@cp.test', ?, 'x')")
      .run(ownerUid, ownerUid);
    ownerToken = jwt.sign({ uid: ownerUid, role: 'parent', parentId: ownerUid }, SECRET);
  });

  it('creates co-parent invite via type param', async () => {
    const res = await request(app).post('/api/invites')
      .send({ parentId: ownerUid, parentName: 'Owner', type: 'coparent' });
    expect(res.status).toBe(200);
    expect(res.body.id).toHaveLength(6);
    const inv = db.prepare("SELECT type FROM invites WHERE id = ?").get(res.body.id) as any;
    expect(inv.type).toBe('coparent');
  });

  it('co-parent joins via POST /users with code', async () => {
    // Create co-parent invite
    const invRes = await request(app).post('/api/invites')
      .send({ parentId: ownerUid, parentName: 'Owner', type: 'coparent' });
    const code = invRes.body.id;

    // Join using POST /users with the code. Server generates uid server-side — use returned uid.
    const joinRes = await request(app).post('/api/users')
      .send({ name: 'CoParent', email: 'cop@test.com', code, password: 'password123' });
    expect(joinRes.status).toBe(200);
    expect(joinRes.body.uid).toBeTruthy();

    const user = db.prepare("SELECT role, parentId FROM users WHERE uid = ?").get(joinRes.body.uid) as any;
    expect(user.role).toBe('parent');
    expect(user.parentId).toBe(ownerUid);
  });

  it('rejects invalid co-parent code', async () => {
    const res = await request(app).post('/api/users')
      .send({ name: 'Bad', email: 'bad@test.com', code: 'BADCOD', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('lists and removes co-parent', async () => {
    // Add co-parent directly
    db.prepare("INSERT INTO users (uid, role, name, email, parentId, passwordHash) VALUES ('cp_new_3', 'parent', 'CP3', 'cp3@test.com', ?, 'x')")
      .run(ownerUid);

    // List
    const listRes = await request(app).get(`/api/parents/${ownerUid}/coparents`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.some((c: any) => c.uid === 'cp_new_3')).toBe(true);

    // Remove
    const delRes = await request(app).delete('/api/users/cp_new_3/coparent')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(delRes.status).toBe(200);
    const user = db.prepare("SELECT revokedAt, parentId FROM users WHERE uid = 'cp_new_3'").get() as any;
    expect(user.revokedAt).toBeTruthy();
    expect(user.parentId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/server/modules/users/api.test.ts
```

Expected: co-parent join and list/remove FAIL — routes don't handle co-parent case.

- [ ] **Step 3: Add service methods to users/service.ts**

```typescript
import bcrypt from 'bcrypt';

// Add these methods:
createCoParent: async (data: { uid: string; name: string; email: string; password: string; parentId: string }) => {
  const passwordHash = await bcrypt.hash(data.password, 10);
  db.prepare(`
    INSERT INTO users (uid, role, name, email, parentId, passwordHash)
    VALUES (?, 'parent', ?, ?, ?, ?)
  `).run(data.uid, data.name, data.email, data.parentId, passwordHash);
},

removeCoParent: (uid: string, ownerUid: string) => {
  const user = db.prepare("SELECT uid FROM users WHERE uid = ? AND parentId = ? AND role = 'parent' AND uid != ?")
    .get(uid, ownerUid, ownerUid) as any;
  if (!user) throw new Error('Co-parent not found');
  // UPDATE only — never DELETE. Row must survive to serve 401 for in-flight tokens.
  db.prepare("UPDATE users SET revokedAt = ?, parentId = NULL WHERE uid = ?")
    .run(Date.now(), uid);
  // Clean up push subscriptions
  db.prepare("DELETE FROM push_subscriptions WHERE uid = ?").run(uid);
},

getCoParents: (ownerUid: string) => {
  return db.prepare("SELECT uid, name, email FROM users WHERE parentId = ? AND role = 'parent' AND uid != ?")
    .all(ownerUid, ownerUid);
},
```

Note: `push_subscriptions` table is created in migration 029 (Group D). If running Group C before Group D, the `DELETE FROM push_subscriptions` call will fail. Wrap it in a try/catch or check if the table exists:
```typescript
try {
  db.prepare("DELETE FROM push_subscriptions WHERE uid = ?").run(uid);
} catch { /* table created in Group D */ }
```

- [ ] **Step 4: Extend POST /users to handle co-parent join**

In `src/server/modules/users/routes.ts`, modify the existing `POST /users` route to detect when a `code` is supplied and a co-parent invite exists:

```typescript
// uid is optional: co-parent join generates uid server-side, existing kid/parent flows supply it
usersRouter.post("/users", [
  body('uid').isString().optional(),
  body('role').isString().optional(),
  body('name').isString().notEmpty(),
  body('email').isEmail().optional(),
  body('parentId').isString().optional(),
  body('password').isString().optional(),
  body('code').isString().optional(), // invite code for co-parent join
  body('xp').isInt({min: 0}).optional(),
  body('level').isInt({min: 1}).optional(),
  body('badges').isArray().optional(),
  body('themeId').isString().optional(),
  body('isManaged').isBoolean().optional(),
  body('pin').isString().optional(),
  validate
], async (req: Request, res: Response) => {
  // Co-parent join path: code present + invite type is 'coparent'
  if (req.body.code) {
    const invite = db.prepare("SELECT * FROM invites WHERE id = ? AND status = 'active'")
      .get(req.body.code) as any;
    if (!invite) return res.status(400).json({ error: 'Invalid or expired invite code' });

    if (invite.type === 'coparent') {
      if (!req.body.password) return res.status(400).json({ error: 'Password required for co-parent join' });
      // Generate uid server-side — never trust client-supplied uid for security-critical join
      const uid = 'user_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      await userService.createCoParent({
        uid,
        name: req.body.name,
        email: req.body.email || '',
        password: req.body.password,
        parentId: invite.parentId,
      });
      inviteService.markInviteUsed(req.body.code);
      return res.json({ success: true, uid });
    }
    // else: kid join — fall through to existing logic with invite.parentId
  }

  // Existing kid/parent create path
  await userService.createUser(req.body);
  res.json({ success: true });
});
```

Add imports at top of users/routes.ts:

```typescript
import { inviteService } from '../invites/service.js';
import { db } from '../../db.js';
```

- [ ] **Step 5: Add co-parent list and remove routes**

```typescript
// List co-parents for a family
usersRouter.get("/parents/:parentId/coparents", authenticateUser, [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const userParentId = getParentId(req);
  if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
  res.json(userService.getCoParents(req.params.parentId));
});

// Remove co-parent (owner only)
usersRouter.delete("/users/:uid/coparent", authenticateUser, [
  param('uid').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const caller = (req as any).user;
  // Only the family owner (uid === parentId) can remove co-parents
  if (caller.uid !== caller.parentId) return res.status(403).json({ error: 'Only family owner can remove co-parent' });
  try {
    userService.removeCoParent(req.params.uid, caller.uid);
    // Force-disconnect all active sessions for the removed co-parent
    socketWrapper.emitToUser(req.params.uid, 'forceLogout');
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
```

Add `import { socketWrapper } from '../../socket.js';` and `import { authenticateUser, getParentId } from '../../middleware/auth.js';` to users/routes.ts.

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run src/server/modules/users/api.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/modules/users/service.ts src/server/modules/users/routes.ts src/server/modules/users/api.test.ts
git commit -m "feat: co-parent join, list, and remove"
```

---

### Task 6: Client services — co-parent helpers

**Files:**
- Modify: `src/services/invites.ts`
- Modify: `src/services/users.ts`

- [ ] **Step 1: Read current client services**

```bash
cat src/services/invites.ts
cat src/services/users.ts
```

- [ ] **Step 2: Add to invites client service**

```typescript
createCoParentInvite: (parentId: string, parentName: string) =>
  fetchAPI('/invites', { method: 'POST', body: JSON.stringify({ parentId, parentName, type: 'coparent' }) }),

getActiveCoParentInvite: (parentId: string) =>
  fetchAPI(`/parents/${parentId}/invites/coparent/active`),
```

- [ ] **Step 3: Add to users client service**

```typescript
getCoParents: (parentId: string) =>
  fetchAPI(`/parents/${parentId}/coparents`),

removeCoParent: (uid: string) =>
  fetchAPI(`/users/${uid}/coparent`, { method: 'DELETE' }),
```

- [ ] **Step 4: Commit**

```bash
git add src/services/invites.ts src/services/users.ts
git commit -m "feat: co-parent client service helpers"
```

---

### Task 7: SettingsView — Co-Parents section

**Files:**
- Modify: `src/components/parent/SettingsView.tsx`

- [ ] **Step 1: Add state for co-parents**

Import `userService` from `../../services/users` if not already imported. Add state:

```typescript
const [coParents, setCoParents] = useState<{uid: string; name: string; email: string}[]>([]);
const [coParentInvite, setCoParentInvite] = useState<{id: string} | null>(null);
const [generatingCoInvite, setGeneratingCoInvite] = useState(false);
const [coInviteCopied, setCoInviteCopied] = useState(false);
```

In the existing `useEffect` that loads settings, add:

```typescript
const [cp, cpi] = await Promise.all([
  userService.getCoParents(parentId).catch(() => []),
  inviteService.getActiveCoParentInvite(parentId).catch(() => null),
]);
setCoParents(cp || []);
setCoParentInvite(cpi || null);
```

- [ ] **Step 2: Add Co-Parents UI section**

Add inside the settings form, after the PIN section. Add `Users` and `Trash2` to lucide-react imports:

```tsx
{/* Co-Parents */}
<div className="border-t pt-4">
  <h3 className="font-semibold mb-2 flex items-center gap-2">
    <Users size={16} /> Co-Parents
  </h3>
  {coParents.length > 0 && (
    <ul className="mb-3 space-y-1">
      {coParents.map(cp => (
        <li key={cp.uid} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-1.5">
          <span>{cp.name} <span className="text-gray-400">({cp.email})</span></span>
          <button
            onClick={async () => {
              if (!confirm(`Remove ${cp.name} as co-parent?`)) return;
              await userService.removeCoParent(cp.uid);
              setCoParents(prev => prev.filter(c => c.uid !== cp.uid));
            }}
            className="text-red-500 hover:text-red-700 ml-2"
          >
            <Trash2 size={14} />
          </button>
        </li>
      ))}
    </ul>
  )}
  {coParentInvite ? (
    <div className="flex items-center gap-2">
      <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">{coParentInvite.id}</span>
      <button
        onClick={() => {
          navigator.clipboard.writeText(coParentInvite.id);
          setCoInviteCopied(true);
          setTimeout(() => setCoInviteCopied(false), 2000);
        }}
        className="text-blue-500 text-xs"
      >
        {coInviteCopied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  ) : (
    <button
      disabled={generatingCoInvite}
      onClick={async () => {
        setGeneratingCoInvite(true);
        const res = await inviteService.createCoParentInvite(parentId, 'Family');
        setCoParentInvite(res);
        setGeneratingCoInvite(false);
      }}
      className="text-sm bg-blue-500 text-white px-3 py-1.5 rounded hover:bg-blue-600 disabled:opacity-50"
    >
      {generatingCoInvite ? 'Generating…' : 'Generate Co-Parent Invite'}
    </button>
  )}
</div>
```

- [ ] **Step 3: Start dev server and verify visually**

```bash
npm run dev
```

Login as parent → Settings → confirm "Co-Parents" section appears. Generate invite → 6-char code appears. Stop server.

- [ ] **Step 4: Commit**

```bash
git add src/components/parent/SettingsView.tsx
git commit -m "feat: co-parents management section in settings"
```

---

### Task 8: OnboardingView and LoginView — co-parent join flow

**Files:**
- Modify: `src/components/onboarding/OnboardingView.tsx`
- Modify: `src/components/auth/LoginView.tsx`

- [ ] **Step 1: Read OnboardingView to understand current step flow**

```bash
cat src/components/onboarding/OnboardingView.tsx | head -120
```

- [ ] **Step 2: Add co-parent role option to OnboardingView**

If OnboardingView has a role selection step (parent / kid), add a third option: "I'm joining as a co-parent".

When `role === 'coparent'` is selected, show:
- Invite code input (6-char)
- Name, email, password fields

On submit:
```typescript
// Validate code first
const invite = await inviteService.validateCoParentInvite ? ... 
// Use: GET /invites/:code/validate (already exists), then check invite.type === 'coparent'
const validateRes = await fetchAPI(`/invites/${code}/validate`);
if (!validateRes || validateRes.type !== 'coparent') {
  setError('Invalid or expired co-parent code');
  return;
}
// Join via POST /users with code
const joinRes = await fetchAPI('/users', {
  method: 'POST',
  body: JSON.stringify({ name, email, password, code }), // no uid — server generates it
});
// Login to get token
const loginResult = await authService.login(email, password);
if (loginResult?.token) {
  onComplete(loginResult);
}
```

The exact integration depends on the onboarding step machine. Adapt to match existing patterns.

- [ ] **Step 3: Add "Have a co-parent code?" link to LoginView**

In `src/components/auth/LoginView.tsx`, add a small link below the main login form:

```tsx
<button
  className="text-xs text-blue-500 underline mt-2"
  onClick={() => navigateToOnboardingCoParent()} // or route to onboarding with mode pre-selected
>
  Have a co-parent invite code?
</button>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding/OnboardingView.tsx src/components/auth/LoginView.tsx
git commit -m "feat: co-parent join flow in onboarding and login"
```

---

### Task 9: Task approval UI

**Files:**
- Modify: `src/services/tasks.ts`
- Modify: `src/components/parent/ParentDashboard.tsx`
- Modify: `src/components/kid/TaskCard.tsx`

Note: API routes already exist:
- `GET /parents/:parentId/pending-completions` — returns completions with `kidName` and `taskTitle` (joined in `getPendingCompletionsByParent` service method)
- `PATCH /completions/:id/approve`
- `PATCH /completions/:id/reject`

- [ ] **Step 1: Add client methods to tasks service**

```bash
cat src/services/tasks.ts | head -30
```

Add to the client service:

```typescript
getPendingCompletions: (parentId: string): Promise<any[]> =>
  fetchAPI(`/parents/${parentId}/pending-completions`),

approveCompletion: (completionId: string): Promise<void> =>
  fetchAPI(`/completions/${completionId}/approve`, { method: 'PATCH' }),

rejectCompletion: (completionId: string): Promise<void> =>
  fetchAPI(`/completions/${completionId}/reject`, { method: 'PATCH' }),
```

- [ ] **Step 2: Add Pending Approvals section to ParentDashboard**

Add state:
```typescript
const [pendingCompletions, setPendingCompletions] = useState<any[]>([]);
```

In `fetchData`, add:
```typescript
const pc = await tasksClientService.getPendingCompletions(profile.uid).catch(() => []);
setPendingCompletions(pc || []);
```

Note: `profile.uid` is correct here for the **owner** parent. For a co-parent, `profile.uid !== profile.parentId` — the route expects the owner's parentId. Use `profile.role === 'parent' && profile.parentId ? profile.parentId : profile.uid` to get the correct parentId, or check how other fetches resolve this in the dashboard. The `getParentId` logic on the server handles both cases automatically when the request is authenticated — but this client call uses the URL param, not the JWT.

Add UI section (after task list or above the kid list):

```tsx
{pendingCompletions.length > 0 && (
  <div className="mb-6">
    <h3 className="font-semibold text-sm mb-2 flex items-center gap-1">
      <ShieldCheck size={14} /> Awaiting Approval ({pendingCompletions.length})
    </h3>
    <div className="space-y-2">
      {pendingCompletions.map(c => (
        <div key={c.id} className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-sm">
          <span>
            <strong>{c.kidName}</strong> completed <em>{c.taskTitle}</em>
          </span>
          <div className="flex gap-2 ml-2 flex-shrink-0">
            <button
              onClick={async () => {
                await tasksClientService.approveCompletion(c.id);
                setPendingCompletions(prev => prev.filter(p => p.id !== c.id));
              }}
              className="text-green-600 font-medium hover:underline text-xs"
            >
              Approve
            </button>
            <button
              onClick={async () => {
                await tasksClientService.rejectCompletion(c.id);
                setPendingCompletions(prev => prev.filter(p => p.id !== c.id));
              }}
              className="text-red-500 hover:underline text-xs"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 3: Add approvalStatus badge to TaskCard**

In `src/components/kid/TaskCard.tsx`, check if completion data is passed as a prop. The completion object from the API has `approvalStatus: 'pending' | 'approved' | 'rejected' | null`. Add a badge where task status is shown:

```tsx
{completion?.approvalStatus === 'pending' && (
  <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
    ⏳ Pending Approval
  </span>
)}
{completion?.approvalStatus === 'rejected' && (
  <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
    ✗ Rejected — try again
  </span>
)}
```

- [ ] **Step 4: Start dev server and verify visually**

```bash
npm run dev
```

1. Login as parent → add task → check "Requires Approval"
2. Login as kid → complete task → TaskCard shows "Pending Approval" badge
3. Login as parent → "Awaiting Approval" section appears → Approve → clears
Stop server.

- [ ] **Step 5: Commit**

```bash
git add src/services/tasks.ts src/components/parent/ParentDashboard.tsx src/components/kid/TaskCard.tsx
git commit -m "feat: task approval UI for parent and kid dashboards"
```

---

### Task 10: Run full test suite

- [ ] **Step 1: Run all tests**

```bash
npm run test
```

Expected: all tests PASS. Fix any failures before proceeding.

- [ ] **Step 2: Type check**

```bash
npm run lint
```

Fix any type errors.

- [ ] **Step 3: Final commit if any fixes**

```bash
git add -p
git commit -m "fix: Group C type errors and test failures"
```
