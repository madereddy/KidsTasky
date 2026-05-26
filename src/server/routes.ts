import { Router } from 'express';
import { socketWrapper } from './socket.js';
import { authRouter } from './modules/auth/routes.js';
import { usersRouter } from './modules/users/routes.js';
import { tasksRouter } from './modules/tasks/routes.js';
import { categoriesRouter } from './modules/categories/routes.js';
import { invitesRouter } from './modules/invites/routes.js';
import { notificationsRouter } from './modules/notifications/routes.js';
import { rewardsRouter } from './modules/rewards/routes.js';
import { eventsRouter } from './modules/events/routes.js';
import { weatherRouter } from './modules/weather/routes.js';
import { listsRouter } from './modules/lists/routes.js';
import { mealsRouter } from './modules/meals/routes.js';
import { magicRouter } from './modules/magic/routes.js';
import { photosRouter } from './modules/photos/routes.js';
import { syncRouter } from './modules/sync/routes.js';
import { settingsRouter } from './modules/settings/routes.js';
import { routinesRouter } from './modules/routines/routes.js';
import { flagsRouter } from './modules/flags/routes.js';

const router = Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Generic stale-data broadcaster for all authenticated mutation routes
router.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const originalJson = res.json;
    res.json = function(body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const user = (req as any).user;
        if (user) {
          const parentId = user.role === 'parent' ? user.uid : user.parentId;
          if (parentId) {
            // Safely compute an entity hint from the path (e.g., '/tasks/' -> 'tasks')
            const pathParts = req.path.split('/').filter(Boolean);
            const entityHint = pathParts[0] || 'general';
            socketWrapper.emitStaleData(parentId, entityHint);
          }
        }
      }
      return originalJson.call(this, body);
    };
  }
  next();
});

router.use(authRouter);
router.use(usersRouter);
router.use(tasksRouter);
router.use(categoriesRouter);
router.use(invitesRouter);
router.use(notificationsRouter);
router.use(rewardsRouter);
router.use(eventsRouter);
router.use(weatherRouter);
router.use(listsRouter);
router.use(mealsRouter);
router.use(magicRouter);
router.use(photosRouter);
router.use(syncRouter);
router.use(settingsRouter);
router.use(routinesRouter);
router.use(flagsRouter);

export const apiRouter = router;

