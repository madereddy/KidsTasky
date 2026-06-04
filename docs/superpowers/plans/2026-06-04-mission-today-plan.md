# Mission Today Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first, high-density "Today" view that aggregates calendar events, tasks, and grocery items into a single swipeable feed with a floating "Action Bolt" for quick entries.

**Architecture:** A unified `useMissionTodayController` will aggregate data from existing contexts. A responsive `MissionTodayView` will replace the standard dashboard on small screens, using `framer-motion` for gesture-based "swipe to approve/done" actions.

**Tech Stack:** React, TypeScript, Tailwind CSS, Framer Motion (`motion/react`), Lucide React.

---

### Task 1: Core Types and Mission Controller

**Files:**
- Modify: `src/types.ts`
- Create: `src/hooks/useMissionTodayController.ts`
- Test: `src/hooks/useMissionTodayController.test.tsx`

- [ ] **Step 1: Define the `MissionItem` type in `src/types.ts`**

```typescript
// Add to src/types.ts
export interface MissionItem {
  id: string;
  type: 'event' | 'task' | 'list_item';
  title: string;
  subtitle?: string;
  time?: string;
  status: 'pending' | 'needs_approval' | 'completed';
  color?: string;
  originalData: any;
  assignedToId?: string;
  storeName?: string; // For grocery items
}
```

- [ ] **Step 2: Create the `useMissionTodayController` hook**

```typescript
// src/hooks/useMissionTodayController.ts
import { useMemo } from 'react';
import { MissionItem, UserProfile, Task, CalendarEvent, AppListItem } from '../types';

interface UseMissionTodayOptions {
  profile: UserProfile;
  tasks: Task[];
  events: CalendarEvent[];
  listItems: AppListItem[];
  kids: UserProfile[];
}

export function useMissionTodayController({ profile, tasks, events, listItems, kids }: UseMissionTodayOptions) {
  const missionItems = useMemo(() => {
    const items: MissionItem[] = [];

    // 1. Process Tasks
    tasks.forEach(task => {
      const isAssigned = task.assignedKidId === profile.uid || profile.role === 'parent';
      if (!isAssigned || task.status === 'archived') return;

      items.push({
        id: `task_${task.id}`,
        type: 'task',
        title: task.title,
        subtitle: task.requiresApproval ? 'Needs approval' : undefined,
        status: task.requiresApproval ? 'needs_approval' : 'pending',
        color: task.categoryId ? 'bg-sky-500' : undefined,
        originalData: task,
        assignedToId: task.assignedKidId
      });
    });

    // 2. Process Events (Today only)
    const today = new Date().toISOString().split('T')[0];
    events.forEach(event => {
      const eventDate = new Date(event.startTime).toISOString().split('T')[0];
      if (eventDate !== today) return;

      items.push({
        id: `event_${event.id}`,
        type: 'event',
        title: event.title,
        time: new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'pending',
        color: event.color,
        originalData: event
      });
    });

    // 3. Process List Items (Grocery focus)
    listItems.forEach(item => {
      if (item.completed) return;
      items.push({
        id: `list_${item.id}`,
        type: 'list_item',
        title: item.text,
        status: 'pending',
        originalData: item
      });
    });

    return items.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }, [profile, tasks, events, listItems]);

  return { missionItems };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types.ts src/hooks/useMissionTodayController.ts
git commit -m "feat: add mission today controller and types"
```

---

### Task 2: SwipeableRow Component

**Files:**
- Create: `src/components/shared/SwipeableRow.tsx`

- [ ] **Step 1: Implement `SwipeableRow` using `motion/react`**

```tsx
// src/components/shared/SwipeableRow.tsx
import React from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { Check, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SwipeableRowProps {
  children: React.ReactNode;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  rightLabel?: string;
  leftLabel?: string;
  className?: string;
}

export function SwipeableRow({ children, onSwipeRight, onSwipeLeft, rightLabel = "Done", leftLabel = "Dismiss", className }: SwipeableRowProps) {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-100, 0, 100], [0.5, 1, 0.5]);
  const background = useTransform(x, [-100, 0, 100], ['#f59e0b', 'transparent', '#10b981']);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 100) onSwipeRight();
    else if (info.offset.x < -100) onSwipeLeft();
  };

  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      <motion.div style={{ background }} className="absolute inset-0 flex items-center justify-between px-6">
        <div className="flex items-center gap-2 text-white font-bold"><Check size={20} /> {rightLabel}</div>
        <div className="flex items-center gap-2 text-white font-bold">{leftLabel} <X size={20} /></div>
      </motion.div>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        style={{ x, opacity }}
        onDragEnd={handleDragEnd}
        className="relative bg-white border border-ui p-4 rounded-xl cursor-grab active:cursor-grabbing"
      >
        {children}
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/SwipeableRow.tsx
git commit -m "feat: add SwipeableRow for mobile gestures"
```

---

### Task 3: Mission Today View (The "Today" Feed)

**Files:**
- Create: `src/components/shared/MissionTodayView.tsx`

- [ ] **Step 1: Create the base `MissionTodayView`**

```tsx
// src/components/shared/MissionTodayView.tsx
import React from 'react';
import { useMissionTodayController } from '../../hooks/useMissionTodayController';
import { SwipeableRow } from './SwipeableRow';
import { MissionItem, UserProfile } from '../../types';
import { Calendar, CheckCircle2, ShoppingCart } from 'lucide-react';

interface MissionTodayViewProps {
  profile: UserProfile;
  tasks: any[];
  events: any[];
  listItems: any[];
  kids: UserProfile[];
  onAction: (item: MissionItem, action: 'complete' | 'dismiss') => void;
}

export function MissionTodayView({ profile, tasks, events, listItems, kids, onAction }: MissionTodayViewProps) {
  const { missionItems } = useMissionTodayController({ profile, tasks, events, listItems, kids });

  return (
    <div className="flex flex-col gap-3 pb-24">
      <h2 className="text-2xl font-black px-2 mb-2">MISSION: TODAY</h2>
      {missionItems.map(item => (
        <SwipeableRow 
          key={item.id} 
          onSwipeRight={() => onAction(item, 'complete')}
          onSwipeLeft={() => onAction(item, 'dismiss')}
        >
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-ui-soft">
              {item.type === 'event' && <Calendar className="text-blue-500" />}
              {item.type === 'task' && <CheckCircle2 className="text-emerald-500" />}
              {item.type === 'list_item' && <ShoppingCart className="text-amber-500" />}
            </div>
            <div className="flex-1">
              <div className="font-bold text-lg">{item.title}</div>
              {item.time && <div className="text-sm text-ui-muted">{item.time}</div>}
              {item.subtitle && <div className="text-xs font-bold text-sky-500 uppercase">{item.subtitle}</div>}
            </div>
          </div>
        </SwipeableRow>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/MissionTodayView.tsx
git commit -m "feat: implement MissionTodayView component"
```

---

### Task 4: The "Action Bolt" FAB

**Files:**
- Create: `src/components/shared/ActionBolt.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the `ActionBolt` FAB component**

```tsx
// src/components/shared/ActionBolt.tsx
import React, { useState } from 'react';
import { Plus, Zap, ShoppingBasket, ClipboardCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function ActionBolt({ onAction }: { onAction: (type: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-20 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex flex-col gap-3 mb-4 items-end"
          >
            <button onClick={() => onAction('grocery')} className="flex items-center gap-2 bg-white p-3 rounded-full shadow-lg border border-ui font-bold">
              Add Grocery <ShoppingBasket size={20} className="text-amber-500" />
            </button>
            <button onClick={() => onAction('task')} className="flex items-center gap-2 bg-white p-3 rounded-full shadow-lg border border-ui font-bold">
              New Task <ClipboardCheck size={20} className="text-sky-500" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-xl hover:bg-blue-500 transition-colors"
      >
        <Zap size={32} className={isOpen ? "rotate-45" : ""} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Integrate `ActionBolt` and `MissionTodayView` into `App.tsx`**

```tsx
// src/App.tsx - inside the main return, conditional based on screen size
const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
useEffect(() => {
  const handleResize = () => setIsMobile(window.innerWidth < 768);
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);

// ... in return ...
{isMobile && activeSection === 'home' ? (
  <MissionTodayView 
    profile={profile} 
    tasks={[]} // Pull from context/state
    events={[]} // Pull from context/state
    listItems={[]} // Pull from context/state
    kids={kids}
    onAction={(item, action) => console.log(item, action)}
  />
) : (
  // Existing wallHome/KidDashboard logic
)}
<ActionBolt onAction={(type) => console.log(type)} />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/ActionBolt.tsx src/App.tsx
git commit -m "feat: add ActionBolt and responsive MissionTodayView routing"
```
