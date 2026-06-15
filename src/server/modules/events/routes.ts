import { Router } from 'express';
import { eventsService, assertFamilyMember } from './service.js';
import { syncService } from '../sync/service.js';
import { authenticateUser, assertParentScope, enforceEditUnlocked, getParentId, requireRole } from '../../middleware/auth.js';

export const eventsRouter = Router();

eventsRouter.post('/events', authenticateUser, requireRole('parent'), enforceEditUnlocked, async (req, res) => {
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

    // Google sync: push first event only (or all — push first is sufficient for display)
    const first = eventsService.getEventById(ids[0]);
    if (first) {
      const googleId = await syncService.pushEventToGoogle(first.parentId, first).catch(() => null);
      if (googleId) eventsService.setExternalId(ids[0], googleId, 'google');
    }

    return res.json({ success: true, ids });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

eventsRouter.get('/parents/:parentId/events', authenticateUser, assertParentScope, (req, res) => {
  try {
    return res.json(eventsService.getEventsByParent(req.params.parentId as string));
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

eventsRouter.put('/events/:id', authenticateUser, requireRole('parent'), enforceEditUnlocked, async (req, res) => {
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

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

eventsRouter.delete('/events/:id', authenticateUser, requireRole('parent'), enforceEditUnlocked, async (req, res) => {
  try {
    const event = eventsService.getEventById(req.params.id as string);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.parentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });

    const scope = (req.query.scope as string) === 'future' ? 'future' : 'one';
    eventsService.deleteEvent(req.params.id as string, scope);

    if (event.externalId) {
      await syncService.deleteEventFromGoogle(event.parentId, event.externalId).catch(() => {});
    }

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

eventsRouter.post('/events/:id/attendees', authenticateUser, (req, res) => {
  try {
    const user = (req as any).user as { uid: string; role: string; parentId?: string };
    if (user.role !== 'parent') return res.status(403).json({ error: 'Forbidden' });
    const parentId = getParentId(req);
    const event = eventsService.getEventById(req.params.id as string);
    if (!event || event.parentId !== parentId) return res.status(403).json({ error: 'Forbidden' });
    const targetUserId = req.body.userId as string;
    if (!assertFamilyMember(targetUserId, parentId)) return res.status(400).json({ error: 'Invalid attendee' });
    eventsService.addAttendee(req.params.id as string, targetUserId);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

eventsRouter.patch('/events/:id/attendees/:userId', authenticateUser, (req, res) => {
  try {
    const user = (req as any).user as { uid: string; role: string; parentId?: string };
    const parentId = getParentId(req);
    const event = eventsService.getEventById(req.params.id as string);
    if (!event || event.parentId !== parentId) return res.status(403).json({ error: 'Forbidden' });
    if (user.role !== 'parent' && user.uid !== req.params.userId) return res.status(403).json({ error: 'Forbidden' });
    const { rsvp } = req.body;
    if (!['pending', 'yes', 'no', 'maybe'].includes(rsvp)) return res.status(400).json({ error: 'Invalid rsvp' });
    const ok = eventsService.updateRsvp(req.params.id as string, req.params.userId as string, rsvp);
    if (!ok) return res.status(404).json({ error: 'Attendee not found' });
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

eventsRouter.delete('/events/:id/attendees/:userId', authenticateUser, (req, res) => {
  try {
    const user = (req as any).user as { role: string };
    if (user.role !== 'parent') return res.status(403).json({ error: 'Forbidden' });
    const parentId = getParentId(req);
    const event = eventsService.getEventById(req.params.id as string);
    if (!event || event.parentId !== parentId) return res.status(403).json({ error: 'Forbidden' });
    eventsService.removeAttendee(req.params.id as string, req.params.userId as string);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});
