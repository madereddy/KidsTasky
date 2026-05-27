# Calendar Visibility API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement server-side routes and client-side service methods to manage calendar visibility per user.

**Architecture:** Add new methods to `settingsService` on the server to interact with the `calendar_visibility` table. Expose these through new routes in `settingsRouter`. Add corresponding methods to `settingsClientService` on the client.

**Tech Stack:** Express (Server), SQLite (Database), TypeScript, fetchAPI (Client)

---

### Task 1: Update Server-side Settings Service

**Files:**
- Modify: `src/server/modules/settings/service.ts`

- [ ] **Step 1: Add visibility methods to `settingsService`**

```typescript
// ... inside settingsService ...
  getCalendarVisibility: (userId: string) => {
    return db.prepare('SELECT calendarId, isVisible FROM calendar_visibility WHERE userId = ?')
      .all(userId) as Array<{ calendarId: string; isVisible: number }>;
  },
  setCalendarVisibility: (userId: string, calendarId: string, isVisible: boolean) => {
    db.prepare(`
      INSERT INTO calendar_visibility (userId, calendarId, isVisible)
      VALUES (?, ?, ?)
      ON CONFLICT(userId, calendarId) DO UPDATE SET isVisible = excluded.isVisible
    `).run(userId, calendarId, isVisible ? 1 : 0);
  }
```

- [ ] **Step 2: Verify code structure**

---

### Task 2: Add Server-side Routes

**Files:**
- Modify: `src/server/modules/settings/routes.ts`

- [ ] **Step 1: Add GET and POST routes for visibility**

```typescript
settingsRouter.get('/settings/visibility', requireAuth, (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const visibility = settingsService.getCalendarVisibility(userId);
    res.json(visibility);
  } catch (error: any) {
    console.error('[settings:get-visibility]', error);
    res.status(500).json({ error: error.message });
  }
});

settingsRouter.post('/settings/visibility', requireAuth, (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const { calendarId, isVisible } = req.body;
    if (!calendarId) return res.status(400).json({ error: 'calendarId is required' });
    
    settingsService.setCalendarVisibility(userId, calendarId, !!isVisible);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[settings:post-visibility]', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

### Task 3: Update Client-side Service

**Files:**
- Modify: `src/services/settings.ts`

- [ ] **Step 1: Add visibility methods to `settingsClientService`**

```typescript
// ... inside settingsClientService ...
  getCalendarVisibility: (): Promise<Array<{ calendarId: string; isVisible: number }>> =>
    fetchAPI('/settings/visibility'),
  setCalendarVisibility: (calendarId: string, isVisible: boolean): Promise<{ success: boolean }> =>
    fetchAPI('/settings/visibility', { 
      method: 'POST', 
      body: JSON.stringify({ calendarId, isVisible: isVisible ? 1 : 0 }) 
    }),
```

---

### Task 4: Verification and Commit

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: Success

- [ ] **Step 2: Commit changes**

```bash
git add src/server/modules/settings/service.ts src/server/modules/settings/routes.ts src/services/settings.ts
git commit -m "feat: add calendar visibility api"
```
