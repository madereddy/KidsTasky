import { Router } from 'express';
import { authenticateUser, enforceEditUnlocked, getParentId } from '../../middleware/auth.js';
import { homeworkService } from './service.js';

export const homeworkRouter = Router();

homeworkRouter.get('/parents/:parentId/homework', authenticateUser, (req, res) => {
  try {
    const parentId = getParentId(req);
    if (parentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
    const rows = homeworkService.getByParent(req.params.parentId).map((row: any) => {
      let completionQuestions: string[] = [];
      try { completionQuestions = JSON.parse(row.completionQuestions || '[]'); } catch {}
      return { ...row, completionQuestions };
    });
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

homeworkRouter.post('/homework', authenticateUser, enforceEditUnlocked, (req, res) => {
  try {
    const user = (req as any).user as { role: string };
    if (user.role !== 'parent') return res.status(403).json({ error: 'Forbidden' });
    const parentId = getParentId(req);
    const id = homeworkService.create({
      parentId,
      title: req.body.title,
      subject: req.body.subject,
      notes: req.body.notes,
      dueDate: req.body.dueDate,
      assignedToId: req.body.assignedToId,
      status: req.body.status || 'pending',
      color: req.body.color || '#6366f1',
      completionQuestions: Array.isArray(req.body.completionQuestions) ? req.body.completionQuestions : undefined,
      completionQuestionsKidId: req.body.completionQuestionsKidId || null,
      completionResponse: null,
    });
    const created = homeworkService.getById(id);
    res.json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

homeworkRouter.patch('/homework/:id', authenticateUser, enforceEditUnlocked, (req, res) => {
  try {
    const user = (req as any).user as { uid: string; role: string };
    const parentId = getParentId(req);
    const existing = homeworkService.getById(req.params.id);
    if (!existing || existing.parentId !== parentId) return res.status(404).json({ error: 'Homework not found' });

    let patch = req.body || {};
    if (user.role !== 'parent') {
      const canEdit = !existing.assignedToId || existing.assignedToId === user.uid;
      if (!canEdit) return res.status(403).json({ error: 'Forbidden' });
      const status = patch.status;
      if (!['pending', 'done'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
      patch = {
        status,
        completionResponse: status === 'done' ? String(req.body?.completionResponse || '').trim() || null : null,
      };
    } else if (patch.status !== undefined && !['pending', 'done'].includes(patch.status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const ok = homeworkService.update(req.params.id, parentId, patch);
    if (!ok) return res.status(404).json({ error: 'Homework not found' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

homeworkRouter.delete('/homework/:id', authenticateUser, enforceEditUnlocked, (req, res) => {
  try {
    const user = (req as any).user as { role: string };
    if (user.role !== 'parent') return res.status(403).json({ error: 'Forbidden' });
    const parentId = getParentId(req);
    const ok = homeworkService.remove(req.params.id, parentId);
    if (!ok) return res.status(404).json({ error: 'Homework not found' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
