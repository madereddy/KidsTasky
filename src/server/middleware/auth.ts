import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config.js';

export function authenticateUser(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
  
  const token = authHeader.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, getJwtSecret()) as { uid: string; role: string; parentId: string };
    (req as any).user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
}
