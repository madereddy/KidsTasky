import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { categoryService } from './service.js';
import { authenticateUser, assertParentScope, getParentId, requireRole, enforceEditUnlocked } from '../../middleware/auth.js';

export const categoriesRouter = Router();

const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  return next();
};

categoriesRouter.post("/categories", authenticateUser, requireRole('parent'), enforceEditUnlocked, [
  body('name').isString().notEmpty(),
  body('icon').isString().optional(),
  body('color').isString().optional(),
  body('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const userParentId = getParentId(req);
  if (userParentId !== req.body.parentId) return res.status(403).json({ error: 'Forbidden' });
  const id = categoryService.createCategory(req.body);
  return res.json({ id });
});

categoriesRouter.put("/categories/:id", authenticateUser, requireRole('parent'), enforceEditUnlocked, [
  param('id').isString().notEmpty(),
  body('name').isString().notEmpty(),
  body('icon').isString().optional(),
  body('color').isString().optional(),
  body('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const userParentId = getParentId(req);
  if (userParentId !== req.body.parentId) return res.status(403).json({ error: 'Forbidden' });
  categoryService.updateCategory(req.params.id as string, req.body);
  return res.json({ success: true });
});

categoriesRouter.delete("/categories/:id", authenticateUser, requireRole('parent'), enforceEditUnlocked, [
  param('id').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const cat = categoryService.getCategoryById(req.params.id as string);
  if (!cat) return res.status(404).json({ error: 'Not found' });
  const userParentId = getParentId(req);
  if (cat.parentId !== userParentId) return res.status(403).json({ error: 'Forbidden' });
  
  categoryService.deleteCategory(req.params.id as string);
  return res.json({ success: true });
});

categoriesRouter.get("/parents/:parentId/categories", authenticateUser, assertParentScope, [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const cats = categoryService.getCategories(req.params.parentId as string);
  return res.json(cats);
});
