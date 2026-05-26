import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { taskServiceServer } from './service.js';
import { authenticateUser, getParentId } from '../../middleware/auth.js';

export const tasksRouter = Router();

const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

tasksRouter.post("/tasks", authenticateUser, [
  body('title').isString().notEmpty(),
  body('assignedKidId').isString().notEmpty(),
  body('frequency').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const parentId = getParentId(req);
  const id = taskServiceServer.createTask({ ...req.body, parentId });
  res.json({ id });
});

tasksRouter.get("/kids/:kidId/tasks", [
  param('kidId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const tasks = taskServiceServer.getKidsTasks(req.params.kidId as string);
  res.json(tasks.map((t: any) => {
    let parsedPrereqs = [];
    try { parsedPrereqs = JSON.parse(t.prerequisiteTaskIds || "[]"); } catch (e) {}
    return { ...t, createdAt: { seconds: t.createdAt / 1000 }, prerequisiteTaskIds: parsedPrereqs };
  }));
});

tasksRouter.get("/parents/:parentId/tasks", [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const tasks = taskServiceServer.getParentsTasks(req.params.parentId as string);
  res.json(tasks.map((t: any) => {
    let parsedPrereqs = [];
    try { parsedPrereqs = JSON.parse(t.prerequisiteTaskIds || "[]"); } catch (e) {}
    return { ...t, createdAt: { seconds: t.createdAt / 1000 }, prerequisiteTaskIds: parsedPrereqs };
  }));
});

tasksRouter.put("/tasks/:taskId/archive", authenticateUser, [
  param('taskId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const task = taskServiceServer.getTaskById(req.params.taskId as string);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const userParentId = getParentId(req);
  if (task.parentId !== userParentId) return res.status(403).json({ error: 'Forbidden' });
  taskServiceServer.archiveTask(req.params.taskId as string);
  res.json({ success: true });
});

// Completions
tasksRouter.post("/completions", authenticateUser, [
  body('taskId').isString().notEmpty(),
  body('kidId').isString().notEmpty(),
  body('dateString').isString().notEmpty(),
  body('count').isInt().optional(),
  validate
], (req: Request, res: Response) => {
  const task = taskServiceServer.getTaskById(req.body.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const userParentId = getParentId(req);
  if (task.parentId !== userParentId) return res.status(403).json({ error: 'Forbidden' });
  const result = taskServiceServer.createCompletion(req.body);
  res.json({ id: result.id, approvalStatus: result.approvalStatus });
});

tasksRouter.delete("/completions/:completionId", authenticateUser, [
  param('completionId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const completion = taskServiceServer.getCompletionById(req.params.completionId as string);
  if (!completion) return res.status(404).json({ error: 'Completion not found' });
  const task = taskServiceServer.getTaskById(completion.taskId);
  const userParentId = getParentId(req);
  if (task && task.parentId !== userParentId) return res.status(403).json({ error: 'Forbidden' });
  taskServiceServer.deleteCompletion(req.params.completionId as string);
  res.json({ success: true });
});

tasksRouter.get("/kids/:kidId/completions", [
  param('kidId').isString().notEmpty(),
  query('dateString').isString().optional(),
  query('startDate').isString().optional(),
  query('endDate').isString().optional(),
  validate
], (req: Request, res: Response) => {
  const kidId = req.params.kidId as string;
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
  res.json(completions.map((c: any) => ({ ...c, completedAt: { seconds: c.completedAt / 1000 } })));
});

tasksRouter.get("/kids/:kidId/history", [
  param('kidId').isString().notEmpty(),
  query('limit').isInt().optional(),
  validate
], (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const history = taskServiceServer.getCompletionHistory(req.params.kidId as string, limit);
  res.json(history.map((c: any) => ({ ...c, completedAt: { seconds: c.completedAt / 1000 } })));
});

tasksRouter.get("/parents/:parentId/pending-completions", authenticateUser, [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const userParentId = getParentId(req);
  if (userParentId !== req.params.parentId as string) return res.status(403).json({ error: 'Forbidden' });
  const pending = taskServiceServer.getPendingCompletionsByParent(req.params.parentId as string);
  res.json(pending.map((c: any) => ({ ...c, completedAt: { seconds: c.completedAt / 1000 } })));
});

tasksRouter.patch("/completions/:completionId/approve", authenticateUser, [
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

tasksRouter.patch("/completions/:completionId/reject", authenticateUser, [
  param('completionId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const completion = taskServiceServer.getCompletionById(req.params.completionId as string);
  if (!completion) return res.status(404).json({ error: 'Completion not found' });
  const task = taskServiceServer.getTaskById(completion.taskId);
  const userParentId = getParentId(req);
  if (task && task.parentId !== userParentId) return res.status(403).json({ error: 'Forbidden' });
  taskServiceServer.rejectCompletion(req.params.completionId as string);
  res.json({ success: true });
});
