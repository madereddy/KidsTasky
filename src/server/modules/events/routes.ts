import { Router } from 'express';
import { eventsService } from './service.js';
import { syncService } from '../sync/service.js';

export const eventsRouter = Router();

eventsRouter.post('/events', async (req, res) => {
  try {
    const id = eventsService.createEvent(req.body);
    const event = eventsService.getEventById(id);
    res.json({ success: true, id });

    if (event) {
      const googleId = await syncService.pushEventToGoogle(event.parentId, event);
      if (googleId) eventsService.setExternalId(id, googleId, 'google');
    }
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

eventsRouter.put('/events/:id', async (req, res) => {
  try {
    eventsService.updateEvent(req.params.id, req.body);
    const updated = eventsService.getEventById(req.params.id);
    res.json({ success: true });

    if (updated) {
      if (updated.externalId) {
        await syncService.updateEventInGoogle(updated.parentId, updated);
      } else {
        const googleId = await syncService.pushEventToGoogle(updated.parentId, updated);
        if (googleId) eventsService.setExternalId(updated.id, googleId, 'google');
      }
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

eventsRouter.delete('/events/:id', async (req, res) => {
  try {
    const event = eventsService.getEventById(req.params.id);
    eventsService.deleteEvent(req.params.id);
    res.json({ success: true });

    if (event?.externalId) {
      await syncService.deleteEventFromGoogle(event.parentId, event.externalId);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
