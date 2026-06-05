# Shopping Tab Separation & Unified Family Routines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate "Shopping" into its own high-speed tab with frequent item suggestions, and unify other lists under "Routines," while streamlining mobile navigation.

**Architecture:** 
- Add a `category` field to the `lists` table in SQLite.
- Update `useListsController` to provide a unified shopping data stream.
- Re-architect `BottomNav` for a 5-tab layout (Home, Cal, Shop, Tools, Switch).
- Replace `ListsView` with `ShoppingView` (unified) and `RoutinesView` (sidebar-based).

**Tech Stack:** React (TypeScript), SQLite (Better-SQLite3), Tailwind CSS, Lucide Icons, Framer Motion.

---

### Task 1: Database Migration - Add List Categories

**Files:**
- Modify: `src/server/db.ts`
- Modify: `src/server/migrate.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Update TypeScript types**
Update `List` interface to include `category`.

```typescript
// src/types.ts
export interface List {
  id: string;
  parentId: string;
  title: string;
  locationName?: string;
  isRoutine: number;
  category: 'shopping' | 'routine'; // Add this
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Update Schema in db.ts**
Update the table creation string.

```typescript
// src/server/db.ts
// In the CREATE TABLE IF NOT EXISTS lists section:
// category TEXT DEFAULT 'routine',
```

- [ ] **Step 3: Create Migration in migrate.ts**
Add a migration to add the column to existing databases.

```typescript
// src/server/migrate.ts
// Add to migration steps:
// db.exec("ALTER TABLE lists ADD COLUMN category TEXT DEFAULT 'routine'");
```

- [ ] **Step 4: Commit**
```bash
git add src/types.ts src/server/db.ts src/server/migrate.ts
git commit -m "db: add category column to lists table"
```

---

### Task 2: Update Lists Controller & API

**Files:**
- Modify: `src/server/modules/lists/routes.ts`
- Modify: `src/services/lists.ts`
- Modify: `src/hooks/useListsController.ts`

- [ ] **Step 1: Update API Route**
Ensure the `category` is handled in `POST /lists` and `PATCH /lists/:id`.

- [ ] **Step 2: Update Lists Service**
Update the client-side service to pass the category.

- [ ] **Step 3: Update useListsController**
Update the hook to filter lists by category and provide a `shoppingItems` aggregate.

```typescript
// src/hooks/useListsController.ts
// Add logic to aggregate items from all lists where category === 'shopping'
```

- [ ] **Step 4: Commit**
```bash
git add src/server/modules/lists/routes.ts src/services/lists.ts src/hooks/useListsController.ts
git commit -m "feat: support categorized lists in controller"
```

---

### Task 3: Create ShoppingView Component

**Files:**
- Create: `src/components/lists/ShoppingView.tsx`
- Create: `src/components/lists/FrequentItems.tsx`

- [ ] **Step 1: Implement FrequentItems component**
A horizontal scrolling row of the top 15 items based on frequency in `items` history.

- [ ] **Step 2: Implement ShoppingView**
A unified list view without a sidebar, showing all items from shopping lists.

- [ ] **Step 3: Commit**
```bash
git add src/components/lists/ShoppingView.tsx src/components/lists/FrequentItems.tsx
git commit -m "feat: add ShoppingView with frequent items"
```

---

### Task 4: Refactor ListsView to RoutinesView

**Files:**
- Rename: `src/components/lists/ListsView.tsx` -> `src/components/lists/RoutinesView.tsx`
- Modify: `src/components/lists/RoutinesView.tsx`

- [ ] **Step 1: Rename and Refactor**
Update the component to filter for `category === 'routine'`.

- [ ] **Step 2: Commit**
```bash
git add src/components/lists/RoutinesView.tsx
git commit -m "refactor: rename ListsView to RoutinesView"
```

---

### Task 5: Mobile Navigation Overhaul (BottomNav & ToolsMenu)

**Files:**
- Modify: `src/components/shared/BottomNav.tsx`
- Create: `src/components/shared/ToolsMenu.tsx`

- [ ] **Step 1: Update BottomNav.tsx**
Implement the 5-tab layout: Home, Calendar, Shopping, Tools, Switch.

- [ ] **Step 2: Implement ToolsMenu.tsx**
An overlay modal/menu for Routines, Meals, and Tasks.

- [ ] **Step 3: Commit**
```bash
git add src/components/shared/BottomNav.tsx src/components/shared/ToolsMenu.tsx
git commit -m "ui: implement new 5-tab mobile navigation and Tools menu"
```

---

### Task 6: App.tsx Integration & Routing

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update Section State**
Add `shopping` and `routines` to the `activeSection` type.

- [ ] **Step 2: Update Render Logic**
Render `ShoppingView` and `RoutinesView` based on the new sections.
Update the mobile `ActionBolt` and `BottomNav` handlers.

- [ ] **Step 3: Commit**
```bash
git add src/App.tsx
git commit -m "feat: integrate Shopping and Routines views into App navigation"
```
