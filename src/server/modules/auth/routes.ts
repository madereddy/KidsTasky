import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { rateLimit } from 'express-rate-limit';
import { authService } from './service.js';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { logSecurityEvent } from '../../lib/securityLog.js';

import { getLockoutState, recordFailedAttempt, resetLockout } from '../../lib/lockout.js';

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
const passwordChangeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many password change attempts. Please try again later.' },
});

function getClientIp(req: Request): string {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return (forwarded || req.ip || '').replace(/^::ffff:/, '') || 'unknown';
}

function getAttemptKey(kind: string, identifier: string, ip: string): string {
  return `${kind}:${identifier.toLowerCase()}:${ip}`;
}

function getRetryAfterMs(key: string): number {
  const state = getLockoutState(key);
  return state.remainingMs;
}

function recordAuthFailure(key: string): number {
  const state = recordFailedAttempt(key);
  return state.remainingMs;
}

function clearAuthFailure(key: string) {
  resetLockout(key);
}

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

authRouter.post('/auth/change-password', authenticateUser, requireRole('parent'), passwordChangeLimiter, [
  body('currentPassword').isString().notEmpty(),
  body('newPassword').isString().isLength({ min: 8 }),
  validate
], async (req: Request, res: Response) => {
  const user = (req as any).user as { uid: string };
  const ip = getClientIp(req);
  const key = getAttemptKey('password-change', user.uid, ip);
  const retryAfterMs = getRetryAfterMs(key);
  if (retryAfterMs > 0) {
    logSecurityEvent('auth.password_change.blocked', { uid: user.uid, ip, retryAfterMs });
    return res.status(429).json({ error: 'Too many failed password change attempts. Please try again shortly.' });
  }

  const success = await authService.changePassword(user.uid, req.body.currentPassword, req.body.newPassword);
  if (!success) {
    const backoffMs = recordAuthFailure(key);
    logSecurityEvent('auth.password_change.failed', { uid: user.uid, ip, backoffMs });
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  clearAuthFailure(key);
  logSecurityEvent('auth.password_change.success', { uid: user.uid, ip }, 'info');
  res.json({ success: true });
});

authRouter.post('/auth/refresh', authenticateUser, authLimiter, (req: Request, res: Response) => {
  const user = (req as any).user as { uid: string; role: string; parentId: string };
  const result = authService.refresh(user.uid, user.role, user.parentId);
  logSecurityEvent('auth.token_refresh', { uid: user.uid }, 'info');
  res.json(result);
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
