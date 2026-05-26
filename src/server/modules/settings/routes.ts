import { Router } from 'express';
import { requireAuth, getParentId } from '../../middleware/auth.js';
import { settingsService } from './service.js';

export const settingsRouter = Router();

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
