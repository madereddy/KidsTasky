# Spec: Offline Reliability & Smart Data Entry

**Date:** 2026-06-05
**Status:** Draft (User Approved Design)
**Topic:** Transforming KidsTasky into a resilient, high-speed mobile companion.

## 1. Executive Summary
This design solves two primary friction points:
1. **The "Milk Aisle Dead Zone":** Poor connectivity prevents checking items off or adding tasks while on the go.
2. **Input Fatigue:** Typing assignments and schedules on mobile is slow and error-prone.

## 2. Goals
- **Full Offline Interaction:** Users can add, toggle, and delete items while offline.
- **Background Synchronization:** Changes sync automatically once a network connection is restored.
- **Frictionless Entry:** "Tap-to-Refine" suggestions provide one-tap assignment and scheduling.

## 3. Architecture

### 3.1 Offline Action Queue
A persistent queue stored in `localStorage` that captures failed write operations.

**Interface:**
```typescript
interface OfflineAction {
  id: string;           // UUID for tracking
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'TOGGLE';
  entity: 'task' | 'list_item' | 'completion';
  endpoint: string;
  method: string;
  body: string;         // Serialized request body
  timestamp: number;
  description: string;  // Human-readable summary for UI
}
```

**Conflict Resolution:**
- **Strategy:** "Latest Action Wins."
- **Logic:** If an offline action fails during sync because the entity no longer exists (404) or was already updated, the error is logged but the sync continues. This ensures a single failed "stale" action doesn't block the rest of the queue.

### 3.2 Suggestion Engine (Tap-to-Refine)
A utility that analyzes historical data to predict the most likely "Who," "When," and "Where" for a new entry.

**Logic:**
- **Who:** Frequency of `assignedKidId` for the typed text or category.
- **When:** Default to "Today" or "Tonight," plus the most frequent `reminderTime` for similar tasks.
- **Where:** Utilize the existing `analyzeQuickListInput` logic to extract household tags (Stores/Locations).

## 4. UI/UX Design

### 4.1 Sync Status Indicator
- **Location:** App Header (z-[60]).
- **States:**
  - **Online:** Hidden (default).
  - **Offline:** ☁️ "Offline Mode" (Yellow badge).
  - **Syncing:** 🔄 "Syncing [N] items..." (Blue/Spinning badge).

### 4.2 Quick Entry Suggestion Bar
- **Location:** Floating row above the mobile keyboard in `ShoppingView`, `RoutinesView`, and `ParentTasksWorkspace`.
- **Interaction:**
  - Tapping a chip (e.g., `[Jimmy 👤]`) immediately updates the internal state of the input.
  - If it's a "terminal" selection (e.g., adding a grocery item), the item is saved instantly.

## 5. Technical Implementation Details
- **Connectivity Monitoring:** Use `window.addEventListener('online', ...)` and `navigator.onLine`.
- **Service Interception:** Modify `src/services/http.ts`'s `fetchAPI` to detect "Network error: unable to reach server" and trigger the queueing logic.
- **Sync Flush:** A global `useEffect` in `App.tsx` that monitors the queue and connectivity state.

## 6. Testing Strategy
- **Simulation:** Use Chrome DevTools "Offline" mode to verify queue persistence.
- **Unit Tests:** Mock `fetch` to fail and verify that `localStorage` is correctly populated with the intended actions.
- **Manual Verification:** Verify that checking off an item offline and then reconnecting results in a successful server update.
