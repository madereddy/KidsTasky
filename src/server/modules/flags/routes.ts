import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { flagsService, KNOWN_FLAGS, FlagName } from './service.js';

export const flagsRouter = Router();

flagsRouter.get('/settings/:parentId/flags', requireAuth, (req, res) => {
  const userParentId = (req as any).user.role === 'parent' ? (req as any).user.uid : (req as any).user.parentId;
  if (userParentId !== req.params.parentId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    res.json(flagsService.getFlags(String(req.params.parentId)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

flagsRouter.patch('/settings/:parentId/flags/:flag', requireAuth, (req, res) => {
  const userParentId = (req as any).user.role === 'parent' ? (req as any).user.uid : (req as any).user.parentId;
  if (userParentId !== req.params.parentId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
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
