// src/server/modules/magic/routes.ts
import { Router } from 'express';
import { magicService } from './service.js';
import { eventsService } from '../events/service.js';
import { socketWrapper } from '../../socket.js';
import { db } from '../../db.js';
import crypto from 'crypto';
import { rateLimit } from 'express-rate-limit';

const magicLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many magic import requests. Please wait.' },
});

const MAX_MAGIC_TEXT_LENGTH = 20_000;

export const magicRouter = Router();

magicRouter.post('/magic/import', magicLimiter, async (req, res) => {
  try {
    const { text, recipient, timestamp, token, signature } = req.body;

    // When no webhook signing key is configured, require JWT auth instead
    const signingKey = process.env.MAILGUN_SIGNING_KEY;
    let jwtFamily: string | null = null;
    if (!signingKey) {
      const authHeader = req.headers['authorization'];
      if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized: provide JWT token or configure MAILGUN_SIGNING_KEY' });
      }
      try {
        const jwt = await import('jsonwebtoken');
        const { getJwtSecret } = await import('../../config.js');
        const payload = jwt.default.verify(authHeader.replace('Bearer ', ''), getJwtSecret(), { algorithms: ['HS256'] }) as { uid: string; parentId?: string };
        jwtFamily = payload.parentId || payload.uid;
      } catch {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    // Webhook Signature verification (Mailgun example)
    if (signingKey && timestamp && token && signature) {
      const encodedToken = crypto
          .createHmac('sha256', signingKey)
          .update(timestamp.concat(token))
          .digest('hex');
      const expected = Buffer.from(encodedToken);
      const provided = Buffer.from(String(signature));
      if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    } else if (process.env.NODE_ENV === 'production' && signingKey) {
      // In production, if signatures are enforced and missing, reject
      return res.status(401).json({ error: 'Missing webhook signature' });
    }

    if (!text) {
      return res.status(400).json({ error: 'Missing text content' });
    }
    if (typeof text === 'string' && text.length > MAX_MAGIC_TEXT_LENGTH) {
      return res.status(400).json({ error: 'Text too long' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    // Pass to AI wrapper
    const extractedEvent = await magicService.parseEventsFromText(text, apiKey);

    // Extract parent/family ID from recipient pseudo-email
    const familyIdMatch = recipient?.match(/([^@]+)@/);
    const parentId = familyIdMatch ? familyIdMatch[1] : null;

    // Validate parentId maps to a real family to prevent phantom event injection
    if (!parentId) return res.status(400).json({ error: 'Could not determine family from recipient' });
    const familyRow = db.prepare("SELECT uid FROM users WHERE uid = ? AND role = 'parent'").get(parentId);
    if (!familyRow) return res.status(404).json({ error: 'Unknown family' });
    // JWT-authenticated callers may only import into their own family. (The
    // webhook-signature path is trusted via HMAC and may target any recipient.)
    if (jwtFamily && parentId !== jwtFamily) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Parse date and time if possible into unix timestamp, mock here
    const ts = new Date(`${extractedEvent.date}T${extractedEvent.startTime}:00Z`).getTime() || Date.now();

    // Insert into DB
    const dbEventId = eventsService.createEvent({
        parentId,
        title: extractedEvent.title,
        description: 'Magic import',
        startTime: ts,
        endTime: ts + 3600 * 1000,
        color: '#3b82f6'
    });

    const dbEvent = eventsService.getEventById(dbEventId);

    // Broadcast stale-data event
    socketWrapper.emitStaleData(parentId, 'events');

    return res.json(dbEvent);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

