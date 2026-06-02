import { Router } from 'express';
import bcrypt from 'bcrypt';
import { requireAuth, assertParentScope, getParentId, requireRole } from '../../middleware/auth.js';
import { settingsService } from './service.js';
import { syncService } from '../sync/service.js';

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
    const settings = settingsService.getSettings(parentId);
    const calendars = syncService.getSyncCalendarsByParent(parentId);
    const calendarVisibility = settingsService.getCalendarVisibility(userId);
    const connections = syncService.getConnections(parentId);

    res.json({
      settings: scrubSettings(settings as any),
      calendars,
      calendarVisibility,
      connections,
    });
  } catch (error: any) {
    console.error('[settings:bootstrap]', error);
    res.status(500).json({ error: error.message });
  }
});

settingsRouter.get('/settings/visibility', requireAuth, (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const visibility = settingsService.getCalendarVisibility(userId);
    res.json(visibility);
  } catch (error: any) {
    console.error('[settings:get-visibility]', error);
    res.status(500).json({ error: error.message });
  }
});

settingsRouter.post('/settings/visibility', requireAuth, (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const { calendarId, isVisible } = req.body;
    if (!calendarId) return res.status(400).json({ error: 'calendarId is required' });
    
    settingsService.setCalendarVisibility(userId, calendarId, !!isVisible);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[settings:post-visibility]', error);
    res.status(500).json({ error: error.message });
  }
});

settingsRouter.get('/settings/:parentId', requireAuth, (req, res) => {
  try {
    const userParentId = getParentId(req);
    if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
    const settings = settingsService.getSettings(String(req.params.parentId));
    res.json(scrubSettings(settings as any));
  } catch (error: any) {
    console.error('[settings:get]', error);
    res.status(500).json({ error: error.message });
  }
});

settingsRouter.put('/settings/:parentId', requireAuth, requireRole('parent'), async (req, res) => {
  try {
    const userParentId = getParentId(req);
    if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
    const data = { ...req.body };
    if (data.pin && String(data.pin).trim() !== '') {
      // Hash the plaintext PIN before storing
      data.pin = await bcrypt.hash(String(data.pin).trim(), 10);
    } else {
      // Empty/null PIN — don't overwrite existing PIN; service will preserve via merge
      delete data.pin;
    }
    settingsService.saveSettings(String(req.params.parentId), data);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[settings:save]', error);
    res.status(500).json({ error: error.message });
  }
});

settingsRouter.post("/settings/:parentId/lock", requireAuth, requireRole('parent'), (req, res) => {
  try {
    const userParentId = getParentId(req);
    if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
    settingsService.setLocked(String(req.params.parentId), true);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

settingsRouter.post("/settings/:parentId/unlock", requireAuth, requireRole('parent'), async (req, res) => {
  try {
    const userParentId = getParentId(req);
    if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
    const settings = settingsService.getSettings(String(req.params.parentId));
    if (!settings.pin || String(settings.pin).trim() === "") {
      settingsService.setLocked(String(req.params.parentId), false);
      return res.json({ success: true });
    }

    const inputPin = String(req.body?.pin ?? "");
    const stored = String(settings.pin);

    let match: boolean;
    if (stored.startsWith('$2')) {
      // bcrypt hash — use secure compare
      match = await bcrypt.compare(inputPin, stored);
    } else {
      // Legacy plaintext PIN — accept and upgrade to hash
      match = inputPin === stored;
      if (match) {
        const hash = await bcrypt.hash(inputPin, 10);
        settingsService.saveSettings(String(req.params.parentId), { pin: hash });
      }
    }

    if (!match) return res.status(403).json({ error: "Incorrect PIN" });
    settingsService.setLocked(String(req.params.parentId), false);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

