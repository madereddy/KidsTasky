# Reliability Fixes TODO

- [x] Task 1: Database integrity — foreign keys + synchronous mode
- [x] Task 2: Auth middleware helper — add getParentId utility
- [x] Task 3: Secure events routes
- [x] Task 4: Secure notifications routes
- [x] Task 5: Secure sync routes
- [x] Task 6: Secure task + reward routes
- [x] Task 7: Fix stars accounting bugs
- [x] Task 8: Secure Socket.IO join-room
- [x] Task 9: Fix email validation in auth routes
- [x] Task 10: Fix IMAP connection leak in worker
- [x] Task 11: Fix stale socket callbacks
- [x] Task 12: Add error handling to KidDashboard
- [x] Task 13: Fix silent init failures + add category refetch
- [x] Task 14: Add HTTP retry logic

---

# Architecture Hardening TODO

These items come from the June 2026 codebase review. The goal is incremental stabilization, not a rewrite. Preserve existing behavior, add regression coverage first where behavior is risky, and keep `pnpm exec tsc --noEmit`, `pnpm build`, and `pnpm test` green after each completed item.

## P0 - Preserve Current Fixes

- [ ] Commit the current high-impact fixes once reviewed:
  - `src/server/lib/hashing.ts`
  - `src/server/routes.ts`
  - `src/server/healthRoutes.ts`
  - `src/server/middleware/staleDataBroadcaster.ts`
  - `tsconfig.json`
  - `ARCHITECTURE.md`
- [ ] Before deploy, run:
  - `pnpm exec tsc --noEmit`
  - `pnpm build`
  - `pnpm test`
- [ ] If deploying through Komodo, wait for the GitHub Actions image build/push to finish before triggering the Komodo deployment.

## P1 - Split Backend God Modules

- [ ] Split `src/server/worker.ts` into focused modules:
  - scheduling/bootstrap
  - reminder delivery
  - Google sync jobs
  - photo cleanup jobs
  - worker diagnostics
- [ ] Add focused worker tests around existing behavior before moving each responsibility.
- [ ] Keep the public worker startup API stable during the split.
- [ ] Confirm `/api/health/worker` still reports the same diagnostics after each extraction.

## P1 - Finish API Boundary Cleanup

- [ ] Keep `src/server/routes.ts` as a composition root only.
- [ ] Move any future health/diagnostic endpoint logic into `src/server/healthRoutes.ts` or another focused router.
- [ ] Move any future cross-cutting response behavior into `src/server/middleware/*`.
- [ ] Add regression checks for route mount order when moving middleware or route modules.
- [ ] Confirm authenticated mutations still emit stale-data socket events after route refactors.

## P1 - Raise Type Safety Safely

- [ ] Normalize Express route handlers so `noImplicitReturns` can be enabled without behavior changes.
- [ ] Enable `noImplicitReturns` after route handlers are normalized.
- [ ] Audit remaining explicit `any` usage and replace it at stable boundaries first.
- [ ] Add small typed adapters for untyped legacy payloads and external provider data.

## P1 - Split Calendar UI

- [ ] Split `src/components/calendar/CalendarView.tsx` into smaller units:
  - view state and filters
  - event mutation handlers
  - recurrence/all-day/countdown adapters
  - dialogs/forms
  - render adapters for month/week/day/agenda/wall views
- [ ] Add tests for recurring event mutation semantics before moving handlers.
- [ ] Confirm existing wall-mode and family-filter behavior remains unchanged.

## P2 - Shrink App Shell

- [ ] Continue reducing `src/App.tsx` toward providers, routing, and top-level app shell only.
- [ ] Move feature-specific state into feature components or hooks.
- [ ] Keep auth/session/bootstrap behavior covered while extracting.

## P2 - Data Model Cleanup

- [ ] Replace the list-item metadata delimiter strategy with real SQLite columns when touching that feature next.
- [ ] Provide a reversible migration and compatibility reader during the transition.
- [ ] Add regression tests for existing metadata parsing before migration.

## P2 - Observability And Operations

- [ ] Add a concise production regression checklist for:
  - login/password change/PIN validation
  - task completion and approval
  - calendar create/edit/delete
  - stale-data socket refresh
  - worker reminders
  - Google sync failure handling
  - photo upload/delete cleanup
- [ ] Document expected health endpoint responses for local and Docker deployments.
- [ ] Add a lightweight smoke test that checks the core health endpoints after startup.

## P3 - Frontend Quality

- [ ] Review large dashboard and settings surfaces for component boundaries after backend splits are stable.
- [ ] Add focused tests for high-risk UI workflows instead of chasing arbitrary coverage.
- [ ] Keep UI refactors behavior-preserving unless a separate UX change is explicitly requested.
