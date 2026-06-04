# Lists Upgrade (KitchenOwl Killer) Design

Transform the basic Lists feature into a robust, context-aware grocery and errand management tool. This upgrade introduces store-specific filtering, intelligent store assignment ("memory"), and quick re-addition of frequent items.

## 1. Data Model Enhancements

Extend the existing list item models to support store context and time-based history.

**`src/types.ts`:**
```typescript
export interface AppListItem {
  id: string;
  listId: string;
  text: string;
  completed: number; 
  storeName?: string; // New: Tagged store
  completedAt?: number; // New: Timestamp for frequent items logic
}
```

## 2. Core Logic: The "Smart" Controller

Enhance `useListsController.ts` (or create a sub-controller `useSmartListLogic`) to manage store intelligence.

### A. Store Memory
- Maintain a persistent mapping (e.g., in `localStorage` keyed by `parentId`) of `ItemText -> StoreName`.
- When a user adds an item and explicitly tags a store, update the memory.
- When a user adds an item *without* a tag, look up the text in the memory and auto-apply the store.

### B. Frequent Items (30-Day Living List)
- Calculate "Frequent Items" by analyzing items with `completed === 1` and `completedAt` within the last 30 days.
- Sort this list by frequency of completion.
- Exclude items that are currently active (`completed === 0`) on the list.

### C. Natural Language Parsing
- Intercept the `text` input before saving.
- Parse formats like `"Milk at Costco"`, `"Eggs @ Walmart"`, or `"Target: Paper towels"`.
- Extract the store name and the clean item text.

## 3. UI Components

### A. StoreFilterBar
- A sticky horizontal scroll view below the list title.
- Shows "All" followed by active stores (e.g., "Costco (4)", "Walmart (2)").
- Tapping a store filters the visible `AppListItem`s.

### B. SmartListInput
- Replaces the standard text input.
- **Top Row (Store Chips):** Selectable chips for common stores (Costco, Walmart, Target, Trader Joe's, generic "Grocery"). Selecting one locks that store for the next entry.
- **Bottom Row (Frequent Items):** A horizontal, scrollable list of the calculated "Frequent Items". Tapping one instantly adds it to the active list.

### C. ListItem Enhancements
- **Badges:** Display a small, colored tag (e.g., a blue "C" for Costco) next to items in the "All" view.
- **Mobile Optimization:** Increase tap targets (`min-h-[56px]`) and ensure the checkbox is easily reachable with one hand.

## 4. Technical Constraints & Testing

- **Backward Compatibility:** The backend might not immediately support `storeName` or `completedAt` if the schema isn't updated. We will store this metadata in a JSON string within the `text` field (e.g., `Milk |STORE:Costco|`) or rely on local state enhancement if API changes are out of scope for this pass. *Note: If API changes are possible, update the backend; otherwise, use the delimiter hack.*
- **Performance:** The "Frequent Items" calculation should be memoized (`useMemo`) to prevent lag on lists with hundreds of historical items.
- **Offline Resilience:** The "Store Memory" must be local (`localStorage`) so it works instantly without a network round-trip.

## 5. Implementation Stages

1. **Stage 1 (Logic):** Enhance the types and `useListsController` with parsing, memory, and frequent item calculation.
2. **Stage 2 (Input):** Build the `SmartListInput` with Store Chips and the Frequent Items drawer.
3. **Stage 3 (Filtering):** Build the `StoreFilterBar` and update the list rendering to support filtering and badges.
4. **Stage 4 (Mobile UX):** Polish touch targets and integrate smoothly with the newly added `MissionTodayView` Quick Actions.
