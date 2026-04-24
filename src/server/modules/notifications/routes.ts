import { Router, Request, Response } from 'express';
import { param, validationResult } from 'express-validator';
import { notificationService } from './service.js';

export const notificationsRouter = Router();

const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

notificationsRouter.get("/parents/:parentId/notifications", [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const notifs = notificationService.getNotifications(req.params.parentId as string);
  res.json(notifs.map((n: any) => ({ ...n, createdAt: { seconds: n.createdAt / 1000 } })));
});

notificationsRouter.put("/notifications/:id/read", [
  param('id').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  notificationService.markRead(req.params.id as string);
  res.json({ success: true });
});
