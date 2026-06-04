# KidTasky

KidTasky is a local-first family planner for parents and kids. It combines tasks, approvals, routines, rewards, calendar planning, lists, meals, photos, notifications, and optional external integrations in one app.

## What It Covers
- Parent-managed tasks, approvals, routines, rewards, and notifications
- Kid dashboards and shared family views
- Calendar, notes, homework, lists, meals, and events
- Family photos with local uploads and Google Photos picker import
- Optional weather, push notifications, SMTP email, Google sync, and magic email ingestion

## Stack
- Frontend: React 19, TypeScript, Vite, Tailwind CSS 4
- Backend: Node.js, Express 5, Socket.IO
- Storage: SQLite via `better-sqlite3`
- Tests: Vitest, Testing Library, Supertest
- Runtime: Docker and Docker Compose supported

## Prerequisites
- Node.js 24+
- pnpm 10+
- Docker Desktop for container workflows

## Quick Start
1. Install dependencies:
```bash
pnpm install
```
2. Rebuild `better-sqlite3` if your local Node ABI changed:
```bash
pnpm rebuild better-sqlite3
```
3. Create a local env file from `.env.example`.
4. Start the app:
```bash
pnpm dev
```
5. Open `http://localhost:3000`

## Common Commands
- Typecheck:
```bash
pnpm exec tsc --noEmit
```
- Test:
```bash
pnpm test
```
- Production build:
```bash
pnpm build
```
- Focused E2E verification:
```bash
pnpm test:e2e:verification
```

## Docker
The container exposes port `3000` and maps it to host port `3010`.

1. Build:
```bash
docker compose build
```
2. Start:
```bash
docker compose up -d
```
3. Check status:
```bash
docker compose ps
```
4. Tail logs:
```bash
docker compose logs --tail=200 webapp
```
5. Open `http://localhost:3010`

## Health Endpoints
These are useful when the app is slow, background work is failing, or memory usage needs to be tracked over time.

- `/api/health/build` - build metadata, git SHA, process start time
- `/api/health/cache` - cache sizes, hit/miss counters, and load stats
- `/api/health/db` - SQLite responsiveness, pragmas, and DB/WAL file sizes
- `/api/health/deps` - short dependency probes and integration config flags
- `/api/health/memory` - process memory, uptime, and socket counts
- `/api/health/perf` - aggregated latency buckets for selected hot routes
- `/api/health/requests` - request totals, in-flight count, status classes, recent slow requests
- `/api/health/worker` - background job run state and Google sync backoff

### Memory Sampling
Sample runtime memory over time:
```bash
pnpm health:memory:sample -- --url http://localhost:3010/api/health/memory --interval-ms 30000 --samples 20
```

The sampler writes JSONL snapshots under `tmp/health/` so you can compare `rssMb`, `heapUsedMb`, and socket counts over time.

## Environment Notes
Copy `.env.example` to `.env` and fill in only what you need. Core local task, calendar, list, and reward flows work without most optional integrations.

For internet exposure behind Caddy or another TLS-terminating proxy, set:
- `ALLOWED_ORIGINS=https://your-domain.example`
- `TRUST_PROXY_HOPS=1`
- `ENFORCE_HTTPS=true`
- a strong `JWT_SECRET`

Optional integrations:
- Google Calendar sync
- Google Photos picker import
- Weather via [open-meteo.com](https://open-meteo.com/)
- Mailgun + Gemini-based magic email ingestion
- Push notifications
- SMTP fallback delivery

## Operations Notes
- Request logs are structured and redact sensitive headers by default.
- Slow requests are logged as `slow_request`.
- Background jobs log under `[worker]`.
- Photo import and Google Photos activity log under `[photos:*]`.

## Project Docs
- Architecture and migration strategy: [ARCHITECTURE.md](ARCHITECTURE.md)
- Setup variables and integration details: [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md)
- Internal implementation plans: `docs/superpowers/plans/`
