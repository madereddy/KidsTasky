import { Router } from 'express';
import { authenticateUser, getParentId } from '../../middleware/auth.js';
import { routinesService } from './service.js';

export const routinesRouter = Router();

routinesRouter.get('/parents/:parentId/routines', authenticateUser, (req, res) => {
  const userParentId = getParentId(req);
  if (userParentId !== (req.params.parentId as string)) return res.status(403).json({ error: 'Forbidden' });
  const templates = routinesService.getTemplates(req.params.parentId as string);
  res.json(templates);
});

routinesRouter.post('/parents/:parentId/routines', authenticateUser, (req, res) => {
  const userParentId = getParentId(req);
  if (userParentId !== (req.params.parentId as string)) return res.status(403).json({ error: 'Forbidden' });
  const { title, description, defaultStartTime, defaultDuration, assignedToId, color } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const id = routinesService.createTemplate({
    parentId: userParentId,
    title,
    description,
    defaultStartTime,
    defaultDuration: defaultDuration ?? 3600000,
    assignedToId,
    color: color ?? '#6366f1',
  });
  res.json({ id });
});

routinesRouter.delete('/routines/:id', authenticateUser, (req, res) => {
  const template = routinesService.getTemplateById(req.params.id as string);
  if (!template) return res.status(404).json({ error: 'Not found' });
  const userParentId = getParentId(req);
  if (template.parentId !== userParentId) return res.status(403).json({ error: 'Forbidden' });
  routinesService.deleteTemplate(req.params.id as string);
  res.json({ success: true });
});
