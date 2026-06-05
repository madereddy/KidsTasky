import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateUser, getParentId, requireRole } from '../../middleware/auth.js';
import { proofTemplatesService, ProofTemplateKind } from './service.js';

export const proofTemplatesRouter = Router();

const validate = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

const kindValidation = param('kind').isIn(['task', 'homework', 'list', 'shopping', 'routine']);

proofTemplatesRouter.get('/proof-templates/:kind', authenticateUser, [kindValidation, validate], (req: Request, res: Response) => {
  const parentId = getParentId(req);
  const kind = req.params.kind as ProofTemplateKind;
  res.json(proofTemplatesService.list(parentId, kind));
});

proofTemplatesRouter.post(
  '/proof-templates/:kind',
  authenticateUser,
  requireRole('parent'),
  [kindValidation, body('name').isString().notEmpty(), body('questions').isArray({ min: 1 }), body('pinned').optional().isBoolean(), validate],
  (req: Request, res: Response) => {
    const parentId = getParentId(req);
    const kind = String(req.params.kind) as ProofTemplateKind;
    const questions = (req.body.questions || []).map((q: any) => String(q).trim()).filter(Boolean);
    if (questions.length === 0) return res.status(400).json({ error: 'questions required' });
    const template = proofTemplatesService.upsert(parentId, kind, String(req.body.name).trim(), questions, Boolean(req.body.pinned));
    return res.json(template);
  }
);

proofTemplatesRouter.patch(
  '/proof-templates/:kind/:id/pin',
  authenticateUser,
  requireRole('parent'),
  [kindValidation, param('id').isString().notEmpty(), body('pinned').isBoolean(), validate],
  (req: Request, res: Response) => {
    const parentId = getParentId(req);
    const kind = String(req.params.kind) as ProofTemplateKind;
    const ok = proofTemplatesService.setPinned(parentId, kind, req.params.id as string, Boolean(req.body.pinned));
    if (!ok) return res.status(404).json({ error: 'Template not found' });
    return res.json({ success: true });
  }
);

proofTemplatesRouter.delete('/proof-templates/:kind/:id', authenticateUser, requireRole('parent'), [kindValidation, param('id').isString().notEmpty(), validate], (req: Request, res: Response) => {
  const parentId = getParentId(req);
  const kind = String(req.params.kind) as ProofTemplateKind;
  const ok = proofTemplatesService.remove(parentId, kind, req.params.id as string);
  if (!ok) return res.status(404).json({ error: 'Template not found' });
  return res.json({ success: true });
});

proofTemplatesRouter.post('/proof-templates/:kind/import', authenticateUser, requireRole('parent'), [
  kindValidation,
  body('templates').isArray(),
  validate
], (req: Request, res: Response) => {
  const parentId = getParentId(req);
  const kind = req.params.kind as ProofTemplateKind;
  const input = Array.isArray(req.body.templates) ? req.body.templates : [];
  let imported = 0;
  for (const t of input) {
    const name = String(t?.name || '').trim();
    const questions = Array.isArray(t?.questions) ? t.questions.map((q: any) => String(q).trim()).filter(Boolean) : [];
    if (!name || questions.length === 0) continue;
    proofTemplatesService.upsert(parentId, kind, name, questions, Boolean(t?.pinned));
    imported += 1;
  }
  res.json({ success: true, imported });
});
