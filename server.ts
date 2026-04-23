import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { db } from "./src/server/db.js";
import { apiRouter } from "./src/server/routes.js";
import { startBackgroundWorker } from "./src/server/worker.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export { db };
export const app = express();
app.use(express.json());

// Background Worker
if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
  startBackgroundWorker();
}

// API Routes
app.use("/api", apiRouter);

// Server Initialization
export async function startServer() {
  if (!process.env.VITEST && process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (process.env.NODE_ENV === "production" && !process.env.TEST_BUILD) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = parseInt(process.env.PORT || '3000', 10);
  
  if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

// Start strictly if we aren't testing
if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
  startServer();
}
