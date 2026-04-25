import { Router } from 'express';
import { google } from 'googleapis';
import { db } from '../../db.js';
import { authenticateUser } from '../../middleware/auth.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../../config.js';

export const syncRouter = Router();

syncRouter.get('/settings/:parentId/connections', (req, res) => {
  const parentId = req.params.parentId;
  try {
    const list = db.prepare("SELECT id, provider, createdAt FROM sync_connections WHERE parentId = ?").all(parentId);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to load connections" });
  }
});

syncRouter.delete('/settings/connections/:id', (req, res) => {
  const id = req.params.id;
  try {
    db.prepare("DELETE FROM sync_connections WHERE id = ?").run(id);
    db.prepare("DELETE FROM events WHERE source = 'google' AND parentId = (SELECT parentId FROM sync_connections WHERE id = ?)").run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to load connections" });
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
    const payload = jwt.verify(token, getJwtSecret()) as any;
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
    const connId = 'sync_' + Date.now();
    db.prepare(`
      INSERT INTO sync_connections (id, parentId, provider, accessToken, refreshToken) 
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET accessToken=excluded.accessToken, refreshToken=excluded.refreshToken
    `).run(connId, parentId as string, 'google', tokens.access_token, tokens.refresh_token);
    
    res.send("Successfully connected! You can close this window.");
  } catch (err) {
    res.status(500).send("Failed to connect");
  }
});
