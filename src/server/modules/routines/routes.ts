import { Router } from 'express';
import { authenticateUser, assertParentScope, enforceEditUnlocked, getParentId } from '../../middleware/auth.js';
import { routinesService } from './service.js';

export const routinesRouter = Router();

routinesRouter.get('/parents/:parentId/routines', authenticateUser, assertParentScope, (req, res) => {
  const templates = routinesService.getTemplates(req.params.parentId as string);
  res.json(templates);
});

routinesRouter.post('/parents/:parentId/routines', authenticateUser, assertParentScope, enforceEditUnlocked, (req, res) => {
  const { title, description, defaultStartTime, defaultDuration, assignedToId, color } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const id = routinesService.createTemplate({
    parentId: req.params.parentId as string,
    title,
    description,
    defaultStartTime,
    defaultDuration: defaultDuration ?? 3600000,
    assignedToId,
    color: color ?? '#6366f1',
  });
  res.json({ id });
});

routinesRouter.delete('/routines/:id', authenticateUser, enforceEditUnlocked, (req, res) => {
  const template = routinesService.getTemplateById(req.params.id as string);
  if (!template) return res.status(404).json({ error: 'Not found' });
  if (template.parentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });
  routinesService.deleteTemplate(req.params.id as string);
  res.json({ success: true });
});

routinesRouter.put('/parents/:parentId/routines/reorder', authenticateUser, assertParentScope, enforceEditUnlocked, (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
  routinesService.reorderTemplates(req.params.parentId as string, ids);
  res.json({ success: true });
});
