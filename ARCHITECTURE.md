# KidTasky Architecture

## Scope
This document reflects the current production behavior of the legacy-in-flight codebase and tracks migration direction without rewriting core behavior.

## Phase 1: Behavioral Inventory

### 1. Authentication and Family Membership (confidence: high)
- Feature: parent and kid login, invite-based joining, co-parent support.
- Inputs: email/password, invite code, JWT bearer tokens.
- Outputs: authenticated profile, family-scoped access.
- Side effects: user/invite writes, token issuance, token revocation checks.
- Contracts: `uid`, `role`, `parentId` define family boundary.

### 2. Tasks and Kid Tasking (confidence: high)
- Feature: parent creates tasks, kids claim/complete, parent approvals.
- Inputs: task payload, assignment (`kid uid` or `all`), completion actions.
- Outputs: task lists by role and state.
- Side effects: task rows, completion rows, socket stale-data broadcasts.
- Contracts: completion `approvalStatus` includes `pending|approved|rejected|skipped`.

### 3. Routines (confidence: high)
- Feature: routine templates and generated routine tasks.
- Inputs: template CRUD, reorder payload.
- Outputs: ordered template views and routine task generation.
- Side effects: persistent `sortOrder` updates.
- Contracts: reorder endpoint expects family-scoped ordered IDs.

### 4. Rewards and Stars (confidence: high)
- Feature: star economy, reward catalog and redemption flow.
- Inputs: reward/task mutation calls.
- Outputs: balances and reward states.
- Side effects: star updates and reward logs.
- Contracts: skip flow does not grant stars.

### 5. Calendar and Wall Mode (confidence: high)
- Feature: event CRUD, recurring/all-day/countdown support, wall-oriented views.
- Inputs: event payload (including recurrence/reminder/countdown fields).
- Outputs: family calendar views by mode/filter.
- Side effects: event writes, sync jobs, stale-data refetch.
- Contracts: recurring scope semantics (`one` vs `future`) on mutation paths.

### 6. Shared Lists and Meals (confidence: high)
- Feature: collaborative family lists and meal planning.
- Inputs: list/meal CRUD.
- Outputs: family-scoped items.
- Side effects: writes + stale-data broadcasts.
- Contracts: parent edit-lock blocks mutations.

### 7. Notes and Photos (confidence: medium)
- Feature: family pinboard note, local photo upload/storage, optional Google Photos album display.
- Inputs: note content, multipart upload.
- Outputs: note state and photo URLs.
- Side effects: sqlite metadata writes, file storage updates, scheduled hard-delete cleanup for orphaned photo artifacts.
- Contracts: upload path persistence and auth-scoped retrieval.

### 8. Notifications and Worker (confidence: medium)
- Feature: push/email channels with background checks.
- Inputs: subscription payloads, reminder windows.
- Outputs: push/email attempt outcomes.
- Side effects: subscription writes, reminder-send tracking.
- Contracts: one-reminder-per-event/reminder pairing.

### 9. External Integrations (confidence: medium)
- Google Calendar sync (import/export), weather feeds (open-meteo.com — no API key required), magic email ingestion.
- Inputs: provider credentials/webhooks.
- Outputs: imported events/weather, parsed updates.
- Side effects: network calls, sync metadata writes.
- Contracts: integrations are optional and must fail safely without blocking core app flows.
- Weather responses are cached via `TTLCache` (10-minute TTL, stale-while-revalidate at 60s before expiry). Background refresh errors are logged but non-fatal — stale data is served until the next successful fetch.

## Phase 2: Targeted Clarification
Only low/medium-confidence and non-code constraints are listed here.

### Clarifications resolved (2026-05-27)
1. Notifications reliability target: near-exact timing is sufficient; small drift is acceptable.
2. Photo retention policy: hard delete removed photos/users' photo artifacts on a configured cleanup schedule.
3. Google sync conflict policy: latest-write-wins.
4. Worker scheduling tolerance: near-exact is sufficient; minor cron drift is acceptable.

### Constraint assumptions (until confirmed)
- Uptime target: best-effort home deployment, no strict enterprise SLA.
- Scale target: one family per deployment, low to moderate concurrent device count.
- Compliance target: no special regulated-data requirements beyond family privacy.
- Failure tolerance: local-first behavior should continue even when all integrations are down.
- Data lifecycle: deleted photo assets should be permanently removed by scheduled cleanup tasks.

## Runtime Architecture
- API composition root: `src/server/routes.ts`
  - This file should stay as a route mounting surface only.
  - Do not add feature logic, diagnostics, response wrapping, or endpoint implementations here.
  - New cross-cutting middleware belongs under `src/server/middleware/*`.
  - New diagnostic/operational endpoints belong in a focused router such as `src/server/healthRoutes.ts`.
- Domain modules: `src/server/modules/*`
- Cross-device updates: socket stale-data events and client refetch
- Data layer: SQLite + migration files in `src/server/migrations`
- Shared cache utility: `src/server/lib/ttlCache.ts` — generic `TTLCache<T>` with deduped in-flight loads, prefix-invalidation, and optional stale-while-revalidate via `backgroundRefreshBeforeMs`
- Frontend services: `src/services/*`
- Feature surfaces: `src/components/{parent,kid,calendar,shared,...}`

## Guardrails Already in Place
- Parent edit lock enforced server-side on mutation routes.
- Family scoping by authenticated `parentId` boundary.
- API-wide stale-data broadcasts are centralized in `src/server/middleware/staleDataBroadcaster.ts`.
- Health and diagnostic API endpoints are centralized in `src/server/healthRoutes.ts`.
- Incremental modularization of large dashboard task surfaces:
  - `KidTaskBoard`
  - `ParentTaskBoard`

## Development Guardrails

### Type Safety
- `pnpm exec tsc --noEmit` is the baseline type gate.
- `noImplicitAny` and `noFallthroughCasesInSwitch` are enabled.
- `noImplicitReturns` is intentionally not enabled yet because existing Express route handlers include many implicit non-return paths. Enable it only after those handlers are normalized without changing route behavior.
- New code should not introduce `any` unless it is isolating untyped legacy or third-party data at a boundary.

### Test Runtime Cost
- Tests must not use production-strength password hashing parameters by default.
- Argon2id production defaults remain strong, but `src/server/lib/hashing.ts` uses lower defaults when Vitest or `NODE_ENV=test` is active.
- If a test exercises authentication, PIN validation, password change, or lockout behavior, prefer behavior assertions over real-cost hashing benchmarks.
- Use `ARGON2_MEMORY_COST`, `ARGON2_TIME_COST`, and `ARGON2_PARALLELISM` only when explicitly testing hashing configuration.

### Large Module Policy
- Do not grow composition roots or UI shells with new feature logic.
- Before adding more than a small routing/mounting change to a large file, extract a focused module with regression coverage around the existing behavior.
- Current high-value split targets:
  - `src/server/worker.ts`: split scheduling, reminders, sync jobs, photo cleanup, and diagnostics.
  - `src/components/calendar/CalendarView.tsx`: split view state, event mutation handlers, dialogs, and rendering adapters.
  - `src/App.tsx`: keep shrinking toward routing/providers/app-shell composition only.

## Security Standards

### Authentication & Hashing
- **Hashing:** Mandatory Argon2id for all new credentials.
  - Memory: 64MB
  - Time Cost: 3
  - Parallelism: 4
- Production defaults must stay at or above this level unless there is an explicit security review.
- Test defaults may be lower to keep regression tests deterministic and fast.

### Lockout Policy
Exponential backoff persisted in `auth_lockouts`.
- Attempts 1-5: No delay.
- Attempt 6: 1 minute.
- Attempt 7: 5 minutes.
- Attempt 8: 15 minutes.
- Attempt 9: 1 hour.
- Attempt 10+: 24 hours.

## Data Strategy

### The "Metadata Delimiter" Strategy
Approach for extending SQLite schemas without migrations for list items.
- **Format:** `[clean_text] |META:[json_payload]|`
- **Purpose:** Stores `storeName`, `locationName`, and `completedAt` inside the `text` field.
- **Governance:** This is considered a "Strangler-Fig" transitional state; new features with high data volume should still use proper columns.

## Strangler-Fig Migration Direction
1. Keep module boundaries stable (`routes -> service -> db`).
2. Extract hot paths into narrower service contracts without changing API behavior.
3. Add regression tests before each boundary refactor.
4. Shift UI feature blocks into isolated components behind existing service calls.
5. Maintain rollback per increment using reversible DB migrations + compose image tags.

## Refactor Validation Checklist
Before merging structural changes, run:
```bash
pnpm exec tsc --noEmit
pnpm build
pnpm test
```

For authentication, settings/PIN, and lockout changes, also run the focused suite:
```bash
pnpm exec vitest run server.test.ts tests/server/auth.test.ts src/server/modules/settings/api.test.ts
```

If a refactor moves route composition or middleware:
- Confirm endpoint paths and mount order remain unchanged.
- Confirm authenticated mutation routes still emit stale-data socket events.
- Confirm health endpoints remain unauthenticated where they were previously unauthenticated.
- Prefer extracting a module over adding logic back to `src/server/routes.ts`.

## Rebuild and Recovery Runbook
1. Native dependency refresh:
```bash
pnpm rebuild better-sqlite3
```
2. App validation:
```bash
pnpm exec tsc --noEmit
pnpm build
```
3. Container rebuild/relaunch:
```bash
docker compose build
docker compose down
docker compose up -d
docker compose ps
```
4. If runtime issue appears, inspect:
```bash
docker compose logs --tail=300 webapp
```
