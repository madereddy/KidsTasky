import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { userService } from './service.js';

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
  body('xp').isInt({min: 0}).optional(),
  body('level').isInt({min: 1}).optional(),
  body('badges').isArray().optional(),
  body('themeId').isString().optional(),
  body('isManaged').isBoolean().optional(),
  body('pin').isString().optional(),
  validate
], async (req: Request, res: Response) => {
  await userService.createUser(req.body);
  res.json({ success: true });
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
