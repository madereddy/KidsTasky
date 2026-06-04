# PWA Hardening + Test Infra Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 targeted improvements: Vitest v4 pool config, offline SW caching, Wake Lock API, Web Share Target, and manifest polish.

**Architecture:** Each fix is independent — test infra is config-only, SW caching extends `public/sw.js`, Wake Lock lives in a new `useWakeLock` hook consumed by `WallHome`, Share Target adds a manifest entry + one server route + a React landing component, manifest polish is pure JSON/HTML edits.

**Tech Stack:** Vitest 4, Workbox-free vanilla SW Cache API, Web Lock API, PWA Share Target spec, React 19, Express 5.

---

## File Map

| File | Change |
|---|---|
| `vite.config.ts` | Migrate `poolOptions.forks.*` → top-level `maxForks`/`minForks` |
| `public/sw.js` | Add install/activate/fetch handlers for offline app-shell cache |
| `src/hooks/useWakeLock.ts` | **New** — encapsulate `navigator.wakeLock` lifecycle |
| `src/components/parent/WallHome.tsx` | Import + call `useWakeLock` when in wall mode |
| `public/manifest.json` | Add `share_target`, `shortcuts`, `categories`, maskable icon purpose |
| `index.html` | Fix title "KidTasker" → "KidsTasky" |
| `src/server/modules/share/routes.ts` | **New** — GET `/share-target` redirect handler |
| `src/server/routes.ts` (or main router) | Register share routes |
| `src/components/shared/ShareTargetHandler.tsx` | **New** — React component reads URL params, pre-fills add-event/task modal |
| `src/App.tsx` | Mount `ShareTargetHandler` |

---

## Task 1: Fix Vitest v4 Pool Config

**Files:**
- Modify: `vite.config.ts`

Vitest 4 removed `test.poolOptions` — options are now top-level under `test`. The `DEPRECATED` warning fires on every run.

- [ ] **Step 1: Apply config fix**

Replace in `vite.config.ts` test block:

```ts
// BEFORE
pool: 'forks',
poolOptions: {
  forks: {
    maxForks: 4,
    minForks: 1,
  },
},

// AFTER
pool: 'forks',
maxForks: 4,
minForks: 1,
```

- [ ] **Step 2: Verify deprecation warning gone**

```bash
pnpm test 2>&1 | grep -i "deprecated\|poolOptions"
```

Expected: no output (warning eliminated).

- [ ] **Step 3: Verify test counts unchanged**

```bash
pnpm test 2>&1 | grep "Test Files"
```

Expected: same pass/fail counts as before.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "fix: migrate vitest poolOptions to v4 top-level maxForks/minForks"
```

---

## Task 2: Offline App-Shell Caching in Service Worker

**Files:**
- Modify: `public/sw.js`

Current SW only handles push and notificationclick. Adding:
- `install`: precache app shell (HTML + all hashed assets in `/assets/`)
- `activate`: delete stale caches from prior versions
- `fetch`: cache-first for `/assets/` (hashed, immutable), network-first for navigation (HTML), pass-through for `/api/` (never cache API — auth/privacy risk)

The cache version string (`CACHE_NAME`) controls invalidation — bump it on each deploy. Vite asset filenames are content-hashed so cache-first is safe for them.

- [ ] **Step 1: Rewrite sw.js with offline support**

```js
const CACHE_NAME = 'kidstasty-shell-v1';

// Assets to precache on install. Vite hashes these filenames so they're immutable.
// We cache the bare minimum: root HTML + the runtime chunk.
// Full asset list is populated dynamically via fetch caching below.
const PRECACHE_URLS = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept API calls — always hit network for auth/fresh data
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
    return;
  }

  // Hashed assets (/assets/*.js, /assets/*.css) — cache first, they're immutable
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icon')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // HTML navigation — network first, fall back to cached '/' (app shell)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.open(CACHE_NAME).then((cache) => cache.match('/'))
      )
    );
    return;
  }
});

// Push notification handler (existing)
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

- [ ] **Step 2: Verify SW registers without console errors**

```bash
pnpm dev
```

Open `http://localhost:3000`, open DevTools → Application → Service Workers. Confirm:
- Status: "activated and running"
- No errors in console

- [ ] **Step 3: Test offline fallback**

In DevTools → Network tab, enable "Offline" mode. Reload page. Expected: app shell loads (React app renders, API calls fail gracefully showing loading/error states).

- [ ] **Step 4: Commit**

```bash
git add public/sw.js
git commit -m "feat: add offline app-shell caching to service worker"
```

---

## Task 3: Wake Lock API in Wall Mode

**Files:**
- Create: `src/hooks/useWakeLock.ts`
- Modify: `src/components/parent/WallHome.tsx`

When the family display (WallHome) is active, the tablet screen must not dim/sleep. `navigator.wakeLock.request('screen')` prevents this. The lock is released automatically when the page is hidden and must be re-acquired on `visibilitychange`.

- [ ] **Step 1: Create useWakeLock hook**

```ts
// src/hooks/useWakeLock.ts
import { useEffect, useRef } from 'react';

export function useWakeLock(enabled: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;

    async function acquire() {
      try {
        lockRef.current = await navigator.wakeLock.request('screen');
      } catch {
        // Permission denied or not supported — silent fail, not critical
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void acquire();
      }
    }

    void acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [enabled]);
}
```

- [ ] **Step 2: Use hook in WallHome**

In `src/components/parent/WallHome.tsx`, add import and call:

```ts
import { useWakeLock } from '../../hooks/useWakeLock';

// Inside WallHome component, after existing hooks:
useWakeLock(isWallMode);
```

- [ ] **Step 3: Manual verify**

```bash
pnpm dev
```

Navigate to Wall Mode. In DevTools → Application → Wake Locks — confirm "screen" lock is acquired. Navigate away, confirm it releases.

- [ ] **Step 4: Run tests (no regressions)**

```bash
pnpm test 2>&1 | grep "Test Files"
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useWakeLock.ts src/components/parent/WallHome.tsx
git commit -m "feat: acquire Wake Lock in wall mode to prevent screen sleep"
```

---

## Task 4: Web Share Target

**Files:**
- Modify: `public/manifest.json`
- Create: `src/server/modules/share/routes.ts`
- Modify: `src/server/index.ts` (or wherever routes are registered — verify with grep)
- Create: `src/components/shared/ShareTargetHandler.tsx`
- Modify: `src/App.tsx`

Share Target lets users share a URL or text from the OS share sheet directly into KidsTasky (e.g. share a recipe link → opens Add Meal, share a school notice → opens Magic Import). PWA Share Target is manifest-declared; the browser POSTs a form to `/share-target` and the app handles it.

- [ ] **Step 1: Find server route registration file**

```bash
grep -rn "modules.*routes\|registerRoutes\|app.use.*router" src/server/ --include="*.ts" | head -20
```

Note the file that registers all module routers — that's where the share route gets added.

- [ ] **Step 2: Add share_target to manifest**

In `public/manifest.json`, add after the `icons` array:

```json
"share_target": {
  "action": "/share-target",
  "method": "GET",
  "params": {
    "title": "title",
    "text": "text",
    "url": "url"
  }
}
```

Note: GET share target is simpler (no multipart handling needed) and sufficient for text/URL sharing. File sharing can be added later.

- [ ] **Step 3: Create server share route**

```ts
// src/server/modules/share/routes.ts
import { Router } from 'express';

const router = Router();

// Share Target handler — browser POSTs here from OS share sheet.
// We redirect to the SPA with query params so React can handle it.
router.get('/share-target', (req, res) => {
  const { title = '', text = '', url = '' } = req.query as Record<string, string>;
  const params = new URLSearchParams();
  if (title) params.set('share_title', title);
  if (text) params.set('share_text', text);
  if (url) params.set('share_url', url);
  res.redirect(`/?${params.toString()}`);
});

export default router;
```

- [ ] **Step 4: Register route in server**

In the file identified in Step 1, add:

```ts
import shareRoutes from './modules/share/routes.js';
// ...
app.use(shareRoutes);
```

(Keep it before the Vite/SPA catch-all middleware.)

- [ ] **Step 5: Create ShareTargetHandler component**

```tsx
// src/components/shared/ShareTargetHandler.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // only if using router; otherwise use window.location

// Reads share_* query params from URL and opens the appropriate modal.
// Mounted once in App.tsx. Clears params after reading to keep URL clean.
export function ShareTargetHandler() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const title = params.get('share_title') || '';
    const text = params.get('share_text') || '';
    const url = params.get('share_url') || '';

    if (!title && !text && !url) return;

    // Clean URL without reloading
    const clean = window.location.pathname;
    window.history.replaceState({}, '', clean);

    // Dispatch a custom event — parent App can listen and open Magic Import
    // or Add Event modal pre-filled with the shared content.
    window.dispatchEvent(new CustomEvent('kidstasty:share', {
      detail: { title, text, url },
    }));
  }, []);

  return null;
}
```

- [ ] **Step 6: Mount in App.tsx**

In `src/App.tsx`, import and render `<ShareTargetHandler />` near the root (after auth check, before main routing). Add a `window.addEventListener('kidstasty:share', ...)` handler that opens the Magic Import modal with the shared text pre-filled.

Check how Magic Import modal is currently opened in App.tsx or ParentDashboard to follow the same pattern.

- [ ] **Step 7: Manual test**

```bash
pnpm build && pnpm start
```

Visit `http://localhost:3000/?share_title=Test+Recipe&share_text=Check+this+out&share_url=https://example.com`. Verify custom event fires (add `console.log` temporarily) and URL is cleaned.

On mobile: install PWA, use share sheet from browser, select KidsTasky.

- [ ] **Step 8: Commit**

```bash
git add public/manifest.json src/server/modules/share/routes.ts src/components/shared/ShareTargetHandler.tsx src/App.tsx
# also add the file where share route was registered
git commit -m "feat: add PWA Web Share Target for URL/text sharing into KidsTasky"
```

---

## Task 5: Manifest Polish + Brand Fix

**Files:**
- Modify: `index.html`
- Modify: `public/manifest.json`

Three sub-items:
1. Brand mismatch: `<title>KidTasker</title>` → `KidsTasky`
2. Add `shortcuts` (jump to tasks/calendar from homescreen long-press)
3. Add `categories` + `purpose: "any maskable"` to icons

- [ ] **Step 1: Fix brand in index.html**

Change line 9:
```html
<!-- BEFORE -->
<title>KidTasker</title>

<!-- AFTER -->
<title>KidsTasky</title>
```

- [ ] **Step 2: Enhance manifest.json**

Replace full `public/manifest.json` content:

```json
{
  "name": "KidsTasky",
  "short_name": "KidsTasky",
  "description": "Gamified family task manager — chores, calendar, meals, and rewards for the whole family",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "categories": ["utilities", "productivity", "lifestyle"],
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "shortcuts": [
    {
      "name": "Tasks",
      "short_name": "Tasks",
      "description": "View and manage family tasks",
      "url": "/?view=tasks",
      "icons": [{ "src": "/icon-192.png", "sizes": "192x192" }]
    },
    {
      "name": "Calendar",
      "short_name": "Calendar",
      "description": "Family calendar",
      "url": "/?view=calendar",
      "icons": [{ "src": "/icon-192.png", "sizes": "192x192" }]
    },
    {
      "name": "Wall Display",
      "short_name": "Wall",
      "description": "Family wall display mode",
      "url": "/?view=wall",
      "icons": [{ "src": "/icon-192.png", "sizes": "192x192" }]
    }
  ],
  "share_target": {
    "action": "/share-target",
    "method": "GET",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url"
    }
  }
}
```

Note: `share_target` is already added in Task 4. If Task 4 was done first, merge rather than overwrite.

- [ ] **Step 3: Handle shortcut URL params in App**

If the app uses view-based routing via query params (`?view=tasks`), verify those views open correctly from the shortcuts. If routing uses a different mechanism, update shortcut URLs to match.

```bash
grep -n "view=\|?view\|searchParams\|URLSearchParams" src/App.tsx | head -20
```

Adjust shortcut `url` values to match real navigation scheme.

- [ ] **Step 4: Verify manifest in browser**

```bash
pnpm dev
```

DevTools → Application → Manifest. Confirm:
- Name: KidsTasky
- Shortcuts visible (3 items)
- Categories shown
- Icons: "any maskable" purpose listed
- Share target visible

- [ ] **Step 5: Run build to confirm no regressions**

```bash
pnpm build 2>&1 | tail -5
```

Expected: `✓ built in <Xs>`

- [ ] **Step 6: Commit**

```bash
git add index.html public/manifest.json
git commit -m "feat: polish PWA manifest — fix brand name, add shortcuts, categories, maskable icons"
```

---

## Testing Summary

| Task | How to verify |
|---|---|
| 1 — Vitest config | `pnpm test` — no DEPRECATED warning, same pass count |
| 2 — Offline SW | DevTools offline mode → app shell loads |
| 3 — Wake Lock | DevTools Application → Wake Locks → screen lock active in wall mode |
| 4 — Share Target | Visit `/?share_title=Test` → event fires, URL cleaned; OS share sheet on mobile |
| 5 — Manifest | DevTools Application → Manifest → all fields populated |

## Execution Order

Tasks are independent but prefer: 1 → 5 → 3 → 2 → 4 (quick wins first, server work last).
