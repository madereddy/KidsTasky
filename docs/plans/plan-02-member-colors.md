# Plan 02 — Per-Member Color Coding + Event Filtering

**Group:** B (requires Plan 01)
**Blocked by:** Plan 01 (calendar views must exist to display colors)

---

## Problem

Every family member looks identical on the calendar. Events have a per-event `color` field but nothing ties colors to people. Skylight's core UX is that each family member has an assigned color and every event they own shows in that color everywhere on the calendar.

---

## What Already Exists

- `UserProfile` type — no `color` field
- `CalendarEvent.assignedToId?: string` — member assignment exists on events
- `CalendarEvent.color: string` — per-event color (fallback when no member color)
- `CATEGORY_COLORS` array in `src/constants.ts` — reuse this palette
- `kids` array available in `ParentDashboard` (fetched from `userService.getKidsForParent`)

---

## Database

### Migration `014_add_user_color.sql`
Create at `src/server/migrations/014_add_user_color.sql`:

```sql
ALTER TABLE users ADD COLUMN color TEXT DEFAULT '#6366f1';
```

---

## Files to Create

### `src/services/users.ts` — add method
```ts
setMemberColor: async (uid: string, color: string) =>
  fetchAPI(`/users/${uid}/color`, { method: 'PUT', body: JSON.stringify({ color }) })
```

---

## Files to Modify

### `src/types.ts`
Add to `UserProfile`:
```ts
color?: string;
```

### `src/constants.ts`
Add member color palette:
```ts
export const MEMBER_COLORS = [
  '#6366f1', // indigo
  '#f43f5e', // rose
  '#f59e0b', // amber
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#f97316', // orange
  '#06b6d4', // cyan
  '#ec4899', // pink
];
```

### `src/server/modules/users/routes.ts`
Add endpoint:
```ts
usersRouter.put('/users/:uid/color', requireAuth, (req, res) => {
  const { color } = req.body;
  // validate color is a hex string
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return res.status(400).json({ error: 'Invalid color' });
  userService.setMemberColor(req.params.uid, color);
  res.json({ success: true });
});
```

### `src/server/modules/users/service.ts`
Add:
```ts
setMemberColor: (uid: string, color: string) => {
  db.prepare('UPDATE users SET color = ? WHERE uid = ?').run(color, uid);
}
```

### `src/App.tsx`
- After fetching profile and kids, build `memberColorMap: Record<string, string>`:
  ```ts
  const memberColorMap = [profile, ...kids].reduce((acc, u) => {
    acc[u.uid] = u.color ?? MEMBER_COLORS[0];
    return acc;
  }, {} as Record<string, string>);
  ```
- Pass `memberColorMap` and `kids` as props to `CalendarView`

### `src/components/calendar/CalendarView.tsx` (from Plan 01)
- Accept `memberColorMap: Record<string, string>` prop
- Pass it down to all sub-views (MonthView, WeekView, DayView, AgendaView)
- Build member filter state:
  ```ts
  const [visibleMemberIds, setVisibleMemberIds] = useState<Set<string>>(new Set(['all']));
  ```
- Filter events before passing to sub-views:
  ```ts
  const visibleEvents = visibleMemberIds.has('all')
    ? events
    : events.filter(e => !e.assignedToId || visibleMemberIds.has(e.assignedToId));
  ```

**Member filter chip row** (render in CalendarView header, below view-switcher):
- "All" chip (active when `visibleMemberIds` has `'all'`)
- One chip per family member: colored dot + member name initial
- Click a member chip: toggle that uid in `visibleMemberIds`, remove `'all'`
- Click "All": reset to `new Set(['all'])`

### `src/components/parent/ParentDashboard.tsx`
In the "Linked Cadets" panel, add a color dot to each kid's avatar:
- Small circle rendered with `style={{ backgroundColor: kid.color ?? MEMBER_COLORS[0] }}`
- Click the dot → inline color picker (a small grid of `MEMBER_COLORS` swatches)
- On swatch click: call `setMemberColor(kid.uid, color)` then refresh the kids list
- Parent's own color is set from the profile avatar in the header (add same color picker there)

### All calendar sub-views (from Plan 01)
Wherever an event chip is rendered, derive color as:
```ts
const eventColor = memberColorMap[event.assignedToId ?? ''] ?? event.color ?? '#6366f1';
```

---

## Acceptance Criteria

- [ ] Each family member can be assigned a unique color
- [ ] Color assignment UI is accessible on the parent dashboard
- [ ] All calendar views display events in the assigned member's color
- [ ] Member filter chips appear on the calendar header
- [ ] Toggling a member chip hides/shows their events
- [ ] "All" chip restores the full view
- [ ] Color persists across page reloads (stored in DB)
