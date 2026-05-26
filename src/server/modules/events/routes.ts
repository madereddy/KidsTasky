import { Router } from 'express';
import { eventsService } from './service.js';
import { syncService } from '../sync/service.js';
import { authenticateUser, getParentId } from '../../middleware/auth.js';

export const eventsRouter = Router();

eventsRouter.post('/events', authenticateUser, async (req, res) => {
  try {
    const parentId = getParentId(req);
    const allowed: Record<string, any> = {};
    const { title, description, startTime, endTime, assignedToId, color, isAllDay, recurrence, recurrenceEnd, isCountdown, reminderMinutes } = req.body;
    if (title !== undefined) allowed.title = title;
    if (description !== undefined) allowed.description = description;
    if (startTime !== undefined) allowed.startTime = startTime;
    if (endTime !== undefined) allowed.endTime = endTime;
    if (assignedToId !== undefined) allowed.assignedToId = assignedToId;
    if (color !== undefined) allowed.color = color;
    if (isAllDay !== undefined) allowed.isAllDay = isAllDay;
    if (recurrence !== undefined) allowed.recurrence = recurrence;
    if (recurrenceEnd !== undefined) allowed.recurrenceEnd = recurrenceEnd;
    if (isCountdown !== undefined) allowed.isCountdown = isCountdown;
    if (reminderMinutes !== undefined) allowed.reminderMinutes = reminderMinutes;
    const eventData = { ...allowed, parentId };

    let ids: string[];
    if (allowed.recurrence && allowed.recurrence !== 'none' && allowed.recurrenceEnd) {
      ids = eventsService.createRecurringEvents(eventData as any, allowed.recurrence, allowed.recurrenceEnd);
    } else {
      ids = [eventsService.createEvent(eventData as any)];
    }

    res.json({ success: true, ids });

    // Google sync: push first event only (or all — push first is sufficient for display)
    const first = eventsService.getEventById(ids[0]);
    if (first) {
      const googleId = await syncService.pushEventToGoogle(first.parentId, first).catch(() => null);
      if (googleId) eventsService.setExternalId(ids[0], googleId, 'google');
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

eventsRouter.get('/parents/:parentId/events', authenticateUser, (req, res) => {
  try {
    const userParentId = getParentId(req);
    if (userParentId !== req.params.parentId as string) return res.status(403).json({ error: 'Forbidden' });
    res.json(eventsService.getEventsByParent(req.params.parentId as string));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

eventsRouter.put('/events/:id', authenticateUser, async (req, res) => {
  try {
    const event = eventsService.getEventById(req.params.id as string);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.parentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });

    const scope = (req.query.scope as string) === 'future' ? 'future' : 'one';
    const allowed: Record<string, any> = {};
    const { title, description, startTime, endTime, assignedToId, color, isAllDay, recurrence, recurrenceEnd, isCountdown, reminderMinutes } = req.body;
    if (title !== undefined) allowed.title = title;
    if (description !== undefined) allowed.description = description;
    if (startTime !== undefined) allowed.startTime = startTime;
    if (endTime !== undefined) allowed.endTime = endTime;
    if (assignedToId !== undefined) allowed.assignedToId = assignedToId;
    if (color !== undefined) allowed.color = color;
    if (isAllDay !== undefined) allowed.isAllDay = isAllDay;
    if (recurrence !== undefined) allowed.recurrence = recurrence;
    if (recurrenceEnd !== undefined) allowed.recurrenceEnd = recurrenceEnd;
    if (isCountdown !== undefined) allowed.isCountdown = isCountdown;
    if (reminderMinutes !== undefined) allowed.reminderMinutes = reminderMinutes;

    const affectedIds = eventsService.updateEvent(req.params.id as string, allowed, scope);
    res.json({ success: true });

    // Sync each affected event to Google
    for (const aid of affectedIds) {
      const updated = eventsService.getEventById(aid);
      if (!updated) continue;
      if (updated.externalId) {
        await syncService.updateEventInGoogle(updated.parentId, updated).catch(() => {});
      } else {
        const googleId = await syncService.pushEventToGoogle(updated.parentId, updated).catch(() => null);
        if (googleId) eventsService.setExternalId(aid, googleId, 'google');
      }
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

eventsRouter.delete('/events/:id', authenticateUser, async (req, res) => {
  try {
    const event = eventsService.getEventById(req.params.id as string);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.parentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });

    const scope = (req.query.scope as string) === 'future' ? 'future' : 'one';
    eventsService.deleteEvent(req.params.id as string, scope);
    res.json({ success: true });

    if (event.externalId) {
      await syncService.deleteEventFromGoogle(event.parentId, event.externalId).catch(() => {});
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
