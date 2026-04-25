// src/server/modules/events/routes.ts
import { Router } from 'express';
import { eventsService } from './service.js';

export const eventsRouter = Router();

eventsRouter.post('/events', (req, res) => {
  try {
    const id = eventsService.createEvent(req.body);
    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

eventsRouter.get('/parents/:parentId/events', (req, res) => {
  try {
    const events = eventsService.getEventsByParent(req.params.parentId);
    res.json(events);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
