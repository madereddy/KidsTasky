# Plan 08 — Bidirectional Google Calendar Sync

**Group:** B (requires Plan 01)
**Blocked by:** Plan 01 (events must exist and be manageable before push sync makes sense)

---

## Problem

Google Calendar sync is import-only. The background worker polls Google every 5 minutes and imports new events as `CalendarEvent` rows with `source='google'` and a stored `externalId`. KidsTasky-native events (created in Plan 01) are never pushed back to Google. Edits and deletes in KidsTasky are never reflected in the user's Google Calendar.

---

## What Already Exists

- `src/server/modules/sync/service.ts` — connection CRUD, Google OAuth token refresh, event import loop
- `src/server/modules/sync/routes.ts` — Google OAuth callback, manual connect
- `sync_connections` table — stores `accessToken`, `refreshToken`, `provider`
- `CalendarEvent.externalId` — populated for imported events, null for native events
- `CalendarEvent.source` — `'google'` for imported, null/undefined for native
- Background worker: imports every 5 min using `googleapis`

---

## Strategy

- **Native events** (no `externalId`, no `source`): on create → push to Google, store returned Google event ID as `externalId`
- **Imported events** (`source='google'`, has `externalId`): on update/delete → patch/delete in Google
- **Conflict rule**: last write wins. No merge logic needed for MVP.
- Google API errors do not fail the local operation — log and continue

---

## Files to Modify

### `src/server/modules/sync/service.ts`
Add push/update/delete methods using the `googleapis` client that's already imported:

```ts
import { google } from 'googleapis';

// Helper: get an authenticated Google Calendar client for a connection
function getCalendarClient(connection: SyncConnection) {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
  });
  return google.calendar({ version: 'v3', auth: oauth2 });
}

// Convert a CalendarEvent (Unix ms) to Google Calendar event resource
function toGoogleEvent(event: CalendarEvent) {
  return {
    summary: event.title,
    description: event.description,
    start: { dateTime: new Date(event.startTime).toISOString() },
    end:   { dateTime: new Date(event.endTime).toISOString() },
  };
}

export const syncService = {
  // ... existing methods ...

  pushEventToGoogle: async (parentId: string, event: CalendarEvent): Promise<string | null> => {
    const connection = syncService.getActiveGoogleConnection(parentId);
    if (!connection) return null;
    try {
      const calendar = getCalendarClient(connection);
      const res = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: toGoogleEvent(event),
      });
      return res.data.id ?? null; // Google event ID to store as externalId
    } catch (e) {
      console.error('Google push failed:', e);
      return null;
    }
  },

  updateEventInGoogle: async (parentId: string, event: CalendarEvent): Promise<void> => {
    if (!event.externalId) return;
    const connection = syncService.getActiveGoogleConnection(parentId);
    if (!connection) return;
    try {
      const calendar = getCalendarClient(connection);
      await calendar.events.patch({
        calendarId: 'primary',
        eventId: event.externalId,
        requestBody: toGoogleEvent(event),
      });
    } catch (e) {
      console.error('Google update failed:', e);
    }
  },

  deleteEventFromGoogle: async (parentId: string, externalId: string): Promise<void> => {
    const connection = syncService.getActiveGoogleConnection(parentId);
    if (!connection) return;
    try {
      const calendar = getCalendarClient(connection);
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: externalId,
      });
    } catch (e) {
      console.error('Google delete failed:', e);
    }
  },

  getActiveGoogleConnection: (parentId: string): SyncConnection | null => {
    return db.prepare(
      "SELECT * FROM sync_connections WHERE parentId = ? AND provider IN ('google') LIMIT 1"
    ).get(parentId) as SyncConnection | null;
  },
};
```

### `src/server/modules/events/routes.ts`
Hook into event write operations:

```ts
import { syncService } from '../sync/service.js';
import { eventsService } from './service.js';

// POST /events — after creating locally, push to Google
eventsRouter.post('/events', requireAuth, async (req, res) => {
  const event = eventsService.createEvent({ ...req.body, parentId: req.user.uid });
  res.status(201).json(event);

  // Fire-and-forget push to Google
  const googleId = await syncService.pushEventToGoogle(req.user.uid, event);
  if (googleId) {
    eventsService.setExternalId(event.id, googleId, 'google');
  }
});

// PUT /events/:id — update locally, then patch in Google
eventsRouter.put('/events/:id', requireAuth, async (req, res) => {
  eventsService.updateEvent(req.params.id, req.body);
  const updated = eventsService.getEvent(req.params.id);
  res.json(updated);

  if (updated?.externalId) {
    await syncService.updateEventInGoogle(req.user.uid, updated);
  } else {
    // Not yet in Google — push it now
    const googleId = await syncService.pushEventToGoogle(req.user.uid, updated);
    if (googleId) eventsService.setExternalId(updated.id, googleId, 'google');
  }
});

// DELETE /events/:id — delete locally, then delete from Google
eventsRouter.delete('/events/:id', requireAuth, async (req, res) => {
  const event = eventsService.getEvent(req.params.id);
  eventsService.deleteEvent(req.params.id);
  res.json({ success: true });

  if (event?.externalId) {
    await syncService.deleteEventFromGoogle(req.user.uid, event.externalId);
  }
});
```

### `src/server/modules/events/service.ts`
Add missing methods needed by routes:

```ts
getEvent: (id: string): CalendarEvent | null => {
  return db.prepare('SELECT * FROM events WHERE id = ?').get(id) as CalendarEvent | null;
},
updateEvent: (id: string, data: Partial<CalendarEvent>) => {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE events SET ${fields} WHERE id = ?`).run(...Object.values(data), id);
},
deleteEvent: (id: string) => {
  db.prepare('DELETE FROM events WHERE id = ?').run(id);
},
setExternalId: (id: string, externalId: string, source: string) => {
  db.prepare('UPDATE events SET externalId = ?, source = ? WHERE id = ?').run(externalId, source, id);
},
```

---

## Import Loop Guard (existing worker)

The background worker imports Google events every 5 minutes. After bidirectional sync, an event created in KidsTasky will appear in Google Calendar. The next worker poll would try to re-import it, creating a duplicate.

**Fix:** The existing import uses `externalId` deduplication — `WHERE externalId = ?` before inserting. This already prevents reimport as long as we set `externalId` on pushed events (done above via `setExternalId`). Verify this guard exists in the sync worker before shipping.

---

## Token Refresh

If Google returns a 401 during push/update/delete:
1. Call `syncService.refreshAccessToken(connection)` (already exists for the import loop)
2. Retry the operation once with the new token
3. If still failing, log and skip — do not throw

Add retry wrapper:
```ts
async function withTokenRefresh(connection, fn) {
  try {
    return await fn(connection);
  } catch (e: any) {
    if (e?.response?.status === 401) {
      const refreshed = await syncService.refreshAccessToken(connection);
      if (refreshed) return await fn(refreshed);
    }
    throw e;
  }
}
```

---

## Acceptance Criteria

- [ ] Creating an event in KidsTasky appears in Google Calendar within seconds
- [ ] Editing an event in KidsTasky updates the Google Calendar entry
- [ ] Deleting an event in KidsTasky removes it from Google Calendar
- [ ] Google API errors do not fail the local event operation
- [ ] No duplicate events created during the next import poll cycle
- [ ] Token refresh is attempted once on 401 before giving up
- [ ] If no Google connection exists, all operations proceed locally with no errors
