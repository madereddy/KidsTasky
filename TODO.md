# Reliability Fixes TODO

- [x] Task 1: Database integrity — foreign keys + synchronous mode
- [x] Task 2: Auth middleware helper — add getParentId utility
- [x] Task 3: Secure events routes
- [x] Task 4: Secure notifications routes
- [x] Task 5: Secure rewards routes
- [x] Task 6: Secure settings routes
- [x] Task 7: Secure sync routes
- [x] Task 8: Secure tasks routes
- [x] Task 9: Secure users routes
- [x] Task 10: Parent edit lock enforcement (server-side)
- [x] Task 11: Standardized stale-data socket broadcasts
- [x] Task 12: Generic TTLCache for hot-path data
- [x] Task 13: Centralized health and diagnostic API
- [x] Task 14: Modernized password hashing (Argon2id)

# Architecture Hardening

## P0 - Preserve Current Fixes
- [x] Commit the current high-impact fixes (Tasks 1-14) once reviewed.
- [x] Before deploy, run: `pnpm exec tsc --noEmit`, `pnpm build`, `pnpm test`.

## P1 - Split Backend God Modules
- [x] Split `src/server/worker.ts` into focused modules (scheduling, reminders, sync, photos, diagnostics).
- [x] Add focused worker tests around existing behavior.
- [x] Keep public worker startup API stable.
- [x] Confirm `/api/health/worker` reports same diagnostics.

## P1 - Finish API Boundary Cleanup
- [x] Keep `src/server/routes.ts` as composition root only.
- [x] Move logic to `healthRoutes.ts` or other focused routers.
- [x] Move cross-cutting response behavior to `src/server/middleware/*`.
- [x] Add regression checks for route mount order.
- [x] Confirm socket broadcasts on authenticated mutations.

## P1 - Raise Type Safety Safely
- [x] Normalize route handlers for `noImplicitReturns`.
- [x] Enable `noImplicitReturns` in `tsconfig.json`.
- [x] Audit explicit `any` usage.
- [x] Add typed adapters for legacy payloads.

## P1 - Split Calendar UI
- [x] Split `src/components/calendar/CalendarView.tsx` into smaller units (view state, mutation handlers, adapters, dialogs, renderers).
- [x] Add tests for recurring event mutation.
- [x] Confirm wall-mode behavior.

## P2 - Shrink App Shell
- [x] Continue extracting logic from `src/App.tsx` into hooks or component boundaries.
- [x] Move initialization and navigation logic to dedicated hooks.

## P2 - Data Model Cleanup
- [x] Audit manual metadata delimiter parsing (`:`, `|`, `|META:`).
- [x] Replace with structured JSON in `metadata` column or dedicated tables.
- [x] Add migration for legacy rows.

## P2 - Observability And Operations
- [x] Draft production regression checklist (`docs/REGRESSION_CHECKLIST.md`).
- [x] Document health endpoints in `ARCHITECTURE.md`.
- [x] Add smoke test script (`scripts/smoke-test.mjs`).

## P3 - Frontend Quality
- [x] Review large dashboard surfaces (`KidDashboard`) for component boundaries.
- [x] Add focused tests for high-risk UI workflows.
- [x] Keep UI refactors behavior-preserving.
