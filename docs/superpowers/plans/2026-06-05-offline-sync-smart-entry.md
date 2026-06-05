# Offline Reliability & Smart Data Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform KidsTasky into a resilient, high-speed mobile companion by implementing an offline action queue and a "Tap-to-Refine" suggestion engine.

**Architecture:** Use `localStorage` to queue failed API requests (POST/PATCH/PUT/DELETE) and automatically flush them when connectivity returns. Enhance quick-entry inputs with a context-aware suggestion bar.

**Tech Stack:** React (TypeScript), Vitest, LocalStorage, Navigator Online API.

---

### Task 1: Offline Action Queue Utility

**Files:**
- Create: `src/lib/offline-queue.ts`
- Test: `src/lib/offline-queue.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/offline-queue.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { pushOfflineAction, getOfflineQueue, clearOfflineQueue } from './offline-queue';

describe('offline-queue', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and retrieves an offline action', () => {
    const action = {
      type: 'TOGGLE',
      entity: 'list_item',
      endpoint: '/lists/items/1/toggle',
      method: 'POST',
      body: JSON.stringify({ completed: true }),
      description: 'Toggle item'
    };
    pushOfflineAction(action as any);
    const queue = getOfflineQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].description).toBe('Toggle item');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/offline-queue.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/offline-queue.ts
export interface OfflineAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'TOGGLE';
  entity: 'task' | 'list_item' | 'completion';
  endpoint: string;
  method: string;
  body: string;
  timestamp: number;
  description: string;
}

const STORAGE_KEY = 'kidtasker_offline_queue';

export function getOfflineQueue(): OfflineAction[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function pushOfflineAction(action: Omit<OfflineAction, 'id' | 'timestamp'>) {
  const queue = getOfflineQueue();
  const newAction: OfflineAction = {
    ...action,
    id: crypto.randomUUID(),
    timestamp: Date.now()
  };
  queue.push(newAction);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function popOfflineAction(): OfflineAction | undefined {
  const queue = getOfflineQueue();
  const action = queue.shift();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  return action;
}

export function clearOfflineQueue() {
  localStorage.removeItem(STORAGE_KEY);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/offline-queue.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/offline-queue.ts src/lib/offline-queue.test.ts
git commit -m "feat: add offline action queue utility"
```

---

### Task 2: Intercept HTTP Failures

**Files:**
- Modify: `src/services/http.ts`

- [ ] **Step 1: Update fetchAPI to queue failures**

```typescript
// src/services/http.ts
import { pushOfflineAction } from '../lib/offline-queue';

// Inside fetchAPI loop, in the catch block:
// If error is a network error (status 0) and not a GET request:
if (err.status === 0 && options?.method && options.method !== 'GET') {
  pushOfflineAction({
    type: options.method === 'POST' ? 'CREATE' : 'UPDATE', // simplified
    entity: endpoint.includes('tasks') ? 'task' : 'list_item',
    endpoint,
    method: options.method,
    body: options.body as string || '',
    description: `Auto-queued ${options.method} to ${endpoint}`
  });
}
```

- [ ] **Step 2: Verify interception**

Manually mock a failure in `http.ts` or use a test to confirm `pushOfflineAction` is called when `fetch` throws.

- [ ] **Step 3: Commit**

```bash
git add src/services/http.ts
git commit -m "feat: intercept network errors and queue offline actions"
```

---

### Task 3: Global Sync Orchestrator

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement sync loop in App.tsx**

```typescript
// src/App.tsx
import { getOfflineQueue, popOfflineAction } from './lib/offline-queue';
import { fetchAPI } from './services/http';

// Inside App component:
const [syncing, setSyncing] = useState(false);
const [isOffline, setIsOffline] = useState(!navigator.onLine);

useEffect(() => {
  const handleOnline = () => setIsOffline(false);
  const handleOffline = () => setIsOffline(true);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}, []);

const flushQueue = useCallback(async () => {
  if (syncing || isOffline) return;
  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  setSyncing(true);
  try {
    while (getOfflineQueue().length > 0) {
      const action = popOfflineAction();
      if (!action) break;
      try {
        await fetchAPI(action.endpoint, {
          method: action.method,
          body: action.body
        }, 0); // No retries for sync flush
      } catch (e) {
        // If it's a 404 or 400, it's a conflict - skip it (Latest Action Wins)
        console.warn('Sync conflict or error, skipping action:', action.description, e);
      }
    }
  } finally {
    setSyncing(false);
  }
}, [syncing, isOffline]);

useEffect(() => {
  if (!isOffline) {
    void flushQueue();
  }
}, [isOffline, flushQueue]);
```

- [ ] **Step 2: Add Sync Indicator to Header**

```tsx
// Inside App.tsx header render:
{isOffline && (
  <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full animate-pulse">
    <span>☁️ Offline Mode</span>
  </div>
)}
{syncing && (
  <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
    <Activity className="w-3 h-3 animate-spin" />
    <span>Syncing...</span>
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: implement global sync orchestrator and UI indicator"
```

---

### Task 4: Suggestion Engine Logic

**Files:**
- Create: `src/lib/suggestions.ts`
- Test: `src/lib/suggestions.test.ts`

- [ ] **Step 1: Implement getQuickEntrySuggestions**

```typescript
// src/lib/suggestions.ts
import { UserProfile, Task } from '../types';

export type Suggestion = {
  id: string;
  label: string;
  type: 'who' | 'when' | 'where';
  value: string;
};

export function getQuickEntrySuggestions(
  text: string,
  kids: UserProfile[],
  history: any[] = []
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const lowerText = text.toLowerCase();

  // Who suggestions
  kids.forEach(kid => {
    suggestions.push({
      id: `who-${kid.uid}`,
      label: kid.name,
      type: 'who',
      value: `@${kid.name}`
    });
  });

  // When suggestions
  if (lowerText.length > 2) {
    suggestions.push({ id: 'when-6pm', label: '6:00 PM', type: 'when', value: '!6pm' });
    suggestions.push({ id: 'when-today', label: 'Today', type: 'when', value: '!today' });
  }

  return suggestions.slice(0, 5);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/suggestions.ts
git commit -m "feat: add basic suggestion engine logic"
```

---

### Task 5: Suggestion Bar Component

**Files:**
- Create: `src/components/shared/SuggestionBar.tsx`

- [ ] **Step 1: Implement SuggestionBar**

```tsx
// src/components/shared/SuggestionBar.tsx
import React from 'react';
import { Suggestion } from '../../lib/suggestions';

interface SuggestionBarProps {
  suggestions: Suggestion[];
  onSelect: (suggestion: Suggestion) => void;
}

export function SuggestionBar({ suggestions, onSelect }: SuggestionBarProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {suggestions.map(s => (
        <button
          key={s.id}
          onClick={() => onSelect(s)}
          className="flex-none px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-full whitespace-nowrap transition-colors"
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/SuggestionBar.tsx
git commit -m "feat: add SuggestionBar component"
```

---

### Task 6: Integrate Suggestion Bar in Shopping View

**Files:**
- Modify: `src/components/lists/ShoppingView.tsx`

- [ ] **Step 1: Integrate SuggestionBar**

```tsx
// src/components/lists/ShoppingView.tsx
import { SuggestionBar } from '../shared/SuggestionBar';
import { getQuickEntrySuggestions } from '../../lib/suggestions';
import { useFamilyData } from '../../contexts/FamilyDataContext';

// Inside component, near input:
const { kids } = useFamilyData();
const [inputText, setInputText] = useState('');
const suggestions = useMemo(() => getQuickEntrySuggestions(inputText, kids), [inputText, kids]);

// Render SuggestionBar above the input field
<SuggestionBar 
  suggestions={suggestions} 
  onSelect={(s) => {
    setInputText(prev => prev + ' ' + s.value);
    // Ideally auto-submit if it's a final selection
  }} 
/>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/lists/ShoppingView.tsx
git commit -m "feat: integrate suggestion bar in ShoppingView"
```
