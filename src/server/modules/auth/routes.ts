import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authService } from './service.js';

export const authRouter = Router();

const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

authRouter.post('/auth/login', [
  body('name').isString().trim().notEmpty(),
  validate
], (req: Request, res: Response) => {
  const { name } = req.body;
  let user = authService.login(name);
  if (user) {
    user.badges = JSON.parse(user.badges || "[]");
    return res.json({ user });
  }
  const mockUid = "user_" + Date.now().toString(36) + Math.random().toString(36).substr(2);
  res.json({ user: { uid: mockUid, name, role: null, email: name.toLowerCase() + "@example.com" } });
});

authRouter.get('/auth/me', (req: Request, res: Response) => {
  const uid = req.headers['authorization'];
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  const user = authService.getMe(uid as string);
  if (user) {
    user.badges = JSON.parse(user.badges || "[]");
    return res.json({ user });
  }
  res.status(401).json({ error: "User not found" });
});
