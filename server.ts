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

type PerfBucket = '<100ms' | '<250ms' | '<500ms' | '<1000ms' | '>=1000ms';
type PerfStats = {
  count: number;
  totalMs: number;
  maxMs: number;
  buckets: Record<PerfBucket, number>;
};
type PerfStore = Record<string, PerfStats>;

function createEmptyStats(): PerfStats {
  return {
    count: 0,
    totalMs: 0,
    maxMs: 0,
    buckets: {
      '<100ms': 0,
      '<250ms': 0,
      '<500ms': 0,
      '<1000ms': 0,
      '>=1000ms': 0,
    },
  };
}

function resolvePerfRouteKey(method: string, path: string): string | null {
  if (method !== 'GET') return null;
  if (path.startsWith('/api/settings/')) return 'GET /api/settings/*';
  if (path.startsWith('/api/parents/') && path.endsWith('/events')) return 'GET /api/parents/:parentId/events';
  return null;
}

function incrementPerfStats(store: PerfStore, routeKey: string, durationMs: number) {
  const stats = store[routeKey] || (store[routeKey] = createEmptyStats());
  stats.count += 1;
  stats.totalMs += durationMs;
  if (durationMs > stats.maxMs) stats.maxMs = durationMs;
  if (durationMs < 100) stats.buckets['<100ms'] += 1;
  else if (durationMs < 250) stats.buckets['<250ms'] += 1;
  else if (durationMs < 500) stats.buckets['<500ms'] += 1;
  else if (durationMs < 1000) stats.buckets['<1000ms'] += 1;
  else stats.buckets['>=1000ms'] += 1;
}

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
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? (process.env.NODE_ENV === "production" ? 1 : 0));
if (Number.isFinite(trustProxyHops) && trustProxyHops >= 0) {
  app.set('trust proxy', trustProxyHops);
}
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
const enforceHttps = process.env.ENFORCE_HTTPS === 'true';
if (enforceHttps) {
  app.use((req, res, next) => {
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
    if (req.secure || forwardedProto.includes('https')) return next();
    return res.status(426).json({ error: 'HTTPS required' });
  });
}
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100, 
  standardHeaders: 'draft-8', 
  legacyHeaders: false,
  skip: (req) => {
    const host = String(req.hostname || "").toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return true;
    const forwardedFor = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    const ip = (forwardedFor || req.ip || "").replace(/^::ffff:/, "");
    return ip === "127.0.0.1" || isRfc1918Ipv4(ip);
  },
});
app.use(limiter);

const jsonBodyLimit = process.env.JSON_BODY_LIMIT || '1mb';
app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.urlencoded({ extended: false, limit: jsonBodyLimit }));
// /uploads static mount removed — photos served via authenticated /api/photos/file/:filename endpoint

const slowRequestThresholdMs = Number(process.env.SLOW_REQUEST_MS || 400);
const perfStore: PerfStore = {};
app.locals.perfStore = perfStore;
app.use((req, res, next) => {
  const start = Date.now();
  const routeKey = resolvePerfRouteKey(req.method, req.path);
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (routeKey) {
      incrementPerfStats(perfStore, routeKey, duration);
    }
    if (duration >= slowRequestThresholdMs) {
      console.warn('[perf:slow_request]', {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: duration,
      });
    }
  });
  next();
});

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
