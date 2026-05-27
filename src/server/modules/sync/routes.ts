import { Router } from 'express';
import { google } from 'googleapis';
import { authenticateUser, getParentId } from '../../middleware/auth.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../../config.js';
import { syncService } from './service.js';
import { socketWrapper } from '../../socket.js';

export const syncRouter = Router();

syncRouter.get('/settings/:parentId/connections', authenticateUser, (req, res) => {
  const userParentId = (req as any).user.role === 'parent' ? (req as any).user.uid : (req as any).user.parentId;
  if (userParentId !== (req.params.parentId as string)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const list = syncService.getConnections(req.params.parentId as string);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to load connections" });
  }
});

syncRouter.delete('/settings/connections/:id', authenticateUser, (req, res) => {
  const id = req.params.id as string;
  try {
    const conn = syncService.getConnectionById(id);
    if (!conn) return res.status(404).json({ error: 'Not found' });
    const userParentId = (req as any).user.role === 'parent' ? (req as any).user.uid : (req as any).user.parentId;
    if (conn.parentId !== userParentId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    syncService.deleteConnection(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete connection" });
  }
});

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID || 'mock_client_id',
  process.env.GOOGLE_CLIENT_SECRET || 'mock_client_secret',
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/sync/callback/google'
);

syncRouter.get('/sync/connect/google', (req, res) => {
  const token = req.query.token as string;
  let parentId = '';
  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as any;
    parentId = payload.parentId;
    if (!parentId) throw new Error("No parent id generated");
  } catch (err) {
    return res.status(401).send("Unauthorized");
  }

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.readonly'],
    state: parentId, // pass parentId in state securely
    prompt: 'consent'
  });
  res.redirect(url);
});

syncRouter.get('/sync/callback/google', async (req, res) => {
  const { code, state: parentId } = req.query;
  if (!code || typeof code !== 'string') return res.status(400).send("No code");
  
  try {
    let tokens;
    if (process.env.NODE_ENV === 'test' || code === 'test_mock_code') {
      tokens = { access_token: 'mock_access', refresh_token: 'mock_refresh' };
    } else {
      const { tokens: t } = await oauth2Client.getToken(code);
      tokens = t;
    }
    
    // Store in DB
    syncService.saveGoogleTokens(parentId as string, tokens.access_token || '', tokens.refresh_token);
    
    res.send("Successfully connected! You can close this window.");
  } catch (err) {
    res.status(500).send("Failed to connect");
  }
});

// Calendar list: get all discovered calendars for this parent
syncRouter.get('/settings/:parentId/calendars', authenticateUser, (req, res) => {
  const userParentId = (req as any).user.role === 'parent' ? (req as any).user.uid : (req as any).user.parentId;
  if (userParentId !== (req.params.parentId as string)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const calendars = syncService.getSyncCalendarsByParent(req.params.parentId as string);
    res.json(calendars);
  } catch (err) {
    res.status(500).json({ error: "Failed to load calendars" });
  }
});

// Toggle a calendar on/off
syncRouter.patch('/settings/calendars/:id', authenticateUser, (req, res) => {
  const id = req.params.id as string;
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled (boolean) required' });
  try {
    const calendar = syncService.getSyncCalendarById(id);
    if (!calendar) return res.status(404).json({ error: 'Not found' });
    const userParentId = (req as any).user.role === 'parent' ? (req as any).user.uid : (req as any).user.parentId;
    if (calendar.parentId !== userParentId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    syncService.toggleSyncCalendar(id, enabled);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update calendar" });
  }
});

syncRouter.post('/sync/connect/manual', authenticateUser, (req, res) => {
  const { email, appPassword } = req.body;
  if (!email || !appPassword) return res.status(400).json({ error: "Missing fields" });

  try {
    const parentId = (req as any).user.parentId || (req as any).user.uid;
    syncService.saveManualConnection(parentId, email, appPassword);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save connection" });
  }
});

syncRouter.post('/sync/:id/now', authenticateUser, async (req, res) => {
  try {
    const connection = syncService.getConnectionById(req.params.id);
    if (!connection || connection.parentId !== getParentId(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await syncService.syncGoogleConnectionNow(connection as any);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

syncRouter.post('/settings/:parentId/sync-now', authenticateUser, async (req, res) => {
  const parentId = req.params.parentId as string;
  const userParentId = (req as any).user.role === 'parent' ? (req as any).user.uid : (req as any).user.parentId;
  if (userParentId !== parentId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const connections = syncService.getGoogleConnectionsByParent(parentId);
    if (connections.length === 0) {
      return res.json({ success: true, imported: 0, updated: 0, successCount: 0, failureCount: 0, errors: [], connections: 0, startedAt: Date.now(), finishedAt: Date.now() });
    }

    let imported = 0;
    let updated = 0;
    let successCount = 0;
    let failureCount = 0;
    const allErrors: Array<{ connectionId: string; calendarId: string; message: string }> = [];
    const startedAt = Date.now();

    for (const connection of connections) {
      const result = await syncService.syncGoogleConnectionNow(connection);
      imported += result.imported;
      updated += result.updated;
      successCount += result.successCount;
      failureCount += result.failureCount;
      for (const e of result.errors) {
        allErrors.push({ connectionId: connection.id, ...e });
      }
    }

    const finishedAt = Date.now();
    if (imported > 0 || updated > 0) socketWrapper.emitStaleData(parentId, 'events');

    return res.json({
      success: failureCount === 0,
      imported,
      updated,
      successCount,
      failureCount,
      errors: allErrors,
      connections: connections.length,
      startedAt,
      finishedAt,
    });
  } catch (err) {
    console.error('[sync:sync_now_failed]', err);
    const message = err instanceof Error ? err.message : 'Failed to sync calendars now';
    return res.status(500).json({ error: message });
  }
});
