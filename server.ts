import { startTracing, stopTracing } from "./src/server/lib/tracing.js";
startTracing();

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import pinoHttp from "pino-http";
import { db } from "./src/server/db.js";
import { apiRouter } from "./src/server/routes.js";
import shareRouter from "./src/server/modules/share/routes.js";
import { startBackgroundWorker, stopWorker } from "./src/server/worker.js";
import { createServer } from "http";
import { Server } from "socket.io";
import { socketWrapper } from "./src/server/socket.js";
import { serializeRequestForLogs, sanitizeLoggedUrl } from "./src/server/lib/httpLogging.js";
import { logger } from "./src/server/lib/logger.js";

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
type RequestStats = {
  startedAt: number;
  inFlight: number;
  total: number;
  slowRequests: number;
  byMethod: Record<string, number>;
  byStatusClass: Record<string, number>;
  recentSlowRequests: Array<{ method: string; path: string; status: number; durationMs: number; at: number }>;
};

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
  if (path.startsWith('/api/parents/') && path.includes('/family-dashboard-data')) return 'GET /api/parents/:parentId/family-dashboard-data';
  if (path.startsWith('/api/parents/') && path.endsWith('/lists')) return 'GET /api/parents/:parentId/lists';
  if (path.startsWith('/api/lists/') && path.endsWith('/items')) return 'GET /api/lists/:listId/items';
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

function createRequestStats(): RequestStats {
  return {
    startedAt: Date.now(),
    inFlight: 0,
    total: 0,
    slowRequests: 0,
    byMethod: {},
    byStatusClass: {},
    recentSlowRequests: [],
  };
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
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      fontSrc: ["'self'", 'data:'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  } : false,
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
  limit: 500,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: (req) => {
    const host = String(req.hostname || "").toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return true;
    const forwardedFor = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    const ip = (forwardedFor || req.ip || "").replace(/^::ffff:/, "");
    return ip === "127.0.0.1";
  },
});
app.use(limiter);

const jsonBodyLimit = process.env.JSON_BODY_LIMIT || '1mb';
app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.urlencoded({ extended: false, limit: jsonBodyLimit }));
// /uploads static mount removed — photos served via authenticated /api/photos/file/:filename endpoint

app.use(pinoHttp({
  logger,
  serializers: {
    req: (req) => serializeRequestForLogs(req),
  },
}));

const slowRequestThresholdMs = Number(process.env.SLOW_REQUEST_MS || 400);
const perfStore: PerfStore = {};
const requestStats = createRequestStats();
app.locals.perfStore = perfStore;
app.locals.requestStats = requestStats;
app.use((req, res, next) => {
  const start = Date.now();
  const routeKey = resolvePerfRouteKey(req.method, req.path);
  requestStats.inFlight += 1;
  res.on('finish', () => {
    const duration = Date.now() - start;
    requestStats.inFlight = Math.max(0, requestStats.inFlight - 1);
    requestStats.total += 1;
    requestStats.byMethod[req.method] = (requestStats.byMethod[req.method] || 0) + 1;
    const statusClass = `${Math.floor(res.statusCode / 100)}xx`;
    requestStats.byStatusClass[statusClass] = (requestStats.byStatusClass[statusClass] || 0) + 1;
    if (routeKey) {
      incrementPerfStats(perfStore, routeKey, duration);
    }
    if (duration >= slowRequestThresholdMs) {
      requestStats.slowRequests += 1;
      requestStats.recentSlowRequests.unshift({
        method: req.method,
        path: sanitizeLoggedUrl(req.originalUrl),
        status: res.statusCode,
        durationMs: duration,
        at: Date.now(),
      });
      requestStats.recentSlowRequests = requestStats.recentSlowRequests.slice(0, 20);
      logger.warn({ method: req.method, path: sanitizeLoggedUrl(req.originalUrl), status: res.statusCode, durationMs: duration }, 'slow_request');
    }
  });
  next();
});

// Background Worker
if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
  startBackgroundWorker(io);
  process.on('SIGTERM', async () => { stopWorker(); await stopTracing(); process.exit(0); });
  process.on('SIGINT',  async () => { stopWorker(); await stopTracing(); process.exit(0); });
}

// API Routes
app.use("/api", apiRouter);

// Share Target Route (must be before SPA catch-all)
app.use(shareRouter);

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
    const indexPath = path.resolve(distPath, 'index.html');
    app.use(express.static(distPath));
    app.get(/^(?!\/api).*/, (req, res) => {
      res.type('html');
      fs.createReadStream(indexPath)
        .on('error', () => {
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to load app shell' });
          } else {
            res.destroy();
          }
        })
        .pipe(res);
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
