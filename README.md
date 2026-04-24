# KidTasker: Level Up Your Parenting

Remember when gaming was just about the *game*? No live-service monetization, no intrusive trackers, no BS? That's the energy I brought to this project. KidTasker is the ultimate couch co-op for parents and kids. It turns the chore grind into a gamified experience where the kids actually *want* to complete their missions.

This is a totally self-hosted, offline-friendly setup. No cloud trackers, no third-party data sales, no analytics—just a solid React frontend and a Node back-end running on your own hardware.

## ✨ The Loot Drops (Features)

*   **Immersive Quest UI**: Smooth animations, XP pop-ups, and a progress bar that gives that dopamine hit when you finish a mission.
*   **Player 1 (Parent) Controls**: Assign missions, set the XP difficulty, manage custom categories, and keep track of mission logs. 
*   **Player 2 (Cadet) Experience**: Track XP, unlock badges, earn special customized themes, and spend hard-earned XP in the in-game Reward Store.
*   **Zero-Telemetry Privacy**: Your data stays on your machine. I built this using native SQLite because databases are meant to be fast and local, not data-mined for a tech giant's profit.
*   **Built-in Co-op Monitoring**: A robust Node.js worker loop that handles alerts, mission timeouts, and notifications locally.
*   **Dev-Friendly Foundation**: Fully container-ready decoupled architecture with cleanly separated React components and backend domain modules. Plus, a pre-configured testing suite (Vitest + Supertest) because debugging our own code is hard enough without fighting a bad test environment.

## 🛠 Loadout (Tech Stack)

*   **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Motion (animations that actually feel good).
*   **Backend**: Node.js, Express, `better-sqlite3`.
*   **Testing**: Vitest, `@testing-library`, `supertest`.
*   **Deployment**: Docker/Docker Compose (Multi-stage build).

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

If you're running this on a home server, Docker Compose is the meta-strategy.

```bash
docker-compose up -d --build
```
*Port 3000 will be hosting your instance.*

---

## 🔐 The "Anti-Tracking" Promise

Look, I didn't add any Google Analytics, trackers, or suspicious 3rd-party dependencies. KidTasker uses local `localStorage` keys mapped to user aliases for session handling and Mission Access Codes (Invite IDs) for pairing Player 1 and Player 2. That's it. It stays local, it stays yours. Zero tracking, zero telemetry, no external calls. Just you, your kids, and the chores.
