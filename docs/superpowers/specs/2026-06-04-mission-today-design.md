# Mission Today: Quick Actions & Today View Design

Unified mobile-first "Mission Control" for families on the go. This system consolidates calendar events, tasks, and high-priority list items into a single, high-density vertical feed optimized for one-handed use and quick approvals.

## 1. Architecture: The "Mission Today" Controller

A new view layer that sits above the existing dashboards on mobile devices.

- **Trigger:** Screens < 768px (standard mobile breakpoint).
- **Core Component:** `MissionTodayView.tsx`
- **Controller:** `useMissionTodayController.ts`
  - Aggregates `CalendarEvent[]`, `Task[]`, and `AppListItem[]` into a single `MissionItem` type.
  - Handles sorting by `dueTime` or `priority`.
  - Filters out completed/hidden items unless "Show History" is toggled.

### Data Types
```typescript
interface MissionItem {
  id: string;
  type: 'event' | 'task' | 'list_item';
  title: string;
  subtitle?: string;
  time?: string;
  status: 'pending' | 'needs_approval' | 'completed';
  color?: string;
  originalData: any; // Reference to underlying entity
}
```

## 2. Components

### The "Mission Feed"
- **High-Density Vertical List:** Replaces large card stacks with compact, interactive rows.
- **SwipeableRow:** A wrapper component using `framer-motion` for gesture handling.
  - **Swipe Right (75px threshold):** Reveals "Done" (Kid) or "Approve" (Parent) action with Mint Success background.
  - **Swipe Left (75px threshold):** Reveals "Postpone" (1 hour) or "Dismiss" action with Amber Alert background.

### The "Action Bolt" (FAB)
- Floating button in the bottom-right corner.
- **Parent Actions:** Quick Task, Add Grocery, Approve All.
- **Kid Actions:** Manual Log (e.g., "I finished reading"), Request Reward.

### Quick-Entry Header
- A "sticky" input at the top of the feed: "Add a task or grocery item..."
- Intelligent parsing: if it matches a known store (Costco, Walmart), it tags it as a grocery item; otherwise, it defaults to a task.

## 3. Interaction Design

### One-Handed Optimization
- Critical buttons (Checkboxes/Action Bolt) placed within the "thumb zone" (bottom 40% of screen).
- Haptic feedback on swipe triggers and button taps to confirm action without visual focus.

### "KitchenOwl" Killer Features (Early Stage)
- **Store Filter:** Items in the feed can be filtered by Store name (Costco/Walmart).
- **History Picker:** Tapping the Quick-Entry input shows a list of "Recent/Frequent" items for one-tap re-addition.

## 4. Technical Constraints & Testing

- **Testing:** Add `MissionTodayView.test.tsx` to verify that Parent sees "Needs Approval" items and Kid sees their own assigned tasks.
- **Performance:** Ensure the `SwipeableRow` remains smooth (60fps) even with 20+ items in the feed.
- **Offline:** The feed must load instantly using `localStorage` cache before the socket connects.

## 5. Implementation Stages

1. **Stage 1:** Create `MissionTodayView` and the base `useMissionTodayController`.
2. **Stage 2:** Implement `SwipeableRow` and the "Action Bolt" FAB.
3. **Stage 3:** Integrate into `App.tsx` with responsive detection.
4. **Stage 4:** Add Store Filtering and Frequent Items to the Quick-Entry header.
