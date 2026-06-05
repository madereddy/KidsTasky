# Design Spec: Shopping Tab Separation & Unified Family Routines

**Date:** 2026-06-05
**Status:** Approved
**Topic:** Separating Shopping from general Lists to reduce confusion and improve mobile UX.

## 1. Objective
Transform the confusing "Lists" tab into two distinct experiences: a high-speed "Shopping" tab for groceries and a "Routines & Notes" tab for family organization. This change also includes a major overhaul of the mobile navigation to accommodate the new sections while keeping the interface clean.

## 2. Navigation Changes

### 2.1 Mobile Bottom Navigation (5-Tab Layout)
The current mobile navigation is cluttered with individual kid profiles. We will consolidate these and add direct access to Shopping.

1.  **Home** (`Home` icon) - Home dashboard / Mission Today.
2.  **Calendar** (`Calendar` icon) - Family schedule.
3.  **Shopping** (`ShoppingBasket` icon) - **[NEW]** Primary entry point for groceries.
4.  **Tools** (`LayoutGrid` icon) - **[NEW]** Overflow menu containing:
    *   Routines & Notes (Non-shopping lists)
    *   Meal Planning
    *   Full Tasks Workspace
5.  **Switch** (`Users` icon) - **[NEW]** Consolidates kid profiles into a single button that triggers the existing profile switcher modal.

### 2.2 Desktop/iPad Header
1.  **Home** | **Tasks** | **Calendar** | **Shopping** | **Routines** | **Meals**
2.  "Lists" is renamed to "Routines".
3.  "Shopping" becomes a top-level nav item.

## 3. Component Architecture

### 3.1 `ShoppingView.tsx` (New)
*   **Purpose:** High-speed grocery entry and in-store checking.
*   **No Sidebar:** Unlike the old Lists view, this is a single, unified view.
*   **Kitchen Owl Suggestions:** A horizontal-scrolling row of the top 15 "Frequent Items" calculated from the last 30 days of global family history.
*   **Unified List:** Automatically pulls all items from lists tagged with "Shopping" or "Groceries".
*   **Store Filter Bar:** Persistent filter at the top to toggle view by store (e.g., "Costco", "Whole Foods").

### 3.2 `RoutinesView.tsx` (Refactored `ListsView`)
*   **Purpose:** Managing non-shopping lists (Packing Lists, Morning Routines, Notes).
*   **Sidebar:** Retains the sidebar to switch between different lists.
*   **Routine Pinning:** Continues to support pinning routines to the "Mission Today" view.

### 3.3 `ToolsMenu.tsx` (New Mobile Component)
*   A simple full-screen or bottom-sheet overlay triggered by the "Tools" tab.
*   Grid or List of buttons for secondary features.

## 4. Data Strategy
*   **List Categorization:** Add a `category` or `type` field to the `lists` table (default: 'routine', 'shopping').
*   **Global History Logic:** Update `useListsController` to aggregate items across all lists of type 'shopping' when the `ShoppingView` is active.
*   **Smart Metadata:** Preserve the `|META:{"storeName":"..."}|` string format for persisting item associations.

## 5. Success Criteria
*   Users can reach the Shopping list in one tap from any screen.
*   Mobile navigation feels less crowded by consolidating kid icons.
*   "Routines" and "Shopping" are conceptually separated to reduce cognitive load.
*   "Kitchen Owl" suggestions reduce manual typing for common household staples.
