import type { RequestHandler } from 'express';
import { socketWrapper } from '../socket.js';

const entityHintMap: Record<string, string> = {
  'list-items': 'list_items',
  'meal-plans': 'meal_plans',
};

function resolveParentId(user: { role?: string; parentId?: string; uid?: string } | undefined): string | undefined {
  if (!user) return undefined;
  if (user.role === 'parent' || user.role === 'coparent') return user.parentId || user.uid;
  return user.parentId;
}

function resolveEntityHint(path: string): string {
  const pathParts = path.split('/').filter(Boolean);
  const rawEntityHint = pathParts[0] || 'general';
  return entityHintMap[rawEntityHint] ?? rawEntityHint;
}

export const staleDataBroadcaster: RequestHandler = (req, res, next) => {
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    next();
    return;
  }

  const originalJson = res.json;
  res.json = function(body) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const user = (req as typeof req & { user?: { role?: string; parentId?: string; uid?: string } }).user;
      const parentId = resolveParentId(user);
      if (parentId) {
        socketWrapper.emitStaleData(parentId, resolveEntityHint(req.path));
      }
    }
    return originalJson.call(this, body);
  };

  next();
};
