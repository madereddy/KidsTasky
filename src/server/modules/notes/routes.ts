import { Router, Request, Response } from 'express';
import { param, body, validationResult } from 'express-validator';
import { notesService } from './service.js';
import { authenticateUser, assertParentScope, getParentId } from '../../middleware/auth.js';
import { db } from '../../db.js';

export const notesRouter = Router();

const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  return next();
};

notesRouter.get('/family-notes/:parentId', authenticateUser, assertParentScope, [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  return res.json(notesService.getNote(req.params.parentId as string));
});

notesRouter.put('/family-notes/:parentId', authenticateUser, assertParentScope, [
  param('parentId').isString().notEmpty(),
  body('content').isString(),
  validate
], (req: Request, res: Response) => {
  const callerUid = (req as any).user.uid;
  const callerUser = db.prepare('SELECT name FROM users WHERE uid = ?').get(callerUid) as any;
  const updatedByName = callerUser?.name || 'Unknown';
  notesService.upsertNote(req.params.parentId as string, req.body.content ?? '', updatedByName);
  return res.json({ success: true });
});