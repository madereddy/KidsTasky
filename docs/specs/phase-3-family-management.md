# Phase 3: Family Management & Kiosk Features

## Objective
Introduce "smart display" appliance features designed to make the app suitable for a central household screen (like an iPad mounted to a fridge) while adding robust list management.

## Core Features to Implement

### 1. Custom Lists (Groceries & To-Dos)
- **Data Model:** Create a `lists` table and `list_items` table.
- **UI Component:** A dedicated slide-out or side-panel for universal lists (e.g., "Groceries", "Costco", "Weekend Packing").
- **Real-time syncing:** Changes made on the mobile app instantly reflect on the main dashboard display (requires WebSockets/Socket.io).

### 2. Parental Controls & Security
- **Parental Lock PIN:** Introduce a 4-digit PIN system required to edit settings, delete events, or modify chore rewards.
- **Role-Based UI:** If "Unlocked", show edit/delete icons. If "Locked", the calendar functions purely in read-only mode for events.

### 3. Sleep Mode Scheduling
- **Schedule Configuration:** Settings page to define "Wake" and "Sleep" times (e.g., 10 PM to 6 AM).
- **Visual implementation:** A full-screen dark overlay with a simple digital clock during sleep hours to prevent light pollution in the house.

### 4. Device Linking
- **WebSockets (`socket.io`):** Transition from HTTP polling to WebSockets for real-time state synchronization, so if Dad adds an event from his phone at work, it instantly appears on the kitchen screen.

## Success Criteria
- The application automatically dims/sleeps at night.
- Kids cannot tamper with calendar events without bypassing the PIN.
- Groceries and tasks sync instantaneously across multiple browser windows.
