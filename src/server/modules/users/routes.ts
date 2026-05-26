import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { userService } from './service.js';
import { inviteService } from '../invites/service.js';
import { db } from '../../db.js';
import { socketWrapper } from '../../socket.js';
import { authenticateUser, getParentId } from '../../middleware/auth.js';

export const usersRouter = Router();

const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

usersRouter.get("/users/:uid", [
  param('uid').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const user = userService.getUser(req.params.uid as string);
  if (user) {
     user.badges = JSON.parse(user.badges || "[]");
     return res.json(user);
  }
  res.status(404).json({ error: "Not found" });
});

usersRouter.post("/users", [
  body('uid').isString().notEmpty(),
  body('role').isString().optional(),
  body('name').isString().notEmpty(),
  body('email').isEmail().optional(),
  body('parentId').isString().optional(),
  body('password').isString().optional(),
  body('code').isString().optional(), // invite code for co-parent join
  body('xp').isInt({min: 0}).optional(),
  body('level').isInt({min: 1}).optional(),
  body('badges').isArray().optional(),
  body('themeId').isString().optional(),
  body('isManaged').isBoolean().optional(),
  body('pin').isString().optional(),
  validate
], async (req: Request, res: Response) => {
  // Co-parent join path: code present + invite type is 'coparent'
  if (req.body.code) {
    const invite = db.prepare("SELECT * FROM invites WHERE id = ? AND status = 'active'")
      .get(req.body.code) as any;
    if (!invite) return res.status(400).json({ error: 'Invalid or expired invite code' });

    if (invite.type === 'coparent') {
      if (!req.body.password) return res.status(400).json({ error: 'Password required for co-parent join' });
      // Generate uid server-side — never trust client-supplied uid for security-critical join
      const uid = 'user_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      await userService.createCoParent({
        uid,
        name: req.body.name,
        email: req.body.email || '',
        password: req.body.password,
        parentId: invite.parentId,
      });
      inviteService.markInviteUsed(req.body.code);
      return res.json({ success: true, uid });
    }
    // else: kid join — fall through to existing logic with invite.parentId
  }

  // Existing kid/parent create path
  await userService.createUser(req.body);
  res.json({ success: true });
});

// List co-parents for a family
usersRouter.get("/parents/:parentId/coparents", authenticateUser, [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const userParentId = getParentId(req);
  if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
  res.json(userService.getCoParents(req.params.parentId));
});

// Remove co-parent (owner only)
usersRouter.delete("/users/:uid/coparent", authenticateUser, [
  param('uid').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const caller = (req as any).user;
  // Only the family owner (uid === parentId) can remove co-parents
  if (caller.uid !== caller.parentId) return res.status(403).json({ error: 'Only family owner can remove co-parent' });
  try {
    userService.removeCoParent(req.params.uid, caller.uid);
    // Force-disconnect all active sessions for the removed co-parent
    socketWrapper.emitToUser(req.params.uid, 'forceLogout');
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

usersRouter.post("/users/:uid/badge", [
  param('uid').isString().notEmpty(),
  body('badgeId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  userService.addBadge(req.params.uid as string, req.body.badgeId);
  res.json({ success: true });
});

usersRouter.post("/users/:uid/xp", [
  param('uid').isString().notEmpty(),
  body('xpChange').isInt(),
  validate
], (req: Request, res: Response) => {
  userService.addXP(req.params.uid as string, req.body.xpChange);
  res.json({ success: true });
});

usersRouter.post("/users/:uid/theme", [
  param('uid').isString().notEmpty(),
  body('themeId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  userService.updateTheme(req.params.uid as string, req.body.themeId);
  res.json({ success: true });
});

usersRouter.get("/parents/:parentId/kids", [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const kids = userService.getKidsByParent(req.params.parentId as string);
  kids.forEach(k => k.badges = JSON.parse(k.badges || "[]"));
  res.json(kids);
});

usersRouter.put('/users/:uid/color', [
  param('uid').isString().notEmpty(),
  body('color').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const { color } = req.body;
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return res.status(400).json({ error: 'Invalid color' });
  userService.setMemberColor(req.params.uid as string, color);
  res.json({ success: true });
});
