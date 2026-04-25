# External Calendar Sync & Authentication Design (Skylight Parity)

## Overview
To reach full feature parity with Skylight Calendar, our smart display needs the ability to sync external calendars (Google, Apple, Microsoft) and ensure parent accounts are securely authenticated. This spec covers robust JWT authentication, managing external OAuth connections, and deploying a background worker to continuously poll and sync external calendar events into our local database.

## 1. Robust Authentication
Currently, the parent authentication uses a placeholder "search by name" mechanism. We will transition to a standard token-based approach.

- **Login Flow**:
  - `POST /api/auth/register` (Email + Password PIN)
  - `POST /api/auth/login` (Returns JWT)
- **Session Management**:
  - JWT will be stored in an `HttpOnly` cookie or localStorage for the parent dashboard app.
  - The smart display (kiosk mode) uses a permanent device token or long-lived JWT tied to the `familyId`.
- **Changes**:
  - Introduce `bcrypt` for password/PIN hashing in the SQLite database.
  - Introduce `jsonwebtoken` (JWT) for secure route protection.

## 2. External Calendar OAuth Connectors
To sync external calendars, users need to link their Google, Apple, or Outlook accounts.

- **OAuth Flow**:
  - Create `GET /api/sync/connect/:provider` to initiate the OAuth flow.
  - Create `GET /api/sync/callback/:provider` to handle the authorization code, exchange it for access & refresh tokens.
- **Storage**:
  - Store tokens securely in the `connected_accounts` table, linked to the `familyId`.
  - Encrypt refresh tokens at rest (optional but recommended).

## 3. Background Sync Worker
The smart display needs a reliable background process to poll connected external calendars and reflect changes locally.

- **Architecture**:
  - Set up a long-running interval or `node-cron` job inside `src/server/worker.ts` that runs every 5 minutes.
- **De-duplication & Upsert**:
  - For each `connected_account`, fetch events from the provider (e.g., Google Calendar API).
  - Map external events (UID) to the local SQLite database (`events` table) using an `externalId` tracking column to prevent duplicate insertions.
  - Perform UPSERT (`INSERT ... ON CONFLICT(externalId) DO UPDATE`) to keep events updated.
- **Real-Time UI Updates**:
  - During the sync cycle, if the database detects changes (new/updated/deleted events), the worker will emit a `stale-data` or `events_updated` WebSocket event via `socket.io` to the specific `familyId` room.
  - This ensures the React frontend immediately fetches the latest data without a manual page refresh.

## 4. Error Handling & Testing
- **Token Expiry**: If a background sync fails with a 401 Unauthorized, automatically attempt to use the Refresh Token to get a new Access Token.
- **Testing**:
  - Add integration tests mocking the Google Calendar API responses.
  - Validate that the background worker successfully parses and UPSERTs mock events to the database and emits a WebSocket refresh signal.
