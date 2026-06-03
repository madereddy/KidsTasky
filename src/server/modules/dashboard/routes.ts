import { Router, Request, Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import { dashboardService } from './service.js';
import { authenticateUser, assertParentScope } from '../../middleware/auth.js';

export const dashboardRouter = Router();

const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

dashboardRouter.get("/parents/:parentId/family-dashboard-data", authenticateUser, assertParentScope, [
  param('parentId').isString().notEmpty(),
  query('dateString').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  try {
    const data = dashboardService.getFamilyDashboardData(req.params.parentId as string, req.query.dateString as string);
    res.json(data);
  } catch (error: any) {
    console.error('[dashboard:get_family_data]', error);
    res.status(500).json({ error: error.message });
  }
});
