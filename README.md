# KidTasker: Level Up Your Parenting

Remember when gaming was just about the *game*? No live-service monetization, no intrusive trackers, no BS? That's the energy I brought to this project. KidTasker is the ultimate couch co-op for parents and kids. It turns the chore grind into a gamified experience where the kids actually *want* to complete their missions.

This is a totally self-hosted, offline-friendly setup. No cloud trackers, no third-party data sales, no analytics—just a solid React frontend and a Node back-end running on your own hardware.

## ✨ The Loot Drops (Features)

*   **Immersive Quest UI**: Smooth animations, XP pop-ups, and a progress bar that gives that dopamine hit when you finish a mission.
*   **Player 1 (Parent) Controls**: Assign missions, set the XP difficulty, manage custom categories, keep track of mission logs, and more. 
*   **Player 2 (Cadet) Experience**: Track XP, unlock badges, earn special customized themes, and spend hard-earned XP in the in-game Reward Store.
*   **Real-time Co-op Multiplayer**: State syncs instantaneously across devices using WebSockets! No more fighting over "Did you check the box yet?".
*   **Magic Add via Email Webhooks**: Forward emails to your unique KidTasker magic address, and Gemini AI parses them and inserts them directly into the Family Calendar or Meal Planners securely, validated with Mailgun signing!
*   **Ultimate Family Hub**: Native app modules for:
    *   ⛅ **Weather**: Open-Meteo SDK integration to keep track of the daily forecast.
    *   📅 **Google Calendar 2-way Sync**: Sync multiple Google accounts per family gracefully, importing events seamlessly into a unified family view.
    *   🖼️ **Family Photos Screensaver**: A native Sleep Mode that cycles through uploaded family memories like a digital picture frame.
    *   📝 **Shared Lists**: Real-time collaborative shopping, packing, and to-do lists.
    *   🍳 **Meal & Recipe Tracking**: Manage meal plans, map them to recipes, and keep the family fed.
*   **Zero-Telemetry Privacy**: Your data stays on your machine. I built this using native SQLite because databases are meant to be fast and local, not data-mined for a tech giant's profit.
*   **Built-in Co-op Monitoring**: A robust Node.js worker loop that handles alerts, mission timeouts, and notifications locally.
*   **Dev-Friendly Foundation**: Fully container-ready decoupled architecture with cleanly separated React components and backend domain modules. Plus, a pre-configured testing suite (Vitest + Supertest).

## 🛠 Loadout (Tech Stack)

*   **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Motion (animations that actually feel good).
*   **Backend**: Node.js, Express, `better-sqlite3`, `socket.io` (Realtime Updates).
*   **Smart Features**: Magic import webhook (parsing AI text to DB events via Gemini AI API), Photo Upload schema, and Google Calendar integrations.
*   **Testing**: Vitest, `@testing-library`, `supertest`.
*   **Deployment**: Docker/Docker Compose (Multi-stage build) with an automated GitHub Actions pipeline (Semgrep SAST security scanning + GHCR publishing).

> **For environment variable configuration and third-party API setup instructions (like Google OAuth), please see the [Setup Guide](docs/SETUP_GUIDE.md).**

---

## 💻 Start Your Game

### Prerequisites
- Node.js 20+

### First Run
1. Install dependencies:
   ```bash
   npm install
   ```
2. Fire up the dev environment:
   ```bash
   npm run dev
   ```
   *The server goes live at `http://localhost:3000`.*

---

## 🧪 Testing

I've set this up so you can test React components and Express database routes in the same flow.
```bash
npm run test
```
*Note: Configured to map `better-sqlite3` to `:memory:`, keeping your test environment glitch-free and fast.*

---

## 🐳 Docker Deployment (Production)

If you're running this on a home server, Docker Compose is the meta-strategy. You can build it locally or use the pre-built image from GitHub Container Registry (GHCR):

1. **Pull the latest automated build:**
   \`\`\`bash
   docker pull ghcr.io/your-github-username/kidtasker:latest
   \`\`\`

2. **Or build it manually from source:**
   \`\`\`bash
   docker-compose up -d --build
   \`\`\`

*Port 3000 will be hosting your instance.*

---

## 🔐 The "Anti-Tracking" Promise

Look, I didn't add any Google Analytics, trackers, or suspicious 3rd-party dependencies. KidTasker uses local `localStorage` keys mapped to user aliases for session handling and Mission Access Codes (Invite IDs) for pairing Player 1 and Player 2. 

While it now supports **optional** external integrations (like Google Calendar, Gemini Webhooks, or Open-Meteo Weather), the core engine stays local, and it stays yours. Zero forced telemetry. No external calls unless you specifically provide the API keys to opt into those features. Just you, your kids, and the chores.
