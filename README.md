# KidTasky

Local-first family planner and kid tasking app with parent controls, approvals, rewards, routines, calendar, wall mode, shared lists, meals, photos, and optional external integrations.

## Current Status
- Core family workflows are implemented and in active local use.
- Recent delivery includes: `Up for Grabs` tasks, task skip without stars, routine drag-reorder with persistence, and server-enforced parent edit-lock checks on mutation routes.
- Multi-device convergence is improved through socket `stale-data` refetch behavior.
- Reliability hardening includes a stabilized coverage E2E approval flow and refreshed dependency security updates (`nodemailer` patched line).
- Security hardening includes auth attempt backoff/temporary lockout, structured security event logs, and image upload magic-byte validation with extension normalization.
- Weather caching uses `TTLCache` with stale-while-revalidate: background refresh fires 60s before the 10-minute TTL expires, eliminating blocking API call spikes at cache expiry.

## Tech Stack
- Frontend: React 19, TypeScript, Vite, Tailwind CSS 4
- Backend: Node.js + Express 5 + Socket.IO
- Storage: SQLite via `better-sqlite3`
- Tests: Vitest + Testing Library + Supertest
- Containerization: Docker + Docker Compose

## Prerequisites
- Node.js 24+
- pnpm 10+
- Docker Desktop (for container workflow)

## Local Dev Setup
1. Install dependencies:
```bash
pnpm install
```
2. Rebuild native modules if needed (Windows/local ABI issues):
```bash
pnpm rebuild better-sqlite3
```
3. Start dev server:
```bash
pnpm dev
```
4. Open app:
- `http://localhost:3000`

## Build and Validation
- Typecheck:
```bash
pnpm exec tsc --noEmit
```
- Production build:
```bash
pnpm build
```
- Test suite:
```bash
pnpm test
```
- Focused E2E reliability workflow:
```bash
node scripts/playwright-coverage-matrix.mjs
```

## Docker / Compose (Local Production-like)
This repo maps container port `3000` to host port `3010`.

1. Rebuild containers:
```bash
docker compose build
```
2. Relaunch stack:
```bash
docker compose down
docker compose up -d
```
3. Verify status and logs:
```bash
docker compose ps
docker compose logs --tail=200 webapp
```
4. Open app:
- `http://localhost:3010`

## Environment
Copy `.env.example` to `.env` and set values as needed for optional integrations.

For internet exposure behind Caddy/TLS, set:
- `ALLOWED_ORIGINS=https://your-domain.example`
- `TRUST_PROXY_HOPS=1`
- `ENFORCE_HTTPS=true`
- strong `JWT_SECRET` value

Optional integrations include:
- Google Calendar sync
- Google Photos album display (via Google OAuth)
- Weather — via [open-meteo.com](https://open-meteo.com/), no API key required; lat/lon set in family Settings UI
- Magic email/webhook ingestion (Mailgun + Gemini AI)
- Push notifications / SMTP fallback

Family photo controls now include:
- in-app scheduled hard-delete cleanup settings
- Google Photos album selector for display in photo surfaces

If unset, core local task/calendar/list/reward flows still run.

## Project Docs
- Architecture and migration strategy: [ARCHITECTURE.md](ARCHITECTURE.md)
- Setup variables and integration specifics: [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md)
- Superpowers implementation plans: `docs/superpowers/plans/`
