# Phase 1: Foundation & Core Calendar Layout

## Objective
Establish the primary centralized calendar view that replaces the current default landing page and implement the global navigation structure based on the Skylight Calendar model.

## Core Features to Implement

### 1. Global Navigation Structure
- **Persistent Bottom Navigation**
  - **Main Calendar Tab:** Always visible, the hub of the family.
  - **Individual Person Tabs:** Dynamic buttons for each family member to jump directly to their specific schedule/tasks for the day.
  - **Tasks Manager ("Chores") Tab:** A dedicated application tab encapsulating the existing standalone task/reward app logic.

### 2. Core Calendar UI & Customized Views
- **View Toggles:** Daily, Weekly, and Monthly views.
- **Event Mapping:** Plot local events onto a responsive CSS Grid/Flexbox calendar.
- **Color Coding:** Associate specific hex codes with `UserProfiles`. Events mapped to a user inherit their color block.

### 3. Basic Event CRUD
- **Data Model:** Update `db.ts` to include an `events` table (id, title, start_time, end_time, user_ids (array/relation), color, description).
- **Backend API:** Implement `/src/server/modules/events` module for standard REST operations.
- **Frontend State:** Context or query hooks to fetch and cache events by date range.

## Success Criteria
- The application loads directly into a Month/Week calendar view.
- Users can create colored events for specific family members.
- Clicking a bottom navigation item seamlessly switches between the overarching calendar, a child's personal day view, and the task manager.
