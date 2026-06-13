# Production Regression Checklist

Before every production deployment, perform the following manual and automated checks.

## 1. Automated Gates
- [ ] `pnpm exec tsc --noEmit` passes with no errors.
- [ ] `pnpm build` completes successfully for both client and server.
- [ ] `pnpm test` passes all unit and integration tests.
- [ ] `docker compose build` succeeds with no build cache issues.

## 2. Authentication & Access
- [ ] Parent login works (email/password).
- [ ] Kid login works (PIN).
- [ ] Token refresh works (stays logged in after page reload).
- [ ] Co-parent invite and join flow works.
- [ ] Parental lock blocks mutations on the wall/kiosk display.

## 3. Data Integrity
- [ ] New tasks can be created and assigned.
- [ ] Completions are recorded and stars/XP are granted correctly.
- [ ] Calendar events (recurring and single) are visible and editable.
- [ ] Google Calendar sync successfully imports/exports (if configured).
- [ ] Photo uploads are stored and visible in the family gallery.

## 4. Real-time & Worker
- [ ] Socket.IO "stale-data" events trigger client-side refreshes.
- [ ] Background worker is "active" (check `/api/health/worker`).
- [ ] Event reminders are delivered (Push/Email).
- [ ] Overdue task notifications are generated daily.

## 5. Health & Diagnostics
- [ ] `/api/health` reports status `ok`.
- [ ] `/api/health/db` confirms connectivity and integrity.
- [ ] `/api/health/env` confirms all required secrets are present.
- [ ] No critical errors in server logs (`docker compose logs webapp`).

## 6. Mobile & PWA
- [ ] Bottom navigation works on mobile viewport.
- [ ] Service worker is active and caching assets.
- [ ] "Add to Home Screen" prompt or icon is functional.
