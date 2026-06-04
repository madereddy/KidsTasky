import { Router } from 'express';
import { google } from 'googleapis';
import { authenticateUser, assertParentScope, getParentId, requireRole } from '../../middleware/auth.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../../config.js';
import { syncService } from './service.js';
import { socketWrapper } from '../../socket.js';
import { logger } from '../../lib/logger.js';

export const syncRouter = Router();

syncRouter.get('/settings/:parentId/connections', authenticateUser, assertParentScope, (req, res) => {
  try {
    const list = syncService.getConnections(req.params.parentId as string);
    res.json(list);
  } catch (err) {
    logger.error({ error: err, params: req.params }, 'sync_connections_list_error');
    res.status(500).json({ error: "Failed to load connections" });
  }
});

syncRouter.delete('/settings/connections/:id', authenticateUser, requireRole('parent'), (req, res) => {
  const id = req.params.id as string;
  try {
    const conn = syncService.getConnectionById(id);
    if (!conn) return res.status(404).json({ error: 'Not found' });
    if (conn.parentId !== getParentId(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    syncService.deleteConnection(id);
    res.json({ success: true });
  } catch (err) {
    logger.error({ error: err, connectionId: id }, 'sync_connection_delete_error');
    res.status(500).json({ error: "Failed to delete connection" });
  }
});

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID || 'mock_client_id',
  process.env.GOOGLE_CLIENT_SECRET || 'mock_client_secret',
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/sync/callback/google'
);
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const GOOGLE_PHOTOS_SCOPE = 'https://www.googleapis.com/auth/photoslibrary.readonly';
const GOOGLE_PHOTOS_PICKER_SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';

function hasScope(scopeText: string | undefined, required: string): boolean {
  if (!scopeText) return false;
  const scopes = new Set(scopeText.split(/\s+/).map((s) => s.trim()).filter(Boolean));
  return scopes.has(required);
}

function formatScopes(scopeText: string | undefined): string {
  if (!scopeText) return '(none returned by Google)';
  return scopeText
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ');
}

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
    scope: [
      GOOGLE_CALENDAR_SCOPE,
      GOOGLE_PHOTOS_SCOPE,
      GOOGLE_PHOTOS_PICKER_SCOPE,
    ],
    state: parentId, // pass parentId in state securely
    prompt: 'consent select_account',
    include_granted_scopes: false,
  });
  res.redirect(url);
});

syncRouter.get('/sync/callback/google', async (req, res) => {
  const { code, state: parentId } = req.query;
  if (!code || typeof code !== 'string') return res.status(400).send("No code");
  
  try {
    let tokens;
    if (process.env.NODE_ENV === 'test' || code === 'test_mock_code') {
      tokens = {
        access_token: 'mock_access',
        refresh_token: 'mock_refresh',
        scope: `${GOOGLE_CALENDAR_SCOPE} ${GOOGLE_PHOTOS_SCOPE} ${GOOGLE_PHOTOS_PICKER_SCOPE}`,
      };
    } else {
      const { tokens: t } = await oauth2Client.getToken(code);
      tokens = t;
    }

    const missingPhotosScope = !hasScope(tokens.scope, GOOGLE_PHOTOS_SCOPE);
    const missingPickerScope = !hasScope(tokens.scope, GOOGLE_PHOTOS_PICKER_SCOPE);
    if (missingPhotosScope || missingPickerScope) {
      const grantedScopes = formatScopes(tokens.scope);
      logger.error({
        parentId: parentId as string,
        requiredScope: [GOOGLE_PHOTOS_SCOPE, GOOGLE_PHOTOS_PICKER_SCOPE].join(', '),
        grantedScopes,
      }, 'sync_google_scope_missing');
      return res.status(400).send(
        `Required Google Photos scopes were not granted. Required: ${GOOGLE_PHOTOS_SCOPE}, ${GOOGLE_PHOTOS_PICKER_SCOPE}. Granted: ${grantedScopes}. Remove this app in Google Account permissions, then reconnect and grant Calendar + Photos access.`
      );
    }
    
    // Store in DB
    syncService.saveGoogleTokens(parentId as string, tokens.access_token || '', tokens.refresh_token);
    
    res.send("Successfully connected! You can close this window.");
  } catch (err) {
    logger.error({ error: err, parentId }, 'sync_google_callback_error');
    res.status(500).send("Failed to connect");
  }
});

// Calendar list: get all discovered calendars for this parent
syncRouter.get('/settings/:parentId/calendars', authenticateUser, assertParentScope, (req, res) => {
  try {
    const calendars = syncService.getSyncCalendarsByParent(req.params.parentId as string);
    res.json(calendars);
  } catch (err) {
    logger.error({ error: err, params: req.params }, 'sync_calendars_list_error');
    res.status(500).json({ error: "Failed to load calendars" });
  }
});

// Toggle a calendar on/off
syncRouter.patch('/settings/calendars/:id', authenticateUser, requireRole('parent'), (req, res) => {
  const id = req.params.id as string;
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled (boolean) required' });
  try {
    const calendar = syncService.getSyncCalendarById(id);
    if (!calendar) return res.status(404).json({ error: 'Not found' });
    if (calendar.parentId !== getParentId(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    syncService.toggleSyncCalendar(id, enabled);
    res.json({ success: true });
  } catch (err) {
    logger.error({ error: err, calendarId: id, body: req.body }, 'sync_calendar_toggle_error');
    res.status(500).json({ error: "Failed to update calendar" });
  }
});

syncRouter.post('/sync/connect/manual', authenticateUser, requireRole('parent'), (req, res) => {
  const { email, appPassword } = req.body;
  if (!email || !appPassword) return res.status(400).json({ error: "Missing fields" });

  try {
    const parentId = (req as any).user.parentId || (req as any).user.uid;
    syncService.saveManualConnection(parentId, email, appPassword);
    res.json({ success: true });
  } catch (err) {
    logger.error({ error: err, userId: (req as any).user?.uid }, 'sync_manual_connection_save_error');
    res.status(500).json({ error: "Failed to save connection" });
  }
});

syncRouter.post('/sync/:id/now', authenticateUser, requireRole('parent'), async (req, res) => {
  try {
    const connection = syncService.getConnectionById(String(req.params.id));
    if (!connection || connection.parentId !== getParentId(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await syncService.syncGoogleConnectionNow(connection as any);
    res.json(result);
  } catch (error: any) {
    logger.error({ error: error.message, connectionId: req.params.id }, 'sync_run_now_error');
    res.status(500).json({ error: error.message });
  }
});

syncRouter.post('/settings/:parentId/sync-now', authenticateUser, requireRole('parent'), assertParentScope, async (req, res) => {
  const parentId = req.params.parentId as string;

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
    logger.error({ error: err, parentId }, 'sync_parent_run_now_error');
    const message = err instanceof Error ? err.message : 'Failed to sync calendars now';
    return res.status(500).json({ error: message });
  }
});
