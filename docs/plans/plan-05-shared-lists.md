# Plan 05 — Shared Lists UI

**Group:** A (no dependencies, start immediately)

---

## Problem

The backend schema for lists and list items is fully built. `listsService` provides read-only `getLists` and `getListItems`. The router has those two GET endpoints. `ListSidebar.tsx` exists but only renders items — it has no ability to add/delete items, no add-list UI, and is never mounted anywhere in the app.

---

## What Already Exists

- `AppList` type: `{ id, parentId, title }`
- `AppListItem` type: `{ id, listId, text, completed: number }`
- `src/server/modules/lists/service.ts` — `getLists(parentId)`, `getListItems(listId)` (reads only)
- `src/server/modules/lists/routes.ts` — `GET /parents/:parentId/lists`, `GET /lists/:listId/items`
- `src/components/lists/ListSidebar.tsx` — renders item list with toggle checkboxes; accepts `onToggleItem` prop but no add/delete

---

## Files to Modify

### `src/server/modules/lists/service.ts`
Add write operations:

```ts
createList: (parentId: string, title: string): AppList => {
  const id = randomUUID();
  db.prepare('INSERT INTO lists (id, parentId, title) VALUES (?, ?, ?)').run(id, parentId, title);
  return { id, parentId, title };
},
deleteList: (id: string) => {
  db.prepare('DELETE FROM list_items WHERE listId = ?').run(id); // cascade
  db.prepare('DELETE FROM lists WHERE id = ?').run(id);
},
addItem: (listId: string, text: string): AppListItem => {
  const id = randomUUID();
  db.prepare('INSERT INTO list_items (id, listId, text, completed) VALUES (?, ?, ?, 0)').run(id, listId, text);
  return { id, listId, text, completed: 0 };
},
toggleItem: (itemId: string, completed: boolean) => {
  db.prepare('UPDATE list_items SET completed = ? WHERE id = ?').run(completed ? 1 : 0, itemId);
},
deleteItem: (itemId: string) => {
  db.prepare('DELETE FROM list_items WHERE id = ?').run(itemId);
},
```

### `src/server/modules/lists/routes.ts`
Add write endpoints:

```ts
listsRouter.post('/lists', requireAuth, (req, res) => {
  const { title } = req.body;
  const list = listsService.createList(req.user.uid, title);
  res.status(201).json(list);
});

listsRouter.delete('/lists/:id', requireAuth, (req, res) => {
  listsService.deleteList(req.params.id);
  res.json({ success: true });
});

listsRouter.post('/lists/:listId/items', requireAuth, (req, res) => {
  const item = listsService.addItem(req.params.listId, req.body.text);
  res.status(201).json(item);
});

listsRouter.put('/list-items/:itemId', requireAuth, (req, res) => {
  listsService.toggleItem(req.params.itemId, req.body.completed);
  res.json({ success: true });
});

listsRouter.delete('/list-items/:itemId', requireAuth, (req, res) => {
  listsService.deleteItem(req.params.itemId);
  res.json({ success: true });
});
```

### `src/components/lists/ListSidebar.tsx`
Extend existing component with full CRUD:

**Add to props:**
```ts
onAddItem: (text: string) => void;
onDeleteItem: (id: string) => void;
onDeleteList?: () => void;
```

**Add at bottom of item list:**
```tsx
<form onSubmit={handleAddItem} className="mt-4 flex gap-2">
  <input
    value={newItemText}
    onChange={e => setNewItemText(e.target.value)}
    placeholder="Add item..."
    className="flex-1 border rounded-lg px-3 py-2 text-sm"
  />
  <button type="submit" className="p-2 bg-blue-500 text-white rounded-lg">
    <Plus size={16} />
  </button>
</form>
```

**Add delete button per item:**
```tsx
<button onClick={() => onDeleteItem(item.id)} className="ml-auto text-gray-300 hover:text-red-400">
  <Trash2 size={14} />
</button>
```

**Add delete list button in header** (shown if `onDeleteList` is provided, with a confirm step).

---

## Files to Create

### `src/services/lists.ts`

```ts
import { fetchAPI } from './http';
import { AppList, AppListItem } from '../types';

export const listsClientService = {
  getLists: (parentId: string): Promise<AppList[]> =>
    fetchAPI(`/parents/${parentId}/lists`),
  createList: (title: string): Promise<AppList> =>
    fetchAPI('/lists', { method: 'POST', body: JSON.stringify({ title }) }),
  deleteList: (id: string): Promise<void> =>
    fetchAPI(`/lists/${id}`, { method: 'DELETE' }),
  getItems: (listId: string): Promise<AppListItem[]> =>
    fetchAPI(`/lists/${listId}/items`),
  addItem: (listId: string, text: string): Promise<AppListItem> =>
    fetchAPI(`/lists/${listId}/items`, { method: 'POST', body: JSON.stringify({ text }) }),
  toggleItem: (itemId: string, completed: boolean): Promise<void> =>
    fetchAPI(`/list-items/${itemId}`, { method: 'PUT', body: JSON.stringify({ completed }) }),
  deleteItem: (itemId: string): Promise<void> =>
    fetchAPI(`/list-items/${itemId}`, { method: 'DELETE' }),
};
```

### `src/components/lists/ListsView.tsx`
Full lists management screen (replaces `ListSidebar` as a page-level view).

**Layout:**
- Left: list selector panel
  - One row per list: title, item count badge, delete button
  - "+ New List" input at bottom (Enter to create)
- Right: `ListSidebar` rendered inline (not as a fixed drawer) for the selected list

**State:**
- `lists: AppList[]`
- `selectedListId: string | null`
- `items: AppListItem[]` (loaded when selectedListId changes)

**On mount:** fetch all lists. Auto-select first list if any exist.

**"Copy all items" button** (useful for grocery lists):
- Copies all unchecked items as a newline-separated text string to clipboard
- Uses `navigator.clipboard.writeText()`

**Note on ListSidebar:** For `ListsView`, render `ListSidebar` with `isOpen={true}` and no fixed positioning override (or extract the inner content into a shared sub-component). The fixed-drawer behavior of `ListSidebar` is only needed when it's used as an overlay; here it renders inline.

### `src/App.tsx`
- Add "Lists" tab to parent navigation
- Render `<ListsView parentId={profile.uid} />` when active

---

## Acceptance Criteria

- [ ] Parent can see all their lists in a sidebar or tab
- [ ] New list can be created with a title
- [ ] List can be deleted (with cascade delete of items)
- [ ] Items can be added to any list via text input
- [ ] Items can be checked/unchecked (persists to DB)
- [ ] Items can be deleted individually
- [ ] "Copy items" copies unchecked items to clipboard
- [ ] Lists section accessible from the main nav
