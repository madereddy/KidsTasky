import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { taskServiceServer } from './service.js';
import { mapTaskRow, mapCompletionRow } from './mappers.js';
import { userService } from '../users/service.js';
import { authenticateUser, assertParentScope, enforceEditUnlocked, getParentId, requireRole } from '../../middleware/auth.js';
import { logger } from '../../lib/logger.js';
import { socketWrapper } from '../../socket.js';
import type { MissionCompletedPayload, LeaderboardEntry, PowerMission } from '../../../types.js';
import { getWeeklyXp } from './streakService.js';
import { toErrorMessage } from '../../lib/toErrorMessage.js';

export const tasksRouter = Router();

const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  return next();
};

tasksRouter.post("/tasks", authenticateUser, requireRole('parent'), enforceEditUnlocked, [
  body('title').isString().notEmpty(),
  body('assignedKidId').isString().notEmpty(),
  body('frequency').isString().notEmpty(),
  body('requiresApproval').optional().isBoolean(),
  body('completionQuestions').optional().isArray(),
  body('completionQuestionsKidId').optional({ nullable: true }).isString(),
  validate
], (req: Request, res: Response) => {
  try {
    const parentId = getParentId(req);
    const id = taskServiceServer.createTask({ ...req.body, parentId });
    return res.json({ id });
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error), body: req.body, params: req.params }, 'tasks_route_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});

tasksRouter.get("/kids/:kidId/tasks", authenticateUser, [
  param('kidId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  try {
    const caller = (req as any).user;
    const targetKidId = req.params.kidId as string;
    const kidParentId = userService.getUserParentId(targetKidId);
    if (!kidParentId) return res.status(404).json({ error: 'Not found' });

    const userParentId = getParentId(req);
    if (kidParentId !== userParentId) return res.status(403).json({ error: 'Forbidden' });

    const tasks = taskServiceServer.getKidsTasks(targetKidId);
    return res.json(tasks.map(mapTaskRow));
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error), body: req.body, params: req.params }, 'tasks_route_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});

tasksRouter.get("/parents/:parentId/tasks", authenticateUser, assertParentScope, [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  try {
    const tasks = taskServiceServer.getParentsTasks(req.params.parentId as string);
    return res.json(tasks.map(mapTaskRow));
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error), body: req.body, params: req.params }, 'tasks_route_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});

tasksRouter.put("/tasks/:taskId/archive", authenticateUser, enforceEditUnlocked, [
  param('taskId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  try {
    const task = taskServiceServer.getTaskById(req.params.taskId as string);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const userParentId = getParentId(req);
    if (task.parentId !== userParentId) return res.status(403).json({ error: 'Forbidden' });
    taskServiceServer.archiveTask(req.params.taskId as string);
    return res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error), body: req.body, params: req.params }, 'tasks_route_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});

tasksRouter.patch("/tasks/:taskId", authenticateUser, enforceEditUnlocked, [
  param('taskId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { role: string };
    if (user.role !== 'parent') return res.status(403).json({ error: 'Forbidden' });
    const task = taskServiceServer.getTaskById(req.params.taskId as string);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const userParentId = getParentId(req);
    if (task.parentId !== userParentId) return res.status(403).json({ error: 'Forbidden' });
    const ok = taskServiceServer.updateTask(req.params.taskId as string, userParentId, req.body || {});
    if (!ok) return res.status(400).json({ error: 'No valid task fields to update' });
    return res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error), body: req.body, params: req.params }, 'tasks_update_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});

// Completions
tasksRouter.post("/completions", authenticateUser, enforceEditUnlocked, [
  body('taskId').isString().notEmpty(),
  body('kidId').isString().notEmpty(),
  body('dateString').isString().notEmpty(),
  body('count').isInt().optional(),
  body('proofAnswers').optional().isArray(),
  validate
], (req: Request, res: Response) => {
  try {
    const task = taskServiceServer.getTaskById(req.body.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const userParentId = getParentId(req);
    if (task.parentId !== userParentId) return res.status(403).json({ error: 'Forbidden' });
    const caller = (req as any).user as { uid: string; role: string };
    if (caller.role === 'kid' && req.body.kidId !== caller.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    // Task must be assigned to this kid (or up-for-grabs) — stops a sibling
    // earning XP/stars by completing another kid's assigned task.
    if (task.assignedKidId !== 'all' && task.assignedKidId !== req.body.kidId) {
      return res.status(403).json({ error: 'Task not assigned to this kid' });
    }
    const result = taskServiceServer.createCompletion({
      ...req.body,
      proofAnswers: Array.isArray(req.body?.proofAnswers) ? req.body.proofAnswers : undefined,
    });
    if (result.created && result.streakDay > 0) {
      const payload: MissionCompletedPayload = {
        userId: req.body.kidId,
        xp: result.xpEarned,
        streakDay: result.streakDay,
        badgesEarned: result.badgesEarned ?? [],
      };
      socketWrapper.emitToFamily(task.parentId, 'mission-completed', payload);
    }
    return res.json({ id: result.id, approvalStatus: result.approvalStatus, created: result.created });
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error), body: req.body, params: req.params }, 'tasks_route_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});

tasksRouter.delete("/completions/:completionId", authenticateUser, enforceEditUnlocked, [
  param('completionId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  try {
    const completion = taskServiceServer.getCompletionById(req.params.completionId as string);
    if (!completion) return res.status(404).json({ error: 'Completion not found' });
    const task = taskServiceServer.getTaskById(completion.taskId);
    const userParentId = getParentId(req);
    if (task && task.parentId !== userParentId) return res.status(403).json({ error: 'Forbidden' });
    const caller = (req as any).user as { uid: string; role: string };
    if (caller.role === 'kid' && completion.kidId !== caller.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    taskServiceServer.deleteCompletion(req.params.completionId as string);
    return res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error), params: req.params }, 'tasks_delete_completion_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});

tasksRouter.post("/tasks/:taskId/skip", authenticateUser, enforceEditUnlocked, [
  param('taskId').isString().notEmpty(),
  body('kidId').isString().notEmpty(),
  body('dateString').isString().notEmpty(),
  body('count').isInt().optional(),
  validate
], (req: Request, res: Response) => {
  try {
    const task = taskServiceServer.getTaskById(req.params.taskId as string);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const userParentId = getParentId(req);
    if (task.parentId !== userParentId) return res.status(403).json({ error: 'Forbidden' });
    if (task.assignedKidId !== 'all' && task.assignedKidId !== req.body.kidId) {
      return res.status(403).json({ error: 'Task not assigned to this kid' });
    }
    const result = taskServiceServer.skipTask({
      taskId: req.params.taskId as string,
      kidId: req.body.kidId as string,
      dateString: req.body.dateString as string,
      count: req.body.count,
    });
    return res.json(result);
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error), body: req.body, params: req.params }, 'tasks_skip_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});

tasksRouter.get("/kids/:kidId/completions", authenticateUser, [
  param('kidId').isString().notEmpty(),
  query('dateString').isString().optional(),
  query('startDate').isString().optional(),
  query('endDate').isString().optional(),
  validate
], (req: Request, res: Response) => {
  try {
    const caller = (req as any).user;
    const kidId = req.params.kidId as string;
    const kidParentId = userService.getUserParentId(kidId);
    if (!kidParentId) return res.status(404).json({ error: 'Not found' });

    const userParentId = getParentId(req);
    if (kidParentId !== userParentId) return res.status(403).json({ error: 'Forbidden' });

    const { dateString, startDate, endDate } = req.query;
    let completions;
    if (startDate && endDate) {
      completions = taskServiceServer.getCompletionsByDateRange(kidId, startDate as string, endDate as string);
    } else if (dateString) {
      completions = taskServiceServer.getCompletionsByDate(kidId, dateString as string);
    } else {
      return res.status(400).json({ error: "Missing date query params" });
    }
    return res.json(completions.map(mapCompletionRow));
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error), body: req.body, params: req.params }, 'tasks_route_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});

tasksRouter.get("/kids/:kidId/history", authenticateUser, [
  param('kidId').isString().notEmpty(),
  query('limit').isInt().optional(),
  validate
], (req: Request, res: Response) => {
  try {
    const caller = (req as any).user;
    const kidId = req.params.kidId as string;
    const kidParentId = userService.getUserParentId(kidId);
    if (!kidParentId) return res.status(404).json({ error: 'Not found' });

    const userParentId = getParentId(req);
    if (kidParentId !== userParentId) return res.status(403).json({ error: 'Forbidden' });

    const limit = parseInt(req.query.limit as string) || 50;
    const history = taskServiceServer.getCompletionHistory(kidId, limit);
    return res.json(history.map(mapCompletionRow));
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error), body: req.body, params: req.params }, 'tasks_route_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});

tasksRouter.get("/parents/:parentId/pending-completions", authenticateUser, assertParentScope, [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  try {
    const pending = taskServiceServer.getPendingCompletionsByParent(req.params.parentId as string);
    return res.json(pending.map(mapCompletionRow));
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error), body: req.body, params: req.params }, 'tasks_route_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});

tasksRouter.patch("/completions/:completionId/approve", authenticateUser, requireRole('parent'), enforceEditUnlocked, [
  param('completionId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  try {
    const completion = taskServiceServer.getCompletionById(req.params.completionId as string);
    if (!completion) return res.status(404).json({ error: 'Completion not found' });
    const task = taskServiceServer.getTaskById(completion.taskId);
    const userParentId = getParentId(req);
    if (task && task.parentId !== userParentId) return res.status(403).json({ error: 'Forbidden' });
    taskServiceServer.approveCompletion(req.params.completionId as string);
    return res.json({ success: true });
  } catch (err: unknown) {
    logger.error({ error: toErrorMessage(err), params: req.params }, 'tasks_approve_completion_error');
    return res.status(400).json({ error: toErrorMessage(err) });
  }
});

tasksRouter.patch("/completions/:completionId/reject", authenticateUser, requireRole('parent'), enforceEditUnlocked, [
  param('completionId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  try {
    const completion = taskServiceServer.getCompletionById(req.params.completionId as string);
    if (!completion) return res.status(404).json({ error: 'Completion not found' });
    const task = taskServiceServer.getTaskById(completion.taskId);
    const userParentId = getParentId(req);
    if (task && task.parentId !== userParentId) return res.status(403).json({ error: 'Forbidden' });
    taskServiceServer.rejectCompletion(req.params.completionId as string);
    return res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error), params: req.params }, 'tasks_reject_completion_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});

// GET /parents/:parentId/leaderboard — weekly XP ranked list with delta from last week
tasksRouter.get('/parents/:parentId/leaderboard', authenticateUser, assertParentScope, (req: Request, res: Response) => {
  try {
    const parentId = req.params.parentId as string;
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysSinceMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(weekStart.getDate() - 7);

    const members = taskServiceServer.getFamilyMembers(parentId);

    const currentXp = getWeeklyXp(parentId, weekStart.toISOString(), weekEnd.toISOString());
    const lastXp = getWeeklyXp(parentId, lastWeekStart.toISOString(), weekStart.toISOString());

    const xpMap = Object.fromEntries(currentXp.map(r => [r.userId, r.totalXp]));
    const lastMap = Object.fromEntries(lastXp.map(r => [r.userId, r.totalXp]));

    const entries: LeaderboardEntry[] = members
      .map(m => ({
        userId: m.uid,
        name: m.name,
        weeklyXp: xpMap[m.uid] ?? 0,
        deltaFromLastWeek: (xpMap[m.uid] ?? 0) - (lastMap[m.uid] ?? 0),
        role: m.role as 'parent' | 'kid' | 'coparent',
      }))
      .sort((a, b) => b.weeklyXp - a.weeklyXp);

    return res.json(entries);
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error) }, 'leaderboard_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});

// GET /parents/:parentId/power-mission — today's Power Mission (null if none)
tasksRouter.get('/parents/:parentId/power-mission', authenticateUser, assertParentScope, (req: Request, res: Response) => {
  try {
    const parentId = req.params.parentId as string;
    const payload = taskServiceServer.getPowerMission(parentId);
    return res.json(payload);
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error) }, 'power_mission_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});
