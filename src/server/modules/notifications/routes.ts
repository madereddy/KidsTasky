import { Router, Request, Response } from 'express';
import { param, validationResult } from 'express-validator';
import { notificationService } from './service.js';
import { authenticateUser, getParentId } from '../../middleware/auth.js';

export const notificationsRouter = Router();

const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

notificationsRouter.get("/parents/:parentId/notifications", authenticateUser, [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const userParentId = getParentId(req);
  if (userParentId !== req.params.parentId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const notifs = notificationService.getNotifications(req.params.parentId as string);
  res.json(notifs.map((n: any) => ({ ...n, createdAt: { seconds: n.createdAt / 1000 } })));
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
  res.json({ success: true });
});
