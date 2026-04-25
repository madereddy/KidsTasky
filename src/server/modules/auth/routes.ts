import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authService } from './service.js';
import { authenticateUser } from '../../middleware/auth.js';

export const authRouter = Router();

const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

authRouter.post('/auth/register', [
  body('email').isEmail(),
  body('password').isString().isLength({ min: 4 }),
  body('name').isString().notEmpty(),
  validate
], async (req: Request, res: Response) => {
  try {
    const result = await authService.register(req.body.email, req.body.password, req.body.name);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

authRouter.post('/auth/login', [
  body('email').isEmail(),
  body('password').isString(),
  validate
], async (req: Request, res: Response) => {
  const result = await authService.login(req.body.email, req.body.password);
  if (!result) return res.status(401).json({ error: "Invalid credentials" });
  result.user.badges = JSON.parse(result.user.badges || "[]");
  res.json(result);
});

authRouter.get('/auth/me', authenticateUser, (req: Request, res: Response) => {
  const uid = (req as any).user.uid;
  const user = authService.getMe(uid);
  if (user) {
    user.badges = JSON.parse(user.badges || "[]");
    return res.json({ user });
  }
  res.status(401).json({ error: "User not found" });
});
