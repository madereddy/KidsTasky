import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { inviteService } from './service.js';

export const invitesRouter = Router();

const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

invitesRouter.post("/invites", [
  body('parentId').isString().notEmpty(),
  body('parentName').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const id = inviteService.createInvite(req.body.parentId, req.body.parentName);
  res.json({ id });
});

invitesRouter.get("/parents/:parentId/invites/active", [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
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
