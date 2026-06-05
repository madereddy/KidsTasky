# KidTasker Setup Guide

Welcome to the KidTasker setup guide! This document will walk you through configuring your environment variables, getting third-party API keys (like Google OAuth and Gemini), and getting your application up and running.

## Environment Variables Explained

To run KidTasker, you need to configure the following environment variables (which should be placed in your `.env` file):

*   **`APP_URL`**: The base URL where your application is hosted. This is used to construct self-referential links, OAuth callback URGs, and API endpoints (e.g., `http://localhost:3000` or `https://your-domain.com`).
*   **`PORT`**: The server port (defaults to `3000`).
*   **`DB_PATH`**: The path to your SQLite database file (defaults to `database.db`).
*   **`JWT_SECRET`**: A strong, random string used to sign JSON Web Tokens for user authentication. You must change this in production!
*   **`GEMINI_API_KEY`**: Your Google Gemini API key. This is used to power the "Magic Add via Email Webhooks" feature, parsing natural language emails into actionable tasks or events.
*   **`GOOGLE_CLIENT_ID`** & **`GOOGLE_CLIENT_SECRET`**: Credentials you get from the Google Cloud Console. Used to enable Google Calendar sync and Google Photos Picker import.
*   **`GOOGLE_REDIRECT_URI`**: The callback URL configured in Google Cloud Console. It must match exactly. Typically: `<APP_URL>/api/sync/callback/google`
*   **`MAILGUN_SIGNING_KEY`**: If you are using Mailgun to forward emails to your app for the "Magic Add" feature, this key verifies that the webhook payload is authentically coming from Mailgun.

---

## Setting Up Google OAuth (For Calendar + Google Photos Picker)

KidTasker allows families to connect Google so that calendar events sync to the Family Dashboard and Google Photos can be imported through the Picker flow. The backend gracefully handles multiple OAuth tokens linked to your Family's `parentId`, meaning different parents or members can connect their individual Google accounts.

Here's how to create your Google OAuth credentials:

1.  **Create a Google Cloud Project:**
    *   Go to the [Google Cloud Console](https://console.cloud.google.com/).
    *   Click the project drop-down and select **New Project**. Name it something like `KidTasker Sync`.
2.  **Enable the Google Calendar API:**
    *   In the sidebar, go to **APIs & Services > Library**.
    *   Search for **Google Calendar API** and click **Enable**.
3.  **Configure the OAuth Consent Screen:**
    *   Go to **APIs & Services > OAuth consent screen**.
    *   Choose **External** (or Internal if you are managing this via Google Workspace).
    *   Fill out the required fields (App name, User support email, Developer contact information).
    *   Add the scopes needed:
        * `https://www.googleapis.com/auth/calendar.readonly`
        * `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`
    *   Add yourself as a Test User if your app is in testing mode.
4.  **Create Credentials:**
    *   Go to **APIs & Services > Credentials**.
    *   Click **Create Credentials > OAuth client ID**.
    *   Select **Web application** as the application type.
    *   Under **Authorized JavaScript origins**, add your `APP_URL` (e.g., `http://localhost:3000`).
    *   Under **Authorized redirect URIs**, add the exact path: `http://localhost:3000/api/sync/callback/google` (replace `http://localhost:3000` with your production URL if deployed).
5.  **Copy the Keys:**
    *   You will receive a **Client ID** and a **Client Secret**.
    *   Place these into your `.env` file for `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

### Scope Notes

- `photoslibrary.readonly` is no longer required by KidTasker and should not be treated as a blocking scope during setup.
- Photo import now uses the Google Photos Picker scope: `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`.
- If a reconnect fails, remove the app from your Google Account permissions and reconnect so Google prompts for the current scopes again.

### How Multiple Google Accounts Work
KidTasker's `sync_connections` database table maps Google OAuth tokens to a `parentId`. When a parent connects a calendar from the settings dashboard, the app stores the credentials. If mom and dad both connect their separate Google accounts, the backend stores both connections under the same family. The backend worker runs a routine that iterates through every connection in the database, fetches the latest calendar events for each, and maps them directly into the family's shared calendar view seamlessly.

---

## Weather Integration

Weather is powered by [open-meteo.com](https://open-meteo.com/) — **no API key required**. Latitude and longitude are configured per family via the Settings UI in-app. Forecasts are cached server-side for 10 minutes with stale-while-revalidate background refresh. No `.env` variable needed.

---

## Setting Up Gemini API

1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Create a new API key.
3. Paste the API key into the `GEMINI_API_KEY` environment variable in your `.env` file.

## Getting Started Locally

Once you have your `.env` file configured:

1. Install dependencies: `pnpm install`
2. Start the development server: `pnpm dev`
3. If using Docker, you can simply run: `docker-compose up -d`
