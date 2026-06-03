import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { taskServiceServer } from './service.js';
import { userService } from '../users/service.js';
import { authenticateUser, assertParentScope, enforceEditUnlocked, getParentId, requireRole } from '../../middleware/auth.js';

export const tasksRouter = Router();

const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
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
    res.json({ id });
  } catch (error: any) {
    console.error('[tasks:create]', error);
    res.status(500).json({ error: error.message });
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
    res.json(tasks.map((t: any) => {
      let parsedPrereqs = [];
      let completionQuestions: string[] = [];
      try { parsedPrereqs = JSON.parse(t.prerequisiteTaskIds || "[]"); } catch (e) {}
      try { completionQuestions = JSON.parse(t.completionQuestions || "[]"); } catch (e) {}
      return {
        ...t,
        createdAt: { seconds: t.createdAt / 1000 },
        prerequisiteTaskIds: parsedPrereqs,
        completionQuestions
      };
    }));
  } catch (error: any) {
    console.error('[tasks:get_kids_tasks]', error);
    res.status(500).json({ error: error.message });
  }
});

tasksRouter.get("/parents/:parentId/tasks", authenticateUser, assertParentScope, [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  try {
    const tasks = taskServiceServer.getParentsTasks(req.params.parentId as string);
    res.json(tasks.map((t: any) => {
      let parsedPrereqs = [];
      let completionQuestions: string[] = [];
      try { parsedPrereqs = JSON.parse(t.prerequisiteTaskIds || "[]"); } catch (e) {}
      try { completionQuestions = JSON.parse(t.completionQuestions || "[]"); } catch (e) {}
      return {
        ...t,
        createdAt: { seconds: t.createdAt / 1000 },
        prerequisiteTaskIds: parsedPrereqs,
        completionQuestions
      };
    }));
  } catch (error: any) {
    console.error('[tasks:get_parents_tasks]', error);
    res.status(500).json({ error: error.message });
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
    res.json({ success: true });
  } catch (error: any) {
    console.error('[tasks:archive]', error);
    res.status(500).json({ error: error.message });
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
    res.json({ success: true });
  } catch (error: any) {
    console.error('[tasks:update]', error);
    res.status(500).json({ error: error.message });
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
    res.json({ id: result.id, approvalStatus: result.approvalStatus, created: result.created });
  } catch (error: any) {
    console.error('[tasks:complete]', error);
    res.status(500).json({ error: error.message });
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
    res.json({ success: true });
  } catch (error: any) {
    console.error('[tasks:delete_completion]', error);
    res.status(500).json({ error: error.message });
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
    res.json(result);
  } catch (error: any) {
    console.error('[tasks:skip]', error);
    res.status(500).json({ error: error.message });
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
      res.status(400).json({ error: "Missing date query params" });
      return;
    }
    res.json(completions.map((c: any) => {
      let proofAnswers: Array<{ question: string; answer: string }> = [];
      try { proofAnswers = JSON.parse(c.proofAnswers || '[]'); } catch {}
      return { ...c, proofAnswers, completedAt: { seconds: c.completedAt / 1000 } };
    }));
  } catch (error: any) {
    console.error('[tasks:get_completions]', error);
    res.status(500).json({ error: error.message });
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
    res.json(history.map((c: any) => {
      let proofAnswers: Array<{ question: string; answer: string }> = [];
      try { proofAnswers = JSON.parse(c.proofAnswers || '[]'); } catch {}
      return { ...c, proofAnswers, completedAt: { seconds: c.completedAt / 1000 } };
    }));
  } catch (error: any) {
    console.error('[tasks:get_history]', error);
    res.status(500).json({ error: error.message });
  }
});

tasksRouter.get("/parents/:parentId/pending-completions", authenticateUser, assertParentScope, [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  try {
    const pending = taskServiceServer.getPendingCompletionsByParent(req.params.parentId as string);
    res.json(pending.map((c: any) => ({ ...c, completedAt: { seconds: c.completedAt / 1000 } })));
  } catch (error: any) {
    console.error('[tasks:get_pending]', error);
    res.status(500).json({ error: error.message });
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
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
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
    res.json({ success: true });
  } catch (error: any) {
    console.error('[tasks:reject]', error);
    res.status(500).json({ error: error.message });
  }
});
