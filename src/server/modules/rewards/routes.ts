import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { rewardService } from './service.js';
import { authenticateUser, getParentId } from '../../middleware/auth.js';
import { db } from '../../db.js';

export const rewardsRouter = Router();

const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

rewardsRouter.get("/parents/:parentId/rewards", authenticateUser, [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const userParentId = getParentId(req);
  if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
  const rewards = rewardService.getRewards(req.params.parentId as string);
  res.json(rewards);
});

rewardsRouter.post("/rewards", authenticateUser, [
  body('title').isString().notEmpty(),
  body('description').isString().optional(),
  body('xpCost').isInt({min: 0}),
  validate
], (req: Request, res: Response) => {
  const parentId = getParentId(req);
  const { title, description, xpCost, starCost, allowanceCents } = req.body;
  const id = rewardService.createReward(parentId, title, description || '', xpCost, starCost, allowanceCents);
  res.json({ id });
});

rewardsRouter.delete("/rewards/:id", authenticateUser, [
  param('id').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const reward = rewardService.getRewardById(req.params.id as string);
  if (!reward) return res.status(404).json({ error: 'Not found' });
  const userParentId = getParentId(req);
  if (reward.parentId !== userParentId) return res.status(403).json({ error: 'Forbidden' });
  rewardService.deleteReward(req.params.id as string);
  res.json({ success: true });
});

rewardsRouter.get("/kids/:kidId/claimedRewards", authenticateUser, [
  param('kidId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const caller = (req as any).user;
  const kidId = req.params.kidId as string;
  const user = (db.prepare("SELECT parentId FROM users WHERE uid = ?").get(kidId)) as { parentId: string } | undefined;
  if (!user) return res.status(404).json({ error: 'Not found' });

  const userParentId = getParentId(req);
  if (user.parentId !== userParentId) return res.status(403).json({ error: 'Forbidden' });

  const claimed = rewardService.getClaimedRewards(kidId);
  res.json(claimed.map((c: any) => ({ ...c, createdAt: { seconds: c.createdAt / 1000 } })));
});

rewardsRouter.post("/claimedRewards", authenticateUser, [
  body('kidId').isString().notEmpty(),
  body('rewardId').isString().notEmpty(),
  body('xpCost').isInt({min: 0}),
  validate
], (req: Request, res: Response) => {
  const { kidId, rewardId, xpCost } = req.body;
  const userParentId = getParentId(req);
  // Verify kid belongs to this family
  const reward = rewardService.getRewardById(rewardId);
  if (reward && reward.parentId !== userParentId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const id = rewardService.claimReward(kidId, rewardId, xpCost);
    res.json({ id });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

rewardsRouter.get("/parents/:parentId/allowances", authenticateUser, [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const userParentId = getParentId(req);
  if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
  const entries = rewardService.getPendingAllowances(req.params.parentId as string);
  res.json(entries);
});

rewardsRouter.put("/allowances/:id/pay", authenticateUser, [
  param('id').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  rewardService.markAllowancePaid(req.params.id as string);
  res.json({ success: true });
});
