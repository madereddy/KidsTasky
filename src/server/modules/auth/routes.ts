import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { rateLimit } from 'express-rate-limit';
import { authService } from './service.js';
import { authenticateUser } from '../../middleware/auth.js';
import { logSecurityEvent } from '../../lib/securityLog.js';

export const authRouter = Router();
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});
const profileLookupLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many profile lookups. Please try again later.' },
});

type AttemptState = { failures: number; lockUntil: number };
const authAttempts = new Map<string, AttemptState>();
const AUTH_MAX_BACKOFF_MS = 15 * 60 * 1000;
const AUTH_FAILURE_TTL_MS = 60 * 60 * 1000;

function getClientIp(req: Request): string {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return (forwarded || req.ip || '').replace(/^::ffff:/, '') || 'unknown';
}

function getAttemptKey(kind: string, identifier: string, ip: string): string {
  return `${kind}:${identifier.toLowerCase()}:${ip}`;
}

function getRetryAfterMs(key: string): number {
  const attempt = authAttempts.get(key);
  if (!attempt) return 0;
  const retryAfterMs = attempt.lockUntil - Date.now();
  if (retryAfterMs <= 0) return 0;
  return retryAfterMs;
}

function recordAuthFailure(key: string): number {
  const now = Date.now();
  const prev = authAttempts.get(key);
  const failures = (prev?.failures || 0) + 1;
  const backoffMs = Math.min(AUTH_MAX_BACKOFF_MS, 1000 * Math.pow(2, Math.min(failures - 1, 10)));
  authAttempts.set(key, { failures, lockUntil: now + backoffMs });
  return backoffMs;
}

function clearAuthFailure(key: string) {
  authAttempts.delete(key);
}

setInterval(() => {
  const cutoff = Date.now() - AUTH_FAILURE_TTL_MS;
  for (const [key, value] of authAttempts) {
    if (value.lockUntil < cutoff) authAttempts.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

authRouter.post('/auth/register', authLimiter, [
  body('email').isEmail(),
  body('password').isString().isLength({ min: 8 }),
  body('name').isString().notEmpty(),
  validate
], async (req: Request, res: Response) => {
  try {
    const result = await authService.register(req.body.email, req.body.password, req.body.name);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

authRouter.post('/auth/login', authLimiter, [
  body('email').isString().notEmpty(),
  body('password').isString(),
  validate
], async (req: Request, res: Response) => {
  const email = String(req.body?.email || '').trim();
  const ip = getClientIp(req);
  const key = getAttemptKey('parent-login', email, ip);
  const retryAfterMs = getRetryAfterMs(key);
  if (retryAfterMs > 0) {
    logSecurityEvent('auth.parent_login.blocked', { email, ip, retryAfterMs });
    return res.status(429).json({ error: 'Too many failed login attempts. Please try again shortly.' });
  }
  const result = await authService.login(req.body.email, req.body.password);
  if (!result) {
    const backoffMs = recordAuthFailure(key);
    logSecurityEvent('auth.parent_login.failed', { email, ip, backoffMs });
    return res.status(401).json({ error: "Invalid credentials" });
  }
  clearAuthFailure(key);
  result.user.badges = JSON.parse(result.user.badges || "[]");
  logSecurityEvent('auth.parent_login.success', { uid: result.user.uid, ip }, 'info');
  res.json(result);
});

authRouter.post('/auth/login/kid', authLimiter, [
  body('uid').isString().notEmpty(),
  body('pin').isString().isLength({ min: 4, max: 4 }),
  validate
], async (req: Request, res: Response) => {
  const kidUid = String(req.body?.uid || '').trim();
  const ip = getClientIp(req);
  const key = getAttemptKey('kid-login', kidUid, ip);
  const retryAfterMs = getRetryAfterMs(key);
  if (retryAfterMs > 0) {
    logSecurityEvent('auth.kid_login.blocked', { uid: kidUid, ip, retryAfterMs });
    return res.status(429).json({ error: 'Too many failed PIN attempts. Please try again shortly.' });
  }
  const result = await authService.loginKid(req.body.uid, req.body.pin);
  if (!result) {
    const backoffMs = recordAuthFailure(key);
    logSecurityEvent('auth.kid_login.failed', { uid: kidUid, ip, backoffMs });
    return res.status(401).json({ error: "Invalid PIN" });
  }
  clearAuthFailure(key);
  result.user.badges = JSON.parse(result.user.badges || "[]");
  logSecurityEvent('auth.kid_login.success', { uid: result.user.uid, ip }, 'info');
  res.json(result);
});

authRouter.get('/auth/profiles/:email', profileLookupLimiter, [
  validate
], async (req: Request, res: Response) => {
  const email = req.params.email as string;
  const kids = authService.getKidsByParentEmail(email);
  res.json({ kids });
});

authRouter.post('/auth/set-pin', authenticateUser, [
  body('pin').isString().isLength({ min: 4, max: 4 }),
  validate
], async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user.uid;
    await authService.setPin(uid, req.body.pin);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

authRouter.get('/auth/me', authenticateUser, (req: Request, res: Response) => {
  const uid = (req as any).user.uid;
  const user = authService.getMe(uid);
  if (user) {
    user.badges = JSON.parse(user.badges || "[]");
    return res.json({ user });
  }
  res.status(401).json({ error: "User not found" });
});
