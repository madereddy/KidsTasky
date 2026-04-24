import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { categoryService } from './service.js';

export const categoriesRouter = Router();

const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

categoriesRouter.post("/categories", [
  body('name').isString().notEmpty(),
  body('icon').isString().optional(),
  body('color').isString().optional(),
  body('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const id = categoryService.createCategory(req.body);
  res.json({ id });
});

categoriesRouter.put("/categories/:id", [
  param('id').isString().notEmpty(),
  body('name').isString().notEmpty(),
  body('icon').isString().optional(),
  body('color').isString().optional(),
  body('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  categoryService.updateCategory(req.params.id as string, req.body);
  res.json({ success: true });
});

categoriesRouter.delete("/categories/:id", [
  param('id').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  categoryService.deleteCategory(req.params.id as string);
  res.json({ success: true });
});

categoriesRouter.get("/parents/:parentId/categories", [
  param('parentId').isString().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const cats = categoryService.getCategories(req.params.parentId as string);
  res.json(cats);
});
