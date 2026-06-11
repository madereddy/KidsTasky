# Routine "Power-Ups" & Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add routine progress rings and in-place expansion to the Mission Today view to improve routine management for kids.

**Architecture:** 
- Modify `SwipeableRow` to support tap/click interactions.
- Create a reusable `ProgressRing` component.
- Update `MissionTodayView` to manage expansion state and render routine sub-tasks.
- Update `useMissionTodayController` to avoid redundant routine items when grouped.

**Tech Stack:** React, Tailwind CSS, Lucide React, Framer Motion.

---

### Task 1: Update `SwipeableRow` for Interactions

**Files:**
- Modify: `src/components/shared/SwipeableRow.tsx`

- [ ] **Step 1: Add `onClick` prop and handle tap interaction**

```typescript
interface SwipeableRowProps {
  // ... existing
  onClick?: () => void;
}

// In the component:
<motion.div
  drag="x"
  dragConstraints={{ left: 0, right: 0 }}
  onTap={() => onClick?.()}
  // ...
>
```

- [ ] **Step 2: Ensure overflow handling for expansion**
Ensure the container doesn't clip expanded content.

### Task 2: Create `ProgressRing` Component

**Files:**
- Create: `src/components/shared/ProgressRing.tsx`

- [ ] **Step 1: Implement `ProgressRing`**

```tsx
import React from 'react';

interface ProgressRingProps {
  progress: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: string;
}

export function ProgressRing({ 
  progress, 
  size = 40, 
  strokeWidth = 4, 
  className,
  color = "currentColor" 
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className={className}>
      <circle
        stroke="rgba(0,0,0,0.1)"
        fill="transparent"
        strokeWidth={strokeWidth}
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
      <circle
        stroke={color}
        fill="transparent"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        style={{ strokeDashoffset: offset, transition: 'stroke-dashoffset 0.3s ease' }}
        strokeLinecap="round"
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
    </svg>
  );
}
```

### Task 3: Update `useMissionTodayController` to Group Routines

**Files:**
- Modify: `src/hooks/useMissionTodayController.ts`

- [ ] **Step 1: Filter out individual routine items if they belong to a routine list**

Modify the `listItems` processing logic to exclude items that are part of a routine list (since they will be shown inside the routine card).

### Task 4: Implement In-Place Expansion in `MissionTodayView`

**Files:**
- Modify: `src/components/shared/MissionTodayView.tsx`

- [ ] **Step 1: Add state for expanded routines**

```typescript
const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);
```

- [ ] **Step 2: Update rendering to handle routine type**
- Use `ProgressRing` for routines.
- Toggle expansion on click.
- Render sub-tasks when expanded.
- Add "Complete All" button.

- [ ] **Step 3: Implement "Complete All" logic**
Call `onAction` for all pending items in the routine.

### Task 5: Verification

- [ ] **Step 1: Verify routine expansion**
- [ ] **Step 2: Verify progress ring updates**
- [ ] **Step 3: Verify "Complete All" functionality**
