# KidTasker Architecture & Developer Guide

Welcome to the KidTasker codebase! This document serves as the compass for any developer onboarding onto the code. The application has been built prioritizing a local-first, low-dependency philosophy, meaning everything required for production runs entirely inside this repository—no external cloud databases to manage.

## Overview of the Stack
KidTasker combines extreme deployment simplicity with high developer velocity.

*   **Frontend**: React 19, TypeScript, Vite. (Includes `lucide-react` for iconography and `motion` for beautiful standard framer animations).
*   **Styling**: Tailwind CSS v4 using utility classes directly. Note: There is almost zero custom CSS needed, we inject Tailwind natively.
*   **Backend**: Node.js & Express.
*   **Database**: SQLite (`better-sqlite3`). Bypasses heavy ORMs, opting for ultra-fast raw parameterized SQL queries handled securely inside Express.

---

## Code Modularization Strategy

The codebase adheres strictly to horizontal separation of concerns:

### 1. The Backend (`/src/server/`)
Our formerly monolithic `server.ts` has been elegantly split to promote clarity:
*   `server.ts` -> **The Orchestrator**. Simply pulls in Express, mounts the Vue/React build hooks, and attaches the master router. It is intentionally kept entirely clean of business logic.
*   `src/server/db.ts` -> **The Storage Engine**. Exports the `db` singleton. This file sets up the raw initial schema (`CREATE TABLE IF NOT EXISTS`) and dynamically maps to `:memory:` during testing safely.
*   `src/server/routes.ts` -> **The Controller**. Contains the standalone Express `apiRouter`, holding every REST `GET/POST/PUT` endpoint corresponding to categories, completions, and user updates.
*   `src/server/worker.ts` -> **The Cron**. Contains the natively spinning `startBackgroundWorker()` interval, computing 'overdue' statuses on tasks exactly every 300 seconds (5 minutes) entirely on the backend to avoid spoofing.

### 2. The Frontend Data Layer (`/src/services/`)
*   `taskService.ts` -> The absolute brain of the UI. Rather than throwing `fetch()` blocks into every React component, the application executes standard `taskService.methodName()` functions (e.g. `taskService.getTasks()`). This file translates the TypeScript structs into clean HTTP REST requests bound to the Express environment.

### 3. The Test Lifecycle
The project relies on **Vitest**.
*   **Frontend Testing** (`src/App.test.tsx`, `src/services/taskService.test.ts`): We mock the actual backend calls to completely seal the UI testing environment, ensuring tests complete in ~40ms using `jsdom`.
*   **Backend Testing** (`server.test.ts`): Built specifically on standard Node utilizing `supertest`. During `beforeEach()`, we assert `db.prepare('DELETE FROM tasks')` guaranteeing idempotent pipeline validity across API boundary checks.

---

## File Navigational Guide
```text
Root
│── package.json          # Node modules, Vite / Express script definitions.
│── server.ts             # Application Entry Point (Ports, Build static routing)
│── Dockerfile            # Multi-stage CI structure
│── docker-compose.yml    # Development compose mount with volumes attached
│
└── src/
    │── App.tsx           # Primary React entry boundary containing UI Modals (ParentDashboard, KidDashboard)
    │── types.ts          # Vital shared Domain objects (Users, Tasks, Badges, etc)
    │
    ├── server/           # Natively run Backend components
    │   ├── db.ts         # SQLite Singleton
    │   ├── routes.ts     # Express Routers
    │   └── worker.ts     # Asynchronous Overdue Task Manager
    │
    └── services/
        └── taskService.ts # Custom API Fetch abstraction mapping UI inputs to Backend Routes
```

## Adding a New Feature (Developer Workflow)

If you are a developer looking to add a new "Feature" to KidTasker (for instance, **"Pets"** that level up when kids get XP):

1.  **Define the Schema (`db.ts`)**: Append a simple `CREATE TABLE IF NOT EXISTS pets (...)`
2.  **Define the Type (`types.ts`)**: Add your `interface Pet { id: string }`
3.  **Build the Controller (`routes.ts`)**: Add an `apiRouter.post('/kids/:kidId/pets')` logic gate.
4.  **Expose to Service (`taskService.ts`)**: Map `createPet(kidId, payload) => fetch(...)`.
5.  **Inject into React (`App.tsx`)**: Import the function and bind it dynamically, utilizing robust Tailwind colors inside the main Dashboard layout!

*Happy building!*
