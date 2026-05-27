# Group D: Push Notifications Implementation Plan

## Plan Status (2026-05-27)
- PARTIALLY COMPLETED


## Status Update (2026-05-27)

- Completed: lock-safe mutation behavior is enforced before edit operations, reducing noisy mutation notifications while locked.
- In progress: broadened real-time UI refresh coverage has been added for key calendar/task views using stale-data socket callbacks.
- Remaining: any deeper push-notification reliability tuning should be handled as a separate hardening pass.


> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web push notifications (VAPID) with email fallback for calendar event reminders and task overdue alerts.

**Architecture:** Browser subscribes to VAPID push on login; subscription stored in DB per user. A background worker cron (±60s window) checks `events.reminderMinutes` + `sent_reminders` table to send one push per event-reminder pair. If push fails (no subscription), fall back to email via nodemailer. All-day events use family timezone from `family_settings` table for reminder scheduling.

**Tech Stack:** `web-push` npm package, VAPID keys, `public/sw.js` service worker, `nodemailer`, better-sqlite3, existing `src/server/worker.ts` cron infrastructure

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/server/migrations/029_add_push.sql` | push_subscriptions + sent_reminders tables |
| Create | `public/sw.js` | service worker for push event handling |
| Create | `src/services/push.ts` | client-side subscribe/unsubscribe |
| Create | `src/server/modules/notifications/pushService.ts` | server-side VAPID send logic |
| Create | `src/server/modules/notifications/emailService.ts` | nodemailer send logic |
| Modify | `src/server/modules/notifications/routes.ts` | POST/DELETE /notifications/subscribe, GET /notifications/vapid-public-key |
| Modify | `src/server/worker.ts` | reminder cron job |
| Modify | `src/App.tsx` | subscribe on login, unsubscribe on logout |
| Modify | `.env.example` | VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL, SMTP_* |
| Create | `scripts/generate-vapid.mjs` | one-time VAPID key generation helper |
| Create | `src/server/modules/notifications/api.test.ts` | push subscription tests |

---

### Task 1: Generate VAPID keys and update env

**Files:**
- Create: `scripts/generate-vapid.mjs`
- Modify: `.env.example`

- [ ] **Step 1: Install web-push and nodemailer**

```bash
npm install web-push nodemailer
npm install --save-dev @types/web-push @types/nodemailer
```

- [ ] **Step 2: Create VAPID key generator script**

```javascript
// scripts/generate-vapid.mjs
import webpush from 'web-push';
const keys = webpush.generateVAPIDKeys();
console.log('Add to your .env file:');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
```

- [ ] **Step 3: Run generator and save keys**

```bash
node scripts/generate-vapid.mjs
```

Copy output into your `.env` file. One-time per deployment.

- [ ] **Step 4: Update .env.example**

Add these lines to `.env.example`:

```
# Web Push (VAPID)
VAPID_PUBLIC_KEY=your_vapid_public_key_here
VAPID_PRIVATE_KEY=your_vapid_private_key_here
VAPID_EMAIL=mailto:admin@yourdomain.com

# Email fallback (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=KidsTasky <noreply@yourdomain.com>
```

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-vapid.mjs .env.example
git commit -m "feat: VAPID key generator and env config"
```

---

### Task 2: Migration 029 — push_subscriptions and sent_reminders

**Files:**
- Create: `src/server/migrations/029_add_push.sql`

- [ ] **Step 1: Write migration**

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  parentId TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sent_reminders (
  eventId TEXT NOT NULL,
  reminderMinutes INTEGER NOT NULL,
  sentAt INTEGER NOT NULL,
  PRIMARY KEY (eventId, reminderMinutes)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_userId ON push_subscriptions(userId);
CREATE INDEX IF NOT EXISTS idx_push_subs_parentId ON push_subscriptions(parentId);
```

Key design notes:
- Column is `userId` (not `uid`) — matches the spec and the co-parent removal query in Group C (`DELETE FROM push_subscriptions WHERE userId = ?`)
- `endpoint` is `UNIQUE` — required for `ON CONFLICT(endpoint)` upsert in the subscribe route
- `sent_reminders` PK is `(eventId, reminderMinutes)` — prevents duplicate sends per event per reminder offset

Do NOT add `UPDATE schema_version SET version = N` — the migration runner tracks files by filename.

- [ ] **Step 2: Verify migration runs**

```bash
npm run dev
```

Check logs for `Running migration: 029_add_push.sql`. Stop server.

- [ ] **Step 3: Commit**

```bash
git add src/server/migrations/029_add_push.sql
git commit -m "feat: migration 029 push_subscriptions and sent_reminders"
```

---

### Task 3: Service worker

**Files:**
- Create: `public/sw.js`

- [ ] **Step 1: Write service worker**

```javascript
// public/sw.js
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'KidsTasky';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    data: data.url ? { url: data.url } : undefined,
    tag: data.tag || 'kidstasty-notification',
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.notification.data?.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});
```

Note: Service worker registration is handled in `src/App.tsx` (Task 7) and also in `index.html` by Group E (Task 1). Both registrations target `/sw.js` — browsers deduplicate registrations for the same scope automatically.

- [ ] **Step 2: Commit**

```bash
git add public/sw.js
git commit -m "feat: service worker for push notification handling"
```

---

### Task 4: Server-side push and email services

**Files:**
- Create: `src/server/modules/notifications/pushService.ts`
- Create: `src/server/modules/notifications/emailService.ts`

- [ ] **Step 1: Write pushService.ts**

```typescript
// src/server/modules/notifications/pushService.ts
import webpush from 'web-push';
import { db } from '../../db.js';

function initVapid() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL || 'mailto:admin@example.com';
  if (pub && priv) {
    webpush.setVapidDetails(email, pub, priv);
  }
}
initVapid();

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<boolean> {
  const subs = db.prepare("SELECT * FROM push_subscriptions WHERE userId = ?").all(userId) as any[];
  if (!subs.length) return false;
  const results = await Promise.allSettled(subs.map(sub =>
    webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    )
  ));
  // Remove expired subscriptions (410 Gone / 404 Not Found)
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const err = r.reason as any;
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(subs[i].endpoint);
      }
    }
  });
  return results.some(r => r.status === 'fulfilled');
}
```

- [ ] **Step 2: Write emailService.ts**

```typescript
// src/server/modules/notifications/emailService.ts
import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587'),
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    });
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/server/modules/notifications/pushService.ts src/server/modules/notifications/emailService.ts
git commit -m "feat: VAPID push and email notification services"
```

---

### Task 5: Notifications API routes — subscribe/unsubscribe/vapid-key

**Files:**
- Modify: `src/server/modules/notifications/routes.ts`
- Create: `src/server/modules/notifications/api.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/server/modules/notifications/api.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../../server.js';
import { db } from '../../db.js';

const SECRET = process.env.JWT_SECRET || 'test-secret';

describe('push subscription endpoints', () => {
  const userId = 'push_test_user';
  const parentId = 'push_test_parent';
  let token: string;

  beforeEach(() => {
    db.prepare("DELETE FROM push_subscriptions WHERE userId = ?").run(userId);
    db.prepare("DELETE FROM users WHERE uid = ?").run(userId);
    db.prepare("INSERT INTO users (uid, role, name, email, parentId, passwordHash) VALUES (?, 'parent', 'Test', 'push@test.com', ?, 'x')")
      .run(userId, parentId);
    token = jwt.sign({ uid: userId, role: 'parent', parentId }, SECRET);
  });

  it('returns vapid public key', async () => {
    const res = await request(app).get('/api/notifications/vapid-public-key');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('publicKey');
  });

  it('subscribes a push endpoint', async () => {
    const res = await request(app)
      .post('/api/notifications/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: 'https://push.example.com/test', p256dh: 'abc123', auth: 'def456' });
    expect(res.status).toBe(200);
    const sub = db.prepare("SELECT * FROM push_subscriptions WHERE userId = ?").get(userId);
    expect(sub).toBeTruthy();
  });

  it('unsubscribes without auth (called before logout clears token)', async () => {
    db.prepare("INSERT INTO push_subscriptions (id, userId, parentId, endpoint, p256dh, auth, createdAt) VALUES ('s1', ?, ?, 'https://push.example.com/test', 'abc', 'def', ?)")
      .run(userId, parentId, Date.now());
    const res = await request(app)
      .delete('/api/notifications/subscribe')
      .send({ endpoint: 'https://push.example.com/test' });
    expect(res.status).toBe(200);
    const sub = db.prepare("SELECT * FROM push_subscriptions WHERE userId = ?").get(userId);
    expect(sub).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/server/modules/notifications/api.test.ts
```

Expected: all 3 FAIL — endpoints don't exist.

- [ ] **Step 3: Read current notifications/routes.ts**

```bash
cat src/server/modules/notifications/routes.ts
```

Identify existing imports. The file likely already imports `authenticateUser` and `getParentId`. Do NOT re-import them — merge new code into the existing file.

- [ ] **Step 4: Add new endpoints to notifications/routes.ts**

Add the following to the existing router (after existing routes, using already-imported middleware):

```typescript
import { db } from '../../db.js';

// Add to existing router:

// GET vapid public key — no auth required
notificationsRouter.get('/notifications/vapid-public-key', (req: Request, res: Response) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
});

// POST subscribe — authenticated
notificationsRouter.post('/notifications/subscribe', authenticateUser, (req: Request, res: Response) => {
  const userId = (req as any).user.uid;
  const parentId = getParentId(req);
  const { endpoint, p256dh, auth } = req.body;
  if (!endpoint || !p256dh || !auth) return res.status(400).json({ error: 'Missing subscription fields' });
  const id = 'sub_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  db.prepare(`
    INSERT INTO push_subscriptions (id, userId, parentId, endpoint, p256dh, auth, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET userId=excluded.userId, parentId=excluded.parentId, p256dh=excluded.p256dh, auth=excluded.auth
  `).run(id, userId, parentId, endpoint, p256dh, auth, Date.now());
  res.json({ success: true });
});

// DELETE unsubscribe — explicitly no auth (called before token is cleared on logout)
notificationsRouter.delete('/notifications/subscribe', (req: Request, res: Response) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
  db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
  res.json({ success: true });
});
```

If `authenticateUser` and `getParentId` are not yet imported in the file, add them. If `db` is not yet imported, add it. Do not duplicate imports.

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/server/modules/notifications/api.test.ts
```

Expected: all 3 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/modules/notifications/routes.ts src/server/modules/notifications/api.test.ts
git commit -m "feat: push subscription API endpoints"
```

---

### Task 6: Worker — reminder cron job

**Files:**
- Modify: `src/server/worker.ts`

- [ ] **Step 1: Read current worker.ts**

```bash
cat src/server/worker.ts
```

Note the existing pattern — the cron jobs live inside the `startBackgroundWorker()` exported function. The new `setInterval` and `sendEventReminders` function must also go **inside** `startBackgroundWorker()`, not at module level. Place them after the existing cron job calls.

- [ ] **Step 2: Add imports to worker.ts**

Add alongside existing imports (do not duplicate `db`):

```typescript
import { sendPushToUser } from './modules/notifications/pushService.js';
import { sendEmail } from './modules/notifications/emailService.js';
```

- [ ] **Step 3: Add reminder cron**

Add after existing cron jobs:

```typescript
// Event reminder cron — runs every 60 seconds
const REMINDER_WINDOW_MS = 60_000;

setInterval(async () => {
  try {
    await sendEventReminders();
  } catch (e) {
    console.error('[worker] reminder error:', e);
  }
}, REMINDER_WINDOW_MS);

async function sendEventReminders() {
  const now = Date.now();

  // Find events with reminderMinutes set.
  // Filter: startTime > (now - windowMs) catches events that JUST started (0-minute reminder edge case)
  // and avoids permanently skipping events if the cron fires slightly late.
  const events = db.prepare(`
    SELECT e.id, e.title, e.startTime, e.reminderMinutes, e.parentId,
           fs.timezone as familyTimezone
    FROM events e
    JOIN family_settings fs ON e.parentId = fs.parentId
    WHERE e.reminderMinutes IS NOT NULL
      AND e.startTime > ?
  `).all(now - REMINDER_WINDOW_MS) as any[];

  for (const event of events) {
    const reminderMs = event.reminderMinutes * 60 * 1000;
    const fireAt = event.startTime - reminderMs;

    // Only process if within the ±60s window around the exact fire time
    if (Math.abs(now - fireAt) > REMINDER_WINDOW_MS) continue;

    // Check if already sent — PK (eventId, reminderMinutes) prevents duplicates
    const already = db.prepare("SELECT 1 FROM sent_reminders WHERE eventId = ? AND reminderMinutes = ?")
      .get(event.id, event.reminderMinutes);
    if (already) continue;

    // Record BEFORE the member loop. Intent: all family members are notified in this one cron run.
    // The PK (eventId, reminderMinutes) prevents future ticks from re-sending to anyone.
    // If the loop fails mid-way, some members miss the notification — acceptable trade-off
    // versus sending duplicate reminders. Do NOT move this inside the member loop.
    db.prepare("INSERT OR IGNORE INTO sent_reminders (eventId, reminderMinutes, sentAt) VALUES (?, ?, ?)")
      .run(event.id, event.reminderMinutes, now);

    const title = `Reminder: ${event.title}`;
    const body = event.reminderMinutes === 0
      ? 'Starting now'
      : `Starting in ${event.reminderMinutes} minute${event.reminderMinutes !== 1 ? 's' : ''}`;
    const payload = { title, body, tag: `event-${event.id}` };

    // Get all family members (owner + co-parents + kids)
    // owner: uid = event.parentId; co-parents + kids: parentId = event.parentId
    const members = db.prepare(
      "SELECT uid, email FROM users WHERE parentId = ? OR uid = ?"
    ).all(event.parentId, event.parentId) as any[];

    for (const member of members) {
      const pushed = await sendPushToUser(member.uid, payload);
      if (!pushed && member.email) {
        await sendEmail(member.email, title, body);
      }
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/server/worker.ts
git commit -m "feat: event reminder cron with push+email fallback"
```

---

### Task 7: App.tsx — subscribe on login, unsubscribe on logout

**Files:**
- Create: `src/services/push.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create push.ts client service**

```typescript
// src/services/push.ts

export async function subscribeToPush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  // Request notification permission first
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const vapidRes = await fetch('/api/notifications/vapid-public-key');
  const { publicKey } = await vapidRes.json();
  if (!publicKey) return;

  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  await sendSubscriptionToServer(subscription);
}

async function sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
  const token = localStorage.getItem('kidtasker_token');
  if (!token) return;
  const json = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    }),
  });
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  // Unsubscribe from server BEFORE revoking locally — token still valid at this point
  await fetch('/api/notifications/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  await subscription.unsubscribe();
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}
```

- [ ] **Step 2: Find login/logout hooks in App.tsx**

```bash
grep -n "setProfile\|logout\|localStorage.removeItem\|kidtasker_token" src/App.tsx | head -20
```

- [ ] **Step 3: Wire subscribe/unsubscribe in App.tsx**

```typescript
import { subscribeToPush, unsubscribeFromPush } from './services/push';

// After successful login (after profile is set):
subscribeToPush().catch(console.warn);

// In logout handler, BEFORE clearing the token:
await unsubscribeFromPush().catch(console.warn);
localStorage.removeItem('kidtasker_token');
// ... rest of logout
```

- [ ] **Step 4: Start dev server and verify**

```bash
npm run dev
```

Open Chrome → login → check DevTools → Application → Service Workers → confirm `sw.js` registered. Application → Notifications → confirm permission prompt appeared. Stop server.

- [ ] **Step 5: Commit**

```bash
git add src/services/push.ts src/App.tsx
git commit -m "feat: subscribe/unsubscribe push on login/logout"
```

---

### Task 8: Run full test suite

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
git commit -m "fix: Group D type errors and test failures"
```


