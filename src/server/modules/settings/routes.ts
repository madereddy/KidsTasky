import { Router } from 'express';
import { hashSecret, verifyAndUpgrade, verifySecret } from '../../lib/hashing.js';
import { requireAuth, assertParentScope, getParentId, requireRole } from '../../middleware/auth.js';
import { settingsService } from './service.js';
import { syncService } from '../sync/service.js';
import { authService } from '../auth/service.js';
import { logger } from '../../lib/logger.js';

import { getLockoutState, recordFailedAttempt, resetLockout } from '../../lib/lockout.js';

/** Strip raw PIN hash from settings before sending to client. */
function scrubSettings(settings: Record<string, any>) {
  const { pin, ...rest } = settings;
  return { ...rest, hasPIN: !!pin };
}

export const settingsRouter = Router();

settingsRouter.get('/settings/:parentId/bootstrap', requireAuth, assertParentScope, (req, res) => {
  try {
    const userId = (req as any).user.uid as string;
    const parentId = String(req.params.parentId);
    const lockout = getLockoutState(`unlock:${parentId}`);
    const settings = settingsService.getSettings(parentId);
    const calendars = syncService.getSyncCalendarsByParent(parentId);
    const calendarVisibility = settingsService.getCalendarVisibility(userId);
    const connections = syncService.getConnections(parentId);

    return res.json({
      settings: {
        ...scrubSettings(settings as any),
        lockout: lockout.locked ? { remainingSec: Math.ceil(lockout.remainingMs / 1000) } : null
      },
      calendars,
      calendarVisibility,
      connections,
    });
  } catch (error: any) {
    logger.error({ error: error.message, params: req.params }, 'settings_bootstrap_error');
    return res.status(500).json({ error: error.message });
  }
});

settingsRouter.get('/settings/visibility', requireAuth, (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const visibility = settingsService.getCalendarVisibility(userId);
    return res.json(visibility);
  } catch (error: any) {
    logger.error({ error: error.message, userId: (req as any).user?.uid }, 'settings_get_visibility_error');
    return res.status(500).json({ error: error.message });
  }
});

settingsRouter.post('/settings/visibility', requireAuth, (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const { calendarId, isVisible } = req.body;
    if (!calendarId) return res.status(400).json({ error: 'calendarId is required' });
    
    settingsService.setCalendarVisibility(userId, calendarId, !!isVisible);
    return res.json({ success: true });
  } catch (error: any) {
    logger.error({ error: error.message, body: req.body, userId: (req as any).user?.uid }, 'settings_post_visibility_error');
    return res.status(500).json({ error: error.message });
  }
});

settingsRouter.get('/settings/:parentId', requireAuth, (req, res) => {
  try {
    const userParentId = getParentId(req);
    if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
    const settings = settingsService.getSettings(String(req.params.parentId));
    const parentId = String(req.params.parentId);
    const lockout = getLockoutState(`unlock:${parentId}`);
    
    return res.json({
      ...scrubSettings(settings as any),
      lockout: lockout.locked ? { remainingSec: Math.ceil(lockout.remainingMs / 1000) } : null
    });
  } catch (error: any) {
    logger.error({ error: error.message, params: req.params }, 'settings_get_error');
    return res.status(500).json({ error: error.message });
  }
});

settingsRouter.put('/settings/:parentId', requireAuth, requireRole('parent'), async (req, res) => {
  try {
    const userParentId = getParentId(req);
    if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
    const data = { ...req.body };
    if (data.pin && String(data.pin).trim() !== '') {
      // Hash the plaintext PIN before storing
      data.pin = await hashSecret(String(data.pin).trim());
    } else {
      // Empty/null PIN — don't overwrite existing PIN; service will preserve via merge
      delete data.pin;
    }
    settingsService.saveSettings(String(req.params.parentId), data);
    return res.json({ success: true });
  } catch (error: any) {
    logger.error({ error: error.message, params: req.params, body: req.body }, 'settings_save_error');
    return res.status(500).json({ error: error.message });
  }
});

settingsRouter.post("/settings/:parentId/lock", requireAuth, requireRole('parent'), (req, res) => {
  try {
    const userParentId = getParentId(req);
    if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
    settingsService.setLocked(String(req.params.parentId), true);
    return res.json({ success: true });
  } catch (error: any) {
    logger.error({ error: error.message, params: req.params }, 'settings_lock_error');
    return res.status(500).json({ error: error.message });
  }
});

settingsRouter.post("/settings/:parentId/unlock", requireAuth, assertParentScope, async (req, res) => {
  try {
    const parentId = String(req.params.parentId);
    const lockoutTarget = `unlock:${parentId}`;
    const lockout = getLockoutState(lockoutTarget);
    
    if (lockout.locked) {
      return res.status(429).json({ 
        error: "Too many failed attempts", 
        remainingSec: Math.ceil(lockout.remainingMs / 1000) 
      });
    }

    const settings = settingsService.getSettings(parentId);
    const inputSecret = String(req.body?.pin ?? "");
    
    let match = false;
    if (settings.pin && String(settings.pin).trim() !== "") {
      const { match: pinMatch, newHash } = await verifyAndUpgrade(inputSecret, String(settings.pin));
      match = pinMatch;
      if (match && newHash) {
        settingsService.saveSettings(parentId, { pin: newHash });
      }
    }

    if (!match) {
      // Fallback: Verify against parent's main account password
      match = await authService.verifyParentPassword(parentId, inputSecret);
    }

    if (!match) {
      const nextLockout = recordFailedAttempt(lockoutTarget);
      return res.status(403).json({ 
        error: "Incorrect PIN or password",
        remainingSec: nextLockout.locked ? Math.ceil(nextLockout.remainingMs / 1000) : undefined
      });
    }
    
    resetLockout(lockoutTarget);
    settingsService.setLocked(parentId, false);
    return res.json({ success: true });
  } catch (error: any) {
    logger.error({ error: error.message, params: req.params }, 'settings_unlock_error');
    return res.status(500).json({ error: error.message });
  }
});

