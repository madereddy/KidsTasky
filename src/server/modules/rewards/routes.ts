import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { rewardService } from './service.js';

export const rewardsRouter = Router();

const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

rewardsRouter.get("/parents/:parentId/rewards", [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const rewards = rewardService.getRewards(req.params.parentId as string);
  res.json(rewards);
});

rewardsRouter.post("/rewards", [
  body('parentId').isString().notEmpty(),
  body('title').isString().notEmpty(),
  body('description').isString().optional(),
  body('xpCost').isInt({min: 0}),
  validate
], (req: Request, res: Response) => {
  const { parentId, title, description, xpCost, starCost, allowanceCents } = req.body;
  const id = rewardService.createReward(parentId, title, description || '', xpCost, starCost, allowanceCents);
  res.json({ id });
});

rewardsRouter.delete("/rewards/:id", [
  param('id').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  rewardService.deleteReward(req.params.id as string);
  res.json({ success: true });
});

rewardsRouter.get("/kids/:kidId/claimedRewards", [
  param('kidId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const claimed = rewardService.getClaimedRewards(req.params.kidId as string);
  res.json(claimed.map((c: any) => ({ ...c, createdAt: { seconds: c.createdAt / 1000 } })));
});

rewardsRouter.post("/claimedRewards", [
  body('kidId').isString().notEmpty(),
  body('rewardId').isString().notEmpty(),
  body('xpCost').isInt({min: 0}),
  validate
], (req: Request, res: Response) => {
  const { kidId, rewardId, xpCost } = req.body;
  try {
    const id = rewardService.claimReward(kidId, rewardId, xpCost);
    res.json({ id });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

rewardsRouter.get("/parents/:parentId/allowances", [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const entries = rewardService.getPendingAllowances(req.params.parentId as string);
  res.json(entries);
});

rewardsRouter.put("/allowances/:id/pay", [
  param('id').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  rewardService.markAllowancePaid(req.params.id as string);
  res.json({ success: true });
});
