// src/server/modules/magic/routes.ts
import { Router } from 'express';
import { magicService } from './service.js';
import { eventsService } from '../events/service.js';
import { db } from '../../db.js';

export const magicRouter = Router();

magicRouter.post('/magic/import', async (req, res) => {
  try {
    const { text, recipient } = req.body;
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
    const parentId = familyIdMatch ? familyIdMatch[1] : 'unknown';

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

    const dbEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(dbEventId);

    res.json(dbEvent);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
