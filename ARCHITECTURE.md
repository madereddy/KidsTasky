# KidTasker Architecture & Developer Guide

Welcome to the KidTasker codebase! This document serves as the compass for any developer onboarding onto the code. The application has been built prioritizing a local-first, low-dependency philosophy, meaning everything required for production runs entirely inside this repository—no external cloud databases to manage.

## Overview of the Stack
KidTasker combines extreme deployment simplicity with high developer velocity.

*   **Frontend**: React 19, TypeScript, Vite. (Includes `lucide-react` for iconography and `motion` for beautiful standard framer animations).
*   **Styling**: Tailwind CSS v4 using utility classes directly. Note: There is almost zero custom CSS needed, we inject Tailwind natively.
*   **Backend**: Node.js, Express, Socket.io (for real-time synchronization).
*   **Smart Parsing**: Uses Gemini API integrated via Webhooks to map natural language directly to `eventsService`.
*   **External Integrations**: Optional 2-way Google Calendar synchronization and Open-Meteo SDK for weather forecasts.
*   **Database**: SQLite (`better-sqlite3`). Bypasses heavy ORMs, opting for ultra-fast raw parameterized SQL queries handled securely inside Express.

> **Want to learn how to set up integrations like Google Calendar Sync?** Check out the [Setup Guide](docs/SETUP_GUIDE.md).

---

## Code Modularization Strategy

The codebase adheres strictly to horizontal separation of concerns:

### 1. The Backend (`/src/server/`)
Our backend is split into logically decoupled modules so that they can be easily containerized or managed independently in the future.
*   `server.ts` -> **The Orchestrator**. Simply pulls in Express, mounts the React build hooks, and attaches the master router. Sets up Socket.io connection.
*   `src/server/db.ts` -> **The Storage Engine**. Exports the `db` singleton. Sets up the SQLite database mapping to `:memory:` during testing. Runs migrations automatically on boot.
*   `src/server/socket.ts` -> **The Realtime Manager**. Defines namespaces/rooms for sockets and exposes the ability for controllers to broadcast `stale-data` events whenever mutations occur.
*   `src/server/modules/` -> **The Domain Modules**. The true backbone of the system. Each domain (e.g., `auth`, `users`, `tasks`, `rewards`, `weather`, `sync`) gets its own folder with a `routes.ts` (for REST presentation) and `service.ts` (encapsulating raw SQL queries via `db.ts`). This allows HTTP parsing to completely decouple from database operations.
*   `src/server/routes.ts` -> **The Master Router**. Gathers routes from `src/server/modules/*/routes.ts` and bundles them into `apiRouter`. Also injects the magical `socketWrapper.emitStaleData` hook automatically intercepting `POST`, `PUT`, `DELETE` methods out of convention to ease frontend synchronization.
*   `src/server/worker.ts` -> **The Cron**. Contains the natively spinning `startBackgroundWorker()` interval, used for flagging overdue tasks, regenerating streaks, and routinely polling any integrated third-party platforms (like Google Calendar).

### 2. The Frontend Layer (`/src/services/` and `/src/components/`)
*   **Data Services (`/src/services/`)**: The backbone of the UI. It translates TypeScript structs into cleanly chunked modular REST clients bound to the Express environment. We have individual files (`auth.ts`, `tasks.ts`, `rewards.ts`, etc.) mapping to each domain, inheriting a base `http.ts` caller rather than throwing `fetch()` blocks into every React component.
*   **Component Structure (`/src/components/`)**: The UI component hierarchy is split domain-first (`/parent/`, `/kid/`, `/onboarding/`, `/auth/`). This drastically speeds up developer navigation and encapsulates logic where it clearly belongs.

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
    │── App.tsx           # Primary React entry boundary containing UI Flow
    │── types.ts          # Vital shared Domain objects (Users, Tasks, Badges, etc)
    │
    ├── components/       # Domain-separated React components
    │   ├── auth/         # Login Views
    │   ├── parent/       # Parent Dashboard & Management Modals
    │   ├── kid/          # Kid Dashboard & Theme/History Modals
    │   └── onboarding/   # Initial Setup Flow
    │
    ├── server/           # Natively run Backend components
    │   ├── db.ts         # SQLite Singleton
    │   ├── routes.ts     # Master Express Route Bundler with generic stale-data Socket interceptor
    │   ├── socket.ts     # Centralizes Socket.io rooms and emit functions
    │   ├── worker.ts     # Asynchronous Overdue Task Manager & Periodic Sync
    │   └── modules/      # Independent Domain API logic
    │       ├── auth/     
    │       ├── magic/    # Webhook signature validation and Gemini AI text parsing
    │       ├── sync/     # Google API polling logic and OAuth routines
    │       ├── weather/  # Open-Meteo SDK integration
    │       ├── meals/    # Recipe mapping and parsing
    │       ├── photos/   # Upload storage tracking
    │       ├── tasks/    # Each contains `routes.ts` and `service.ts`
    │       └── ...
    │
    └── services/         # Modular HTTP Data-Fetching Client
        ├── auth.ts       # Maps UI -> Backend
        ├── tasks.ts
        ├── http.ts       # Shared configured JSON Fetch client
        └── ...
```

## Adding a New Feature (Developer Workflow)

If you are a developer looking to add a new "Feature" to KidTasker (for instance, **"Pets"** that level up when kids get XP):

1.  **Define the Schema (`db.ts`)**: Append a simple `CREATE TABLE IF NOT EXISTS pets (...)`
2.  **Define the Type (`types.ts`)**: Add your `interface Pet { id: string }`
3.  **Build the Module (`modules/pets/`)**: Add a `service.ts` for database CRUD logic and a `routes.ts` file mapping explicit inputs to `apiRouter.post('/kids/:kidId/pets')`. Register the new module in `server/routes.ts`.
4.  **Expose to Service (`services/pets.ts`)**: Add a client side mapping `export const petsService = { createPet(...) { fetchAPI(...) } }`.
5.  **Inject into React (`components/kid/`)**: Import the function and bind it dynamically, utilizing robust Tailwind colors!

*Happy building!*
