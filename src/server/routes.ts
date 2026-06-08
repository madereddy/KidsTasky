import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { socketWrapper } from './socket.js';
import { db, dbPath } from './db.js';
import { getTTLCacheDiagnostics } from './lib/ttlCache.js';
import { getWorkerDiagnostics } from './worker.js';
import { authRouter } from './modules/auth/routes.js';
import { usersRouter } from './modules/users/routes.js';
import { tasksRouter } from './modules/tasks/routes.js';
import { categoriesRouter } from './modules/categories/routes.js';
import { invitesRouter } from './modules/invites/routes.js';
import { notificationsRouter } from './modules/notifications/routes.js';
import { rewardsRouter } from './modules/rewards/routes.js';
import { eventsRouter } from './modules/events/routes.js';
import { weatherRouter } from './modules/weather/routes.js';
import { listsRouter } from './modules/lists/routes.js';
import { mealsRouter } from './modules/meals/routes.js';
import { magicRouter } from './modules/magic/routes.js';
import { photosRouter } from './modules/photos/routes.js';
import { syncRouter } from './modules/sync/routes.js';
import { settingsRouter } from './modules/settings/routes.js';
import { routinesRouter } from './modules/routines/routes.js';
import { flagsRouter } from './modules/flags/routes.js';
import { notesRouter } from './modules/notes/routes.js';
import { homeworkRouter } from './modules/homework/routes.js';
import { proofTemplatesRouter } from './modules/proofTemplates/routes.js';
import { dashboardRouter } from './modules/dashboard/routes.js';
import { logger } from './lib/logger.js';

const router = Router();
const buildStartedAt = Date.now();

function toMb(bytes: number) {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

function safeReadJsonFile(filePath: string): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getBuildInfo() {
  const metadata = safeReadJsonFile(path.resolve(process.cwd(), 'metadata.json'));
  const pkg = safeReadJsonFile(path.resolve(process.cwd(), 'package.json'));
  return {
    appName: String(process.env.APP_NAME || metadata?.name || 'KidTasky'),
    version: String(process.env.APP_VERSION || pkg?.version || 'unknown'),
    gitSha: process.env.BUILD_SHA || process.env.GIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || null,
    buildTime: process.env.BUILD_TIME || process.env.APP_BUILD_TIME || null,
    processStartedAt: buildStartedAt,
    environment: process.env.NODE_ENV || 'development',
  };
}

async function probeHttpDependency(name: string, url: string) {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return {
      name,
      url,
      ok: response.ok,
      status: response.status,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      name,
      url,
      ok: false,
      status: null,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildOpenMeteoForecastUrl(host: string, latitude: number, longitude: number) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily: 'weathercode,temperature_2m_max,temperature_2m_min',
    hourly: 'weathercode,temperature_2m',
    timezone: 'auto',
  });
  return `${host}/v1/forecast?${params.toString()}`;
}

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

router.post('/client-logs', (req, res) => {
  const body = req.body as {
    level?: 'info' | 'warn' | 'error';
    message?: string;
    context?: Record<string, unknown>;
    url?: string;
    userAgent?: string;
    timestamp?: string;
  };
  const level = body?.level === 'warn' || body?.level === 'error' ? body.level : 'info';
  const message = String(body?.message || 'client_log');
  const payload = {
    source: 'browser',
    message,
    context: body?.context || {},
    pageUrl: body?.url || null,
    userAgent: body?.userAgent || null,
    clientTimestamp: body?.timestamp || null,
  };
  logger[level](payload, 'client_log');
  res.status(202).json({ accepted: true });
});

router.get('/health/memory', (req, res) => {
  const memory = process.memoryUsage();

  res.json({
    status: 'ok',
    runtime: {
      pid: process.pid,
      node: process.version,
      uptimeSec: Math.round(process.uptime() * 100) / 100,
    },
    memory: {
      rssBytes: memory.rss,
      rssMb: toMb(memory.rss),
      heapTotalBytes: memory.heapTotal,
      heapTotalMb: toMb(memory.heapTotal),
      heapUsedBytes: memory.heapUsed,
      heapUsedMb: toMb(memory.heapUsed),
      externalBytes: memory.external,
      externalMb: toMb(memory.external),
      arrayBuffersBytes: memory.arrayBuffers,
      arrayBuffersMb: toMb(memory.arrayBuffers),
    },
    sockets: socketWrapper.getDiagnostics(),
  });
});

router.get('/health/build', (req, res) => {
  res.json({
    status: 'ok',
    build: getBuildInfo(),
  });
});

router.get('/health/requests', (req, res) => {
  const requestStats = (req.app.locals.requestStats || null) as
    | {
        startedAt: number;
        inFlight: number;
        total: number;
        slowRequests: number;
        byMethod: Record<string, number>;
        byStatusClass: Record<string, number>;
        recentSlowRequests: Array<{ method: string; path: string; status: number; durationMs: number; at: number }>;
      }
    | null;

  res.json({
    status: 'ok',
    requests: requestStats,
  });
});

router.get('/health/cache', (req, res) => {
  res.json({
    status: 'ok',
    caches: getTTLCacheDiagnostics(),
  });
});

router.get('/health/worker', (req, res) => {
  res.json({
    status: 'ok',
    worker: getWorkerDiagnostics(),
  });
});

router.get('/health/db', (req, res) => {
  const startedAt = Date.now();
  const selectOne = db.prepare('SELECT 1 as ok').get() as { ok: number };
  const latencyMs = Date.now() - startedAt;
  const journalMode = db.pragma('journal_mode', { simple: true });
  const synchronous = db.pragma('synchronous', { simple: true });
  const cacheSize = db.pragma('cache_size', { simple: true });
  const busyTimeout = db.pragma('busy_timeout', { simple: true });
  const pageCount = db.pragma('page_count', { simple: true });
  const freelistCount = db.pragma('freelist_count', { simple: true });

  const resolvedDbPath = dbPath === ':memory:' ? ':memory:' : path.resolve(process.cwd(), dbPath);
  const dbFile = resolvedDbPath === ':memory:' || !fs.existsSync(resolvedDbPath) ? null : fs.statSync(resolvedDbPath);
  const walPath = resolvedDbPath === ':memory:' ? null : `${resolvedDbPath}-wal`;
  const shmPath = resolvedDbPath === ':memory:' ? null : `${resolvedDbPath}-shm`;

  res.json({
    status: 'ok',
    db: {
      ok: selectOne.ok === 1,
      latencyMs,
      path: resolvedDbPath,
      journalMode,
      synchronous,
      cacheSize,
      busyTimeout,
      pageCount,
      freelistCount,
      files: {
        mainBytes: dbFile?.size ?? null,
        walBytes: walPath && fs.existsSync(walPath) ? fs.statSync(walPath).size : null,
        shmBytes: shmPath && fs.existsSync(shmPath) ? fs.statSync(shmPath).size : null,
      },
    },
  });
});

router.get('/health/perf', (req, res) => {
  const store = (req.app.locals.perfStore || {}) as Record<string, { count: number; totalMs: number; maxMs: number; buckets: Record<string, number> }>;
  const summary = Object.entries(store).reduce((acc, [route, stats]) => {
    acc[route] = {
      count: stats.count,
      avgMs: stats.count > 0 ? Math.round((stats.totalMs / stats.count) * 100) / 100 : 0,
      maxMs: stats.maxMs,
      buckets: stats.buckets,
    };
    return acc;
  }, {} as Record<string, { count: number; avgMs: number; maxMs: number; buckets: Record<string, number> }>);

  res.json({ routes: summary });
});

router.get('/health/deps', async (req, res) => {
  const hasGoogleCredentials = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const checks = await Promise.all([
    probeHttpDependency('openMeteoPrimary', buildOpenMeteoForecastUrl('https://api.open-meteo.com', 28.4418, -81.5642)),
    probeHttpDependency('openMeteoEu', buildOpenMeteoForecastUrl('https://eu-api.open-meteo.com', 28.4418, -81.5642)),
    ...(hasGoogleCredentials
      ? [probeHttpDependency('googleApisDiscovery', 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest')]
      : []),
  ]);

  res.json({
    status: 'ok',
    dependencies: {
      configured: {
        googleCalendar: hasGoogleCredentials,
        magicEmail: Boolean(process.env.MAILGUN_SIGNING_KEY),
        gemini: Boolean(process.env.GEMINI_API_KEY),
      },
      checks,
    },
  });
});

// Generic stale-data broadcaster for all authenticated mutation routes
router.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const originalJson = res.json;
    res.json = function(body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const user = (req as any).user;
        if (user) {
          const parentId = (user.role === 'parent' || user.role === 'coparent') ? (user.parentId || user.uid) : user.parentId;
          if (parentId) {
            // Safely compute an entity hint from the path (e.g., '/tasks/' -> 'tasks')
            const pathParts = req.path.split('/').filter(Boolean);
            const rawEntityHint = pathParts[0] || 'general';
            const entityHintMap: Record<string, string> = {
              'list-items': 'list_items',
              'meal-plans': 'meal_plans',
            };
            const entityHint = entityHintMap[rawEntityHint] ?? rawEntityHint;
            socketWrapper.emitStaleData(parentId, entityHint);
          }
        }
      }
      return originalJson.call(this, body);
    };
  }
  next();
});

router.use(authRouter);
router.use(usersRouter);
router.use(tasksRouter);
router.use(categoriesRouter);
router.use(invitesRouter);
router.use(notificationsRouter);
router.use(rewardsRouter);
router.use(eventsRouter);
router.use(weatherRouter);
router.use(listsRouter);
router.use(mealsRouter);
router.use(magicRouter);
router.use(photosRouter);
router.use(syncRouter);
router.use(settingsRouter);
router.use(routinesRouter);
router.use(flagsRouter);
router.use(notesRouter);
router.use(homeworkRouter);
router.use(proofTemplatesRouter);
router.use(dashboardRouter);

export const apiRouter = router;

