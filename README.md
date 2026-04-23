# 🚀 KidTasker - Stellar Mission Command

KidTasker is a gamified, space-themed task management application designed to help parents create missions (chores) and reward their cadets (kids) with Experience Points (XP) and badges. 

The entire stack is completely self-hosted, bypassing generic cloud trackers by utilizing a snappy Node.js + Express backend powered natively by SQLite. 

## ✨ Features
- **Immersive UI & Gamification**: Smooth React animations, XP floating counters, custom background themes, and a dynamic Streak flame.
- **Two Modalities**: 
  - **Ground Control (Parent)**: Assign missions, define XP difficulty, manage categories, and review mission history safely.
  - **Space Cadet (Kid)**: Complete interactive tasks with animated confirmation dialogues, earn badges, and track combat rank progression.
- **Self-Hosted Privacy**: 100% of data is stored securely on your own hardware via `better-sqlite3`. **Zero tracking, zero telemetry, and absolutely no external third-party service calls.**
- **Background Worker Processing**: Natively built-in Node.js cron-equivalent loop to scan for overdue assignments and dish out real-time 'alerts'.
- **Testing Architecture Built-In**: Pre-configured with Vitest, JSdom, and Supertest for zero-configuration unit and integration testing.

## 🛠 Tech Stack
* **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Motion (Animations), Lucide React.
* **Backend**: Express, `better-sqlite3`, native REST endpoints replacing Firestore SDKs.
* **Testing**: Vitest, `@testing-library/react`, `supertest`.
* **Deployment**: Docker, Docker Compose (Multi-stage build).

---

## 💻 Local Development

### Prerequisites
- Node.js 20+

### First Run
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the Vite/Express hybrid development server:
   ```bash
   npm run dev
   ```
   *The application will boot on `http://localhost:3000`.*
   *Note: Because this is an AI Studio exported layout, HMR may be disabled globally but backend/frontend are routed harmoniously.*

---

## 🧪 Testing

KidTasker features an integrated testing suite testing React components simultaneously with isolated Express database routes.
```bash
npm run test
```
The test command maps `better-sqlite3` strictly to `:memory:`, guaranteeing clean stateless testing runs.

---

## 🐳 Docker Deployment (Production)

To spin up a fully isolated, production-grade instance of the app, leverage the bundled multi-stage Docker setup.

### Using Docker Compose (Recommended)
This method ensures your SQLite database file persists safely onto a volume mount, avoiding data loss if the container is rebooted.

```bash
docker-compose up -d --build
```
The application will be accessible at `http://localhost:3000`.

### Manual Docker Build
If you prefer configuring your reverseproxies and volumes manually:
```bash
# Build the optimized multi-stage image
docker build -t kidtasker:latest .

# Run the container (Mapping port 3000 and assigning a physical drive block for the DB)
docker run -p 3000:3000 -v /my/local/dbfolder:/data -e DB_PATH=/data/database.db kidtasker:latest
```

## 🔐 Authentication Disclaimer
For absolute privacy and rapid enrollment during self-hosted context, KidTasker uses an **Opt-In Session Sandbox** mechanism using only local `localStorage` keys mapped to user aliases, fully eliminating Google or Firebase Oauth requirements. Parent-Kid linkage occurs internally via Mission Access Codes (Invite IDs) displayed inside the parent's dashboard.
