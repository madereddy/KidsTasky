# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

KidsTasky (KidTasker) — gamified family task manager. Parents assign missions, kids earn XP/stars/badges. Self-hosted, SQLite-backed, real-time via WebSockets. Also includes calendar (Google sync), shared lists, meal planning, weather, photo screensaver, and email-to-calendar magic import (Gemini AI).

## Commands

```bash
npm run dev          # Start dev server (tsx + Vite middleware), http://localhost:3000
npm run build        # Build frontend (Vite) + backend (esbuild → dist/server.js)
npm run start        # Run production build (NODE_ENV=production)
npm run test         # Run all tests (vitest)
npm run lint         # Type-check only (tsc --noEmit)

# Single test file
npx vitest run src/server/modules/events/api.test.ts

# Single test by name
npx vitest run -t "should create an event"
```

## Architecture

**Monorepo-style single package** — React SPA frontend + Express API backend in one repo, sharing TypeScript types.

### Frontend (`src/`)
- React 19 + Vite + Tailwind CSS v4 + Motion (animations)
- Entry: `src/main.tsx` → `src/App.tsx`
- Auth via JWT tokens stored in `localStorage` (`kidtasker_token`)
- Real-time updates via Socket.IO (`src/hooks/useSocket.ts`)
- Two role-based dashboards: `src/components/parent/` and `src/components/kid/`
- Shared components in `src/components/shared/`, calendar in `src/components/calendar/`
- Client services in `src/services/` — each wraps HTTP calls to the API
- Types in `src/types.ts`
- Path alias: `@/` maps to repo root

### Backend (`server.ts` + `src/server/`)
- Express 5 on Node 24+, entry point `server.ts`
- In dev mode, Vite runs as Express middleware (no separate dev server needed)
- SQLite via `better-sqlite3` — in-memory (`:memory:`) during tests, file-based in prod
- DB initialized in `src/server/db.ts`, auto-runs migrations from `src/server/migrations/`
- Migrations are numbered SQL files (e.g., `001_init_schema.sql`)
- JWT auth middleware: `src/server/middleware/auth.ts`
- API modules: `src/server/modules/{domain}/` each with `routes.ts` and `service.ts`
  - Domains: auth, users, tasks, categories, invites, notifications, rewards, events, weather, lists, meals, magic, photos, sync, settings
- All mutation routes auto-broadcast `staleData` via Socket.IO for real-time sync
- Background worker (`src/server/worker.ts`) runs cron jobs for overdue task checks, Google Calendar sync, IMAP email polling

### Data Flow
- Parent creates family → invite code → kid joins via code
- Mutations go through REST API → service layer → SQLite
- After successful mutation, middleware emits Socket.IO event → all family clients refetch

## Testing

- **Framework**: Vitest with jsdom for frontend, supertest for API tests
- **DB in tests**: Always `:memory:` SQLite — no file DB, no mocks
- **Test files**: Co-located with source (`*.test.ts` / `*.test.tsx`)
- **Setup**: `src/setupTests.ts` — mocks `ResizeObserver` for jsdom
- API tests import `app` from `server.ts` and use `supertest(app)`

## Environment

- Requires Node 24+ (uses native features)
- `.env.example` has all config vars — key ones: `JWT_SECRET`, `DB_PATH`, `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID/SECRET`
- Docker: multi-stage Chainguard build, SQLite at `/data/database.db` in container
- Uses pnpm for Docker builds (lockfile: `pnpm-lock.yaml`), npm locally

## Key Patterns

- Two-role system: `parent` and `kid` — JWT payload contains `uid`, `role`, `parentId`
- `parentId` is the family grouping key — all queries scope by it
- Service files contain pure business logic (direct `db` calls), route files handle HTTP
- Frontend services (`src/services/`) pass JWT token via `Authorization: Bearer` header
- Socket.IO rooms grouped by `parentId` for family-scoped broadcasts
