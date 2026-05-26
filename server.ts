import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { db } from "./src/server/db.js";
import { apiRouter } from "./src/server/routes.js";
import { startBackgroundWorker } from "./src/server/worker.js";
import { createServer } from "http";
import { Server } from "socket.io";
import { socketWrapper } from "./src/server/socket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export { db };
export const app = express();

function parseCsvEnv(name: string): string[] {
  const raw = process.env[name];
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function resolveAllowedOrigins(): string[] {
  const configured = parseCsvEnv("ALLOWED_ORIGINS");
  if (configured.length > 0) return configured;
  return [];
}

function isRfc1918Ipv4(hostname: string): boolean {
  const octets = hostname.split(".").map((value) => Number(value));
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return false;
  }
  if (octets[0] === 10) return true;
  if (octets[0] === 192 && octets[1] === 168) return true;
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
  return false;
}

function isLocalOrPrivateOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    return isRfc1918Ipv4(hostname);
  } catch {
    return false;
  }
}

function isOriginAllowed(origin: string | undefined, allowedOrigins: string[], hasConfiguredOrigins: boolean): boolean {
  if (!origin) return true;
  if (hasConfiguredOrigins) return allowedOrigins.includes(origin);
  return isLocalOrPrivateOrigin(origin);
}

export const httpServer = createServer(app);
const allowedOrigins = resolveAllowedOrigins();
const hasConfiguredOrigins = allowedOrigins.length > 0;
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin, allowedOrigins, hasConfiguredOrigins)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  },
});
socketWrapper.init(io);
app.set('io', io);

// Security
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin, allowedOrigins, hasConfiguredOrigins)) {
      callback(null, true);
      return;
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100, 
  standardHeaders: 'draft-8', 
  legacyHeaders: false,
});
app.use(limiter);

app.use(express.json());
app.use('/uploads', express.static(path.resolve('uploads')));

// Background Worker
if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
  startBackgroundWorker();
}

// API Routes
app.use("/api", apiRouter);

// Server Initialization
export async function startServer() {
  if (!process.env.VITEST && process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (process.env.NODE_ENV === "production" && !process.env.TEST_BUILD) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get(/^(?!\/api).*/, (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = parseInt(process.env.PORT || '3000', 10);
  const HOST = process.env.HOST || '127.0.0.1';
  
  if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
    httpServer.listen(PORT, HOST, () => {
      console.log(`Server running on http://${HOST}:${PORT}`);
    });
  }
}

// Start strictly if we aren't testing
if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
  startServer();
}
