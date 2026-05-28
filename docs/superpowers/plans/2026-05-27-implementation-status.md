# Superpowers Implementation Status (2026-05-27)

## Summary

- Calendar parity and family wall baseline are functional and production-usable.
- Kid tasking has been extended with `Up for Grabs`, skip-without-stars, and clearer status signaling.
- Edit lock now enforces read-only behavior at mutation-route level across key modules.
- Core UI task surfaces were modularized for faster, safer future feature work.

## Newly Implemented Since 2026-05-26 Plans

- Tasks:
  - `assignedKidId='all'` support in kid task fetch and parent task creation.
  - `POST /tasks/:taskId/skip` with `approvalStatus='skipped'` completion writes.
  - Kid UI sections and filter views for `All / Up for Grabs / Assigned`.
- Routines:
  - `sortOrder` support via migration `033`.
  - Reorder API (`PUT /parents/:parentId/routines/reorder`).
  - Drag-and-drop reorder UX in routine templates modal.
- Locking:
  - `enforceEditUnlocked` middleware added and applied to mutations in tasks, routines, events, lists, and rewards.
- Calendar:
  - Calendar views now refetch on socket stale-data for faster multi-device convergence.

## Refactors for Maintainability

- Extracted [`KidTaskBoard`](C:\Users\ssing\KidsTasky\src\components\kid\KidTaskBoard.tsx) from [`KidDashboard`](C:\Users\ssing\KidsTasky\src\components\kid\KidDashboard.tsx).
- Extracted [`ParentTaskBoard`](C:\Users\ssing\KidsTasky\src\components\parent\ParentTaskBoard.tsx) from [`ParentDashboard`](C:\Users\ssing\KidsTasky\src\components\parent\ParentDashboard.tsx).
- Centralized duplicated task-card rendering paths to reduce future regression risk.

## Operational Verification

- Typecheck: `pnpm exec tsc --noEmit` passes.
- Build: `pnpm build` passes.
- Containers: local compose rebuild/relaunch previously validated during this cycle.

## Known Follow-Ups

- Resolve existing unrelated auth test failures in `pnpm test` suite.
- Optional: complete TS alias path unification if desired (`@/...` imports across client code).

## Plan Completion Labels (Updated 2026-05-27)

- `2026-05-26-group-a-calendar-core.md`: COMPLETED
- `2026-05-26-group-b-family-wall.md`: COMPLETED
- `2026-05-26-group-c-family-auth.md`: COMPLETED
- `2026-05-26-group-d-notifications.md`: PARTIALLY COMPLETED
- `2026-05-26-group-e-polish.md`: COMPLETED
- `2026-05-26-reliability-fixes.md`: COMPLETED

## Documentation Baseline Refresh (2026-05-27)

- `README.md` refreshed with current features, local setup, rebuild, and compose relaunch instructions.
- `ARCHITECTURE.md` refreshed with:
  - Phase 1 behavioral inventory with confidence labels
  - Phase 2 targeted clarification list (only medium-confidence and constraint questions)
  - Strangler-fig migration direction and rebuild/recovery runbook

## Clarification Decisions Captured (2026-05-27)

- Notification timing tolerance: close to exact; minor drift acceptable.
- Photo lifecycle: hard delete on scheduled cleanup.
- Sync conflict rule: latest-write-wins.
- Worker scheduling tolerance: close to exact; minor drift acceptable.

## Additional Delivery (2026-05-27)

- Added in-app Family Settings controls for photo cleanup policy:
  - `photoCleanupEnabled`
  - `photoCleanupIntervalHours`
- Added scheduled worker cleanup for hard-delete of orphaned photo DB/file artifacts.
- Added Google Photos album integration:
  - OAuth scope now requests `photoslibrary.readonly` in addition to calendar scope.
  - New API endpoints to list albums and album media.
  - Settings UI album selector and PhotoManager display for selected album content.

## Additional Reliability + Security Updates (2026-05-28)

- E2E reliability:
  - Stabilized `scripts/playwright-coverage-matrix.mjs` approval verification flow.
  - Reduced false negatives by verifying pending completions against API source-of-truth.
- Dependency security posture:
  - Upgraded `nodemailer` to patched `8.x` line.
  - Updated lockfile and related type package (`@types/nodemailer`).
  - `pnpm audit -r` reports no known vulnerabilities at update time.
