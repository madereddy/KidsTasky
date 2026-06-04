# Smart Lists (KitchenOwl Killer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the basic Lists feature into a smart grocery manager with store tagging, filtering, and frequent item suggestions.

**Architecture:** We will extend the `AppListItem` type to support `storeName` and `completedAt`. Since we want to avoid immediate backend changes, we will use a JSON delimiter trick (`|META:{"storeName":"Costco","completedAt":123456789}|`) within the `text` field for storage, and parse it out in `useListsController`. The UI will gain a `StoreFilterBar` and `SmartListInput`.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide React.

---

### Task 1: Type Enhancements and Metadata Parsing

**Files:**
- Modify: `src/types.ts`
- Modify: `src/hooks/useListsController.ts`
- Test: `src/hooks/useListsController.test.tsx`

- [ ] **Step 1: Write the failing test for metadata parsing**

```tsx
// Add to src/hooks/useListsController.test.tsx
import { renderHook, act } from '@testing-library/react';
import { useListsController } from './useListsController';
import { listsClientService } from '../services/lists';
import { vi, describe, it, expect } from 'vitest';

vi.mock('../services/lists');

describe('useListsController - Smart Metadata', () => {
  it('parses storeName and completedAt from text field', async () => {
    vi.mocked(listsClientService.getLists).mockResolvedValue([{ id: 'list-1', parentId: 'parent-1', title: 'Groceries' }]);
    vi.mocked(listsClientService.getItems).mockResolvedValue([
      { id: 'item-1', listId: 'list-1', text: 'Milk |META:{"storeName":"Costco","completedAt":1700000000000}|', completed: 1 }
    ]);

    const { result } = renderHook(() => useListsController({ parentId: 'parent-1' }));
    
    await act(async () => {
      await result.current.loadLists();
    });
    
    await act(async () => {
      await result.current.loadItems('list-1');
    });

    expect(result.current.items[0].text).toBe('Milk');
    expect(result.current.items[0].storeName).toBe('Costco');
    expect(result.current.items[0].completedAt).toBe(1700000000000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/hooks/useListsController.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Update `src/types.ts` and `useListsController.ts`**

```typescript
// Add to src/types.ts
export interface AppListItem {
  id: string;
  listId: string;
  text: string;
  completed: number; 
  storeName?: string;
  completedAt?: number;
}
```

```typescript
// Modify src/hooks/useListsController.ts
// Add this helper function at the top of the file
function parseItemMetadata(item: AppListItem): AppListItem {
  const match = item.text.match(/(.*?)\s*\|META:(.+?)\|$/);
  if (match) {
    try {
      const meta = JSON.parse(match[2]);
      return {
        ...item,
        text: match[1].trim(),
        storeName: meta.storeName,
        completedAt: meta.completedAt
      };
    } catch (e) {
      return item;
    }
  }
  return item;
}

function stringifyItemMetadata(text: string, storeName?: string, completedAt?: number): string {
  if (!storeName && !completedAt) return text;
  return `${text} |META:${JSON.stringify({ storeName, completedAt })}|`;
}

// Inside useListsController:
// 1. Update loadItems to map parsed items
  const loadItems = useCallback(async (listId: string | null = selectedListId) => {
    // ...
      const nextItems = await listsClientService.getItems(listId);
      setItems((nextItems || []).map(parseItemMetadata));
    // ...
  }, [selectedListId]);

// 2. Update toggleItem to append completedAt if completing
  const toggleItem = async (itemId: string, completed: boolean) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    const completedAt = completed ? Date.now() : undefined;
    const rawText = stringifyItemMetadata(item.text, item.storeName, completedAt);
    
    // We have to send the rawText via a hypothetical updateItem, OR we just ignore saving completedAt to the server for now 
    // since listsClientService.toggleItem only accepts `completed`. 
    // For this plan, we will just update the LOCAL state to have completedAt, 
    // and rely on a real API update in the future if we need it permanently.
    await listsClientService.toggleItem(itemId, completed);
    setItems((prev) => prev.map((i) => (
      i.id === itemId ? { ...i, completed: completed ? 1 : 0, completedAt } : i
    )));
  };
```

*Correction: Since `listsClientService.toggleItem` doesn't take `text`, we can't save `completedAt` to the backend when checking it off without modifying the backend. We will keep it local for this session, which means Frequent Items will only work for items completed during this active session until the backend is updated. We'll proceed with local `completedAt` state for now.*

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/hooks/useListsController.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/hooks/useListsController.ts src/hooks/useListsController.test.tsx
git commit -m "feat: add metadata parsing for lists"
```

---

### Task 2: Smart Addition Logic (Parsing & Memory)

**Files:**
- Modify: `src/hooks/useListsController.ts`
- Test: `src/hooks/useListsController.test.tsx`

- [ ] **Step 1: Write the failing test for smart addition**

```tsx
// Add to src/hooks/useListsController.test.tsx
  it('adds item with explicit store parsing', async () => {
    vi.mocked(listsClientService.addItem).mockResolvedValue({
      id: 'item-2', listId: 'list-1', text: 'Eggs |META:{"storeName":"Costco"}|', completed: 0
    });

    const { result } = renderHook(() => useListsController({ parentId: 'parent-1' }));
    
    await act(async () => {
      result.current.setSelectedListId('list-1');
      await result.current.addItem('Eggs @ Costco');
    });

    expect(listsClientService.addItem).toHaveBeenCalledWith('list-1', 'Eggs |META:{"storeName":"Costco"}|');
    expect(result.current.items[0].text).toBe('Eggs');
    expect(result.current.items[0].storeName).toBe('Costco');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/hooks/useListsController.test.tsx`

- [ ] **Step 3: Implement smart parsing in `addItem`**

```typescript
// In src/hooks/useListsController.ts
// Add parse helper
function extractStoreFromText(rawText: string): { cleanText: string, storeName?: string } {
  const match = rawText.match(/(.+?)(?:\s+@\s+|\s+at\s+)(Costco|Walmart|Target|Trader Joe's|Aldi|Whole Foods)$/i);
  if (match) {
    return { cleanText: match[1].trim(), storeName: match[2].trim() };
  }
  return { cleanText: rawText.trim() };
}

// Update addItem
  const addItem = async (text: string, explicitStore?: string) => {
    if (!selectedListId) return null;
    
    const { cleanText, storeName: parsedStore } = extractStoreFromText(text);
    const finalStore = explicitStore || parsedStore;
    
    const rawText = stringifyItemMetadata(cleanText, finalStore);
    const created = await listsClientService.addItem(selectedListId, rawText);
    
    const parsedCreated = parseItemMetadata(created);
    setItems((prev) => [...prev, parsedCreated]);
    return parsedCreated;
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/hooks/useListsController.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useListsController.ts src/hooks/useListsController.test.tsx
git commit -m "feat: natural language parsing for store names"
```

---

### Task 3: StoreFilterBar Component

**Files:**
- Create: `src/components/lists/StoreFilterBar.tsx`
- Modify: `src/components/lists/ListsView.tsx`

- [ ] **Step 1: Create `StoreFilterBar`**

```tsx
// src/components/lists/StoreFilterBar.tsx
import React from 'react';
import { cn } from '../../lib/utils';
import { AppListItem } from '../../types';

interface StoreFilterBarProps {
  items: AppListItem[];
  activeStore: string | null;
  onSelectStore: (store: string | null) => void;
}

export function StoreFilterBar({ items, activeStore, onSelectStore }: StoreFilterBarProps) {
  // Get unique store names from uncompleted items
  const stores = Array.from(new Set(items.filter(i => i.completed === 0 && i.storeName).map(i => i.storeName as string)));
  
  if (stores.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto p-3 border-b border-ui bg-ui-soft hide-scrollbar">
      <button
        onClick={() => onSelectStore(null)}
        className={cn(
          "px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border",
          activeStore === null ? "bg-ui-primary text-white border-ui-primary" : "bg-white text-ui-muted border-ui hover:bg-ui-soft-2"
        )}
      >
        All
      </button>
      {stores.map(store => {
        const count = items.filter(i => i.completed === 0 && i.storeName === store).length;
        return (
          <button
            key={store}
            onClick={() => onSelectStore(store)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border flex items-center gap-1",
              activeStore === store ? "bg-blue-500 text-white border-blue-500" : "bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
            )}
          >
            {store} <span className="opacity-70">({count})</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Integrate into `ListsView`**

```tsx
// In src/components/lists/ListsView.tsx
import { StoreFilterBar } from './StoreFilterBar';
// ... inside ListsView component ...
const [activeStoreFilter, setActiveStoreFilter] = useState<string | null>(null);

// Filter items before passing to ListSidebar
const filteredItems = activeStoreFilter 
  ? items.filter(i => i.completed === 1 || i.storeName === activeStoreFilter)
  : items;

// ... in render, below the header:
<StoreFilterBar items={items} activeStore={activeStoreFilter} onSelectStore={setActiveStoreFilter} />
<ListSidebar
  listTitle={selectedList.title}
  items={filteredItems}
  // ...
```

- [ ] **Step 3: Commit**

```bash
git add src/components/lists/StoreFilterBar.tsx src/components/lists/ListsView.tsx
git commit -m "feat: add StoreFilterBar to ListsView"
```

---

### Task 4: SmartListInput (Chips & Badges)

**Files:**
- Modify: `src/components/lists/ListSidebar.tsx`

- [ ] **Step 1: Enhance `ListSidebar` input with Store Chips**

```tsx
// In src/components/lists/ListSidebar.tsx
// Add state for selectedStoreChip
const [selectedStoreChip, setSelectedStoreChip] = useState<string | null>(null);
const COMMON_STORES = ['Costco', 'Walmart', 'Target', 'Trader Joe\'s', 'Grocery'];

// Update handleSubmit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    // Assuming onAddItem can take a second parameter for explicit store
    onAddItem(newItemText.trim(), selectedStoreChip || undefined);
    setNewItemText('');
    setSelectedStoreChip(null); // Reset after adding
  };

// Replace the standard form with this structure:
<div className="p-3 border-t border-ui bg-white flex flex-col gap-2 shrink-0">
  <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
    {COMMON_STORES.map(store => (
      <button
        key={store}
        type="button"
        onClick={() => setSelectedStoreChip(prev => prev === store ? null : store)}
        className={cn(
          "px-2.5 py-1 rounded-md text-[10px] font-bold whitespace-nowrap transition-colors border",
          selectedStoreChip === store ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-ui-soft text-ui-muted border-transparent hover:bg-ui-soft-2"
        )}
      >
        {store}
      </button>
    ))}
  </div>
  <form onSubmit={handleSubmit} className="flex gap-2">
    {/* existing input and button */}
  </form>
</div>
```

- [ ] **Step 2: Add Store Badges to list items**

```tsx
// In src/components/lists/ListSidebar.tsx, inside the item mapping:
<span className={cn("text-sm font-medium break-words", item.completed ? "text-ui-muted line-through" : "text-ui-primary")}>
  {item.text}
</span>
{item.storeName && !item.completed && (
  <span className="ml-2 inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold uppercase rounded-sm border border-blue-200">
    {item.storeName}
  </span>
)}
```

- [ ] **Step 3: Update `ListsView` to pass explicit store**

```tsx
// In src/components/lists/ListsView.tsx
  const handleAddItem = async (text: string, explicitStore?: string) => {
    await addItem(text, explicitStore);
  };
```

- [ ] **Step 4: Commit**

```bash
git add src/components/lists/ListSidebar.tsx src/components/lists/ListsView.tsx
git commit -m "feat: add store chips and badges to lists"
```
