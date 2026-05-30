// src/server/modules/magic/routes.ts
import { Router } from 'express';
import { magicService } from './service.js';
import { eventsService } from '../events/service.js';
import { socketWrapper } from '../../socket.js';
import { db } from '../../db.js';
import crypto from 'crypto';

export const magicRouter = Router();

magicRouter.post('/magic/import', async (req, res) => {
  try {
    const { text, recipient, timestamp, token, signature } = req.body;
    
    // Webhook Signature verification (Mailgun example)
    const signingKey = process.env.MAILGUN_SIGNING_KEY;
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

    res.json(dbEvent);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

