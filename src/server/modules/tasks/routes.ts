import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { taskServiceServer } from './service.js';

export const tasksRouter = Router();

const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

tasksRouter.post("/tasks", [
  body('title').isString().notEmpty(),
  body('assignedKidId').isString().notEmpty(),
  body('parentId').isString().notEmpty(),
  body('frequency').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const id = taskServiceServer.createTask(req.body);
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

tasksRouter.put("/tasks/:taskId/archive", [
  param('taskId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  taskServiceServer.archiveTask(req.params.taskId as string);
  res.json({ success: true });
});

// Completions
tasksRouter.post("/completions", [
  body('taskId').isString().notEmpty(),
  body('kidId').isString().notEmpty(),
  body('dateString').isString().notEmpty(),
  body('count').isInt().optional(),
  validate
], (req: Request, res: Response) => {
  const id = taskServiceServer.createCompletion(req.body);
  res.json({ id });
});

tasksRouter.delete("/completions/:completionId", [
  param('completionId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
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
