import { Router } from 'express';
import { requireAuth, assertParentScope, requireRole } from '../../middleware/auth.js';
import { flagsService, KNOWN_FLAGS, FlagName } from './service.js';

export const flagsRouter = Router();

flagsRouter.get('/settings/:parentId/flags', requireAuth, assertParentScope, (req, res) => {
  try {
    res.json(flagsService.getFlags(String(req.params.parentId)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

flagsRouter.patch('/settings/:parentId/flags/:flag', requireAuth, requireRole('parent'), assertParentScope, (req, res) => {
  const flag = req.params.flag as FlagName;
  if (!(KNOWN_FLAGS as readonly string[]).includes(flag)) {
    return res.status(400).json({ error: `Unknown flag: ${flag}` });
  }
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled (boolean) required' });
  }
  try {
    flagsService.setFlag(String(req.params.parentId), flag, enabled);
    res.json({ success: true, flag, enabled });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
