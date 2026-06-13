import { Router, Request, Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import { dashboardService } from './service.js';
import { authenticateUser, assertParentScope } from '../../middleware/auth.js';
import { logger } from '../../lib/logger.js';

export const dashboardRouter = Router();

const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  return next();
};

dashboardRouter.get("/parents/:parentId/family-dashboard-data", authenticateUser, assertParentScope, [
  param('parentId').isString().notEmpty(),
  query('dateString').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  try {
    const data = dashboardService.getFamilyDashboardData(req.params.parentId as string, req.query.dateString as string);
    return res.json(data);
  } catch (error: any) {
    logger.error({ parentId: req.params.parentId, error: error.message }, 'dashboard_data_error');
    return res.status(500).json({ error: error.message });
  }
});
