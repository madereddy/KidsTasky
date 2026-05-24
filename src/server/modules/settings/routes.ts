import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { settingsService } from './service.js';

export const settingsRouter = Router();

settingsRouter.get('/settings/:parentId', requireAuth, (req, res) => {
  try {
    const settings = settingsService.getSettings(req.params.parentId);
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

settingsRouter.put('/settings/:parentId', requireAuth, (req, res) => {
  try {
    settingsService.saveSettings(req.params.parentId, req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
