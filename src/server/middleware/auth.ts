import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config.js';
import { db } from '../db.js';

export function authenticateUser(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as { uid: string; role: string; parentId: string; iat?: number };
    
    // Check token revocation — payload.iat is epoch seconds, revokedAt is epoch ms
    const row = db.prepare("SELECT revokedAt FROM users WHERE uid = ?").get(payload.uid) as { revokedAt: number | null } | undefined;
    if (row?.revokedAt && payload.iat && payload.iat * 1000 < row.revokedAt) {
      return res.status(401).json({ error: "Token revoked" });
    }

    (req as any).user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
}

export const requireAuth = authenticateUser;

export function getParentId(req: Request): string {
  const user = (req as any).user;
  return user.parentId || user.uid;
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as { role?: string } | undefined;
    if (!user || user.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

export function enforceEditUnlocked(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as { role?: string } | undefined;
  if (user?.role === 'kid') {
    return next();
  }
  const parentId = getParentId(req);
  const row = db.prepare('SELECT isLocked FROM family_settings WHERE parentId = ?').get(parentId) as { isLocked?: number } | undefined;
  if (row?.isLocked) return res.status(423).json({ error: 'Display is locked for edits' });
  next();
}
