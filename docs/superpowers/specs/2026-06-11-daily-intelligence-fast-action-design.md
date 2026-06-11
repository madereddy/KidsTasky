# Spec: Daily Intelligence & Fast Action Update

**Date:** 2026-06-11  
**Status:** Draft  
**Topic:** Improving day-to-day usability and family engagement via proactive headers and quick-capture interactions.

## 1. Overview
KidTasky is already feature-rich, but day-to-day usability can be improved by making the most critical daily information (Meals, Next Events) proactive and reducing the friction for frequent actions (Grocery adding, Routine completion). This update focuses on "The Intelligent Home" and "Ultra-Fast Capture" directions.

## 2. Goals & Success Criteria
- **Proactivity:** Families should know "What's Next" and "What's for Dinner" without navigating away from the home screen.
- **Speed:** Common groceries should be addable with a single tap.
- **Coordination:** Parents should see a unified view of the family's immediate schedule.

## 3. Architecture & Data Flow

### 3.1. Controller Enhancements
- **`useWallHomeController`**: 
    - Fetch the current day's meal plan from the `meal_plan` service.
    - Implement a `calculateNextUp(events, kids)` helper that identifies the chronologically first event starting after `Date.now()`.
- **`useMissionTodayController`**:
    - Integrate meal plan data.
    - Add a `frequentItems` array derived from the most commonly added list items.

### 3.2. New Data Logic: "Missing Ingredients"
- When a meal is displayed, the UI will provide a "Missing Ingredients?" button.
- **Logic:** 
    1. Fetch ingredients for the planned recipe.
    2. Cross-reference with the current `shopping_list`.
    3. Add any ingredient not currently on the list (or marked as completed) to the list.

### 3.3. New Data Logic: Frequent Items
- We will implement a simple heuristic to track item frequency:
    - Update the `list_items` or a new `item_stats` table to increment a `usage_count` whenever an item is added.
    - Display the top 5 items with the highest `usage_count` that are *not* currently active on the shopping list.

## 4. UI/UX Design

### 4.1. The Intelligence Header (`WallHome` & `MissionTodayView`)
- **Next Up Ticker:** A full-width status bar at the top of the content area.
    - **Visuals:** Bold text, family member's color accent, countdown timer (e.g., "in 15m").
- **Meal Plan Card:**
    - **Visuals:** Image of the meal (if available), title, and the "Missing Ingredients?" CTA.
    - **Contextual Visibility:** Becomes more prominent in the "Evening" view (after 3:00 PM).

### 4.2. Fast Action Layer
- **Grocery Chips:** A horizontal scrollable list of 5 icons + labels (e.g., Milk 🥛, Eggs 🥚) placed immediately below the main header.
- **Routine "Power-Ups":** 
    - Routines in the Today list will include a circular progress ring.
    - Tapping the Routine card expands a "Quick List" of its sub-tasks instead of navigating.

## 5. Implementation Phases
1. **Phase 1 (Data):** Update services and hooks to provide Meal Plan and "Next Up" data.
2. **Phase 2 (UI - Intelligence):** Implement the Header and Meal Card in `WallHome` and `MissionTodayView`.
3. **Phase 3 (UI - Interaction):** Implement Grocery Chips and Routine "Power-Ups".
4. **Phase 4 (Logic):** Implement Frequency tracking and "Missing Ingredients" bulk-add.

## 6. Testing Strategy
- **Unit Tests:** `calculateNextUp` logic (handling different timezones and all-day events).
- **Integration Tests:** Verifying "Missing Ingredients" correctly identifies and adds items to the database.
- **Visual Regression:** Ensuring the "Wall Mode" layout remains balanced with the new oversized elements.
