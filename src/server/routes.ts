import { Router } from 'express';
import { authRouter } from './modules/auth/routes.js';
import { usersRouter } from './modules/users/routes.js';
import { tasksRouter } from './modules/tasks/routes.js';
import { categoriesRouter } from './modules/categories/routes.js';
import { invitesRouter } from './modules/invites/routes.js';
import { notificationsRouter } from './modules/notifications/routes.js';
import { rewardsRouter } from './modules/rewards/routes.js';

const router = Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

router.use(authRouter);
router.use(usersRouter);
router.use(tasksRouter);
router.use(categoriesRouter);
router.use(invitesRouter);
router.use(notificationsRouter);
router.use(rewardsRouter);

export const apiRouter = router;

