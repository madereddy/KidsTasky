import { Router } from 'express';
import { requireAuth, assertParentScope, getParentId } from '../../middleware/auth.js';
import { settingsService } from './service.js';
import { syncService } from '../sync/service.js';

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
      settings,
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
    res.json(settings);
  } catch (error: any) {
    console.error('[settings:get]', error);
    res.status(500).json({ error: error.message });
  }
});

settingsRouter.put('/settings/:parentId', requireAuth, (req, res) => {
  try {
    const userParentId = getParentId(req);
    if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
    settingsService.saveSettings(String(req.params.parentId), req.body);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[settings:save]', error);
    res.status(500).json({ error: error.message });
  }
});

settingsRouter.post("/settings/:parentId/lock", requireAuth, (req, res) => {
  try {
    const userParentId = getParentId(req);
    if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
    settingsService.setLocked(String(req.params.parentId), true);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

settingsRouter.post("/settings/:parentId/unlock", requireAuth, (req, res) => {
  try {
    const userParentId = getParentId(req);
    if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
    const settings = settingsService.getSettings(String(req.params.parentId));
    if (!settings.pin || String(settings.pin).trim() === "") {
      settingsService.setLocked(String(req.params.parentId), false);
      return res.json({ success: true });
    }

    const pin = String(req.body?.pin ?? "");
    if (pin !== settings.pin) {
      return res.status(403).json({ error: "Incorrect PIN" });
    }
    settingsService.setLocked(String(req.params.parentId), false);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

