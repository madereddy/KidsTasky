import { Router, Request, Response } from 'express';
import { param, validationResult } from 'express-validator';
import { notificationService } from './service.js';
import { authenticateUser, assertParentScope, getParentId } from '../../middleware/auth.js';

export const notificationsRouter = Router();

const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  return next();
};

notificationsRouter.get("/parents/:parentId/notifications", authenticateUser, assertParentScope, [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const notifs = notificationService.getNotifications(req.params.parentId as string);
  return res.json(notifs.map((n: any) => ({ ...n, createdAt: { seconds: n.createdAt / 1000 } })));
});

notificationsRouter.put("/notifications/:id/read", authenticateUser, [
  param('id').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const notification = notificationService.getNotificationById(req.params.id as string);
  if (!notification) return res.status(404).json({ error: 'Not found' });
  const userParentId = getParentId(req);
  if (notification.parentId !== userParentId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  notificationService.markRead(req.params.id as string);
  return res.json({ success: true });
});

notificationsRouter.get('/notifications/vapid-public-key', (req: Request, res: Response) => {
  return res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
});

notificationsRouter.post('/notifications/subscribe', authenticateUser, (req: Request, res: Response) => {
  const userId = (req as any).user.uid;
  const parentId = getParentId(req);
  const { endpoint, p256dh, auth } = req.body || {};
  if (!endpoint || !p256dh || !auth) return res.status(400).json({ error: 'Missing subscription fields' });
  const id = 'sub_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  notificationService.subscribePush(id, userId, parentId, endpoint, p256dh, auth);
  return res.json({ success: true });
});

notificationsRouter.delete('/notifications/subscribe', authenticateUser, (req: Request, res: Response) => {
  const userId = (req as any).user.uid as string;
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
  notificationService.unsubscribePush(endpoint, userId);
  return res.json({ success: true });
});
