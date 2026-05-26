import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { inviteService } from './service.js';
import { db } from '../../db.js';
import { authenticateUser, getParentId } from '../../middleware/auth.js';

export const invitesRouter = Router();

const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

invitesRouter.post("/invites", authenticateUser, [
  body('parentId').isString().notEmpty(),
  body('parentName').isString().notEmpty(),
  body('type').isIn(['kid', 'coparent']).optional(),
  validate
], (req: Request, res: Response) => {
  const userParentId = getParentId(req);
  if (userParentId !== req.body.parentId) return res.status(403).json({ error: 'Forbidden' });
  
  const type = req.body.type || 'kid';
  const id = inviteService.createInvite(req.body.parentId, req.body.parentName, type);
  res.json({ id });
});

invitesRouter.get("/parents/:parentId/invites/active", authenticateUser, [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const userParentId = getParentId(req);
  if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });

  const invite = inviteService.getActiveInvite(req.params.parentId as string);
  res.json(invite || null);
});

invitesRouter.get("/invites/:code/validate", [
  param('code').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const invite = inviteService.validateInvite(req.params.code as string);
  res.json(invite || null);
});

// Add: get active co-parent invite for a parent
invitesRouter.get("/parents/:parentId/invites/coparent/active", authenticateUser, [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const userParentId = getParentId(req);
  if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });

  const invite = db.prepare("SELECT * FROM invites WHERE parentId = ? AND type = 'coparent' AND status = 'active'")
    .get(req.params.parentId);
  res.json(invite || null);
});
