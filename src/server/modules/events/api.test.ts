// src/server/modules/events/api.test.ts
// @vitest-environment node
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app, db } from '../../../../server.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../../config.js';

describe('Events API', () => {
  const parentId = 'parent_api_1';
  const token = jwt.sign({ uid: parentId, role: 'parent', parentId }, getJwtSecret());
  const otherParentId = 'parent_api_other';
  const otherParentToken = jwt.sign({ uid: otherParentId, role: 'parent', parentId: otherParentId }, getJwtSecret());
  const kidId = 'kid_api_1';
  const kidToken = jwt.sign({ uid: kidId, role: 'kid', parentId }, getJwtSecret());

  beforeEach(() => {
    db.prepare('DELETE FROM event_routine_item_completions').run();
    db.prepare('DELETE FROM events').run();
    db.prepare('DELETE FROM event_attendees').run();
    db.prepare('DELETE FROM list_items').run();
    db.prepare('DELETE FROM lists').run();
    db.prepare('DELETE FROM users WHERE uid = ?').run(parentId);
    db.prepare('DELETE FROM users WHERE uid = ?').run(otherParentId);
    db.prepare('DELETE FROM users WHERE uid = ?').run(kidId);
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId) VALUES (?, ?, ?, ?, ?)").run(parentId, 'parent', 'Test Parent', 'events@test.com', parentId);
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId) VALUES (?, ?, ?, ?, ?)").run(otherParentId, 'parent', 'Other Parent', 'other@test.com', otherParentId);
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId) VALUES (?, ?, ?, ?, ?)").run(kidId, 'kid', 'Kid', 'kid@test.com', parentId);
  });

  afterAll(() => {
    // We don't close the DB here if it's shared, but server.test.ts might
  });

  it('should POST and GET events for a parent', async () => {
    const postRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        parentId,
        title: 'Dentist Appt',
        description: 'Teeth cleaning',
        startTime: 1713950000,
        endTime: 1713953600,
        assignedToId: 'kid_2',
        color: '#00FF00'
      });

    expect(postRes.status).toBe(200);
    expect(postRes.body.success).toBe(true);

    const getRes = await request(app)
      .get(`/api/parents/${parentId}/events`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.length).toBe(1);
    expect(getRes.body[0].title).toBe('Dentist Appt');
  });

  it('does not return 304 for API event reads with conditional cache headers', async () => {
    await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        parentId,
        title: 'Cached Event',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        color: '#6366f1'
      });

    const first = await request(app)
      .get(`/api/parents/${parentId}/events`)
      .set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(200);
    expect(first.headers['cache-control']).toContain('no-store');

    const second = await request(app)
      .get(`/api/parents/${parentId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .set('If-None-Match', first.headers.etag || '"cached"');

    expect(second.status).toBe(200);
    expect(second.body).toHaveLength(1);
    expect(second.body[0].title).toBe('Cached Event');
  });

  it('should create an all-day event', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        parentId,
        title: 'Holiday',
        startTime: new Date('2026-06-01').getTime(),
        endTime: new Date('2026-06-01T23:59:59').getTime(),
        color: '#ff0000',
        isAllDay: 1
      });
    expect(res.status).toBe(200);
    const events = await request(app).get(`/api/parents/${parentId}/events`).set('Authorization', `Bearer ${token}`);
    expect(events.body[0].isAllDay).toBe(1);
  });

  it('stores an attached routine list on an event', async () => {
    db.prepare('INSERT INTO lists (id, parentId, title, category, isRoutine, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('routine_list_1', parentId, 'Morning Routine', 'routine', 1, new Date().toISOString(), new Date().toISOString());

    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        parentId,
        title: 'School Morning',
        startTime: new Date('2026-06-01T08:00:00').getTime(),
        endTime: new Date('2026-06-01T09:00:00').getTime(),
        color: '#ff0000',
        routineListId: 'routine_list_1'
      });

    expect(res.status).toBe(200);

    const events = await request(app).get(`/api/parents/${parentId}/events`).set('Authorization', `Bearer ${token}`);
    expect(events.body[0].routineListId).toBe('routine_list_1');
  });

  it('rejects invalid routine list attachments', async () => {
    db.prepare('INSERT INTO lists (id, parentId, title, category, isRoutine, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('shopping_list_1', parentId, 'Groceries', 'shopping', 0, new Date().toISOString(), new Date().toISOString());
    db.prepare('INSERT INTO lists (id, parentId, title, category, isRoutine, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('other_routine_1', otherParentId, 'Other Routine', 'routine', 1, new Date().toISOString(), new Date().toISOString());

    const shoppingRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        parentId,
        title: 'Bad Shopping Attach',
        startTime: new Date('2026-06-01T08:00:00').getTime(),
        endTime: new Date('2026-06-01T09:00:00').getTime(),
        color: '#ff0000',
        routineListId: 'shopping_list_1'
      });

    expect(shoppingRes.status).toBe(400);
    expect(shoppingRes.body.error).toBe('Invalid routine list');

    const otherFamilyRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        parentId,
        title: 'Bad Family Attach',
        startTime: new Date('2026-06-01T08:00:00').getTime(),
        endTime: new Date('2026-06-01T09:00:00').getTime(),
        color: '#ff0000',
        routineListId: 'other_routine_1'
      });

    expect(otherFamilyRes.status).toBe(400);
    expect(otherFamilyRes.body.error).toBe('Invalid routine list');
  });

  it('stores routine checklist completion per event without changing the routine template item', async () => {
    db.prepare('INSERT INTO lists (id, parentId, title, category, isRoutine, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('routine_list_1', parentId, 'Morning Routine', 'routine', 1, new Date().toISOString(), new Date().toISOString());
    db.prepare('INSERT INTO list_items (id, listId, text, completed) VALUES (?, ?, ?, ?)')
      .run('routine_item_1', 'routine_list_1', 'Brush Teeth', 0);

    const createA = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        parentId,
        title: 'School Morning',
        startTime: new Date('2026-06-01T08:00:00').getTime(),
        endTime: new Date('2026-06-01T09:00:00').getTime(),
        color: '#ff0000',
        routineListId: 'routine_list_1'
      });
    const createB = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        parentId,
        title: 'Weekend Morning',
        startTime: new Date('2026-06-02T08:00:00').getTime(),
        endTime: new Date('2026-06-02T09:00:00').getTime(),
        color: '#ff0000',
        routineListId: 'routine_list_1'
      });

    const eventA = createA.body.ids[0];
    const eventB = createB.body.ids[0];

    const toggle = await request(app)
      .put(`/api/events/${eventA}/routine-items/routine_item_1`)
      .set('Authorization', `Bearer ${kidToken}`)
      .send({ completed: true });

    expect(toggle.status).toBe(200);
    expect(toggle.body.completed).toBe(1);

    const eventAItems = await request(app)
      .get(`/api/events/${eventA}/routine-items`)
      .set('Authorization', `Bearer ${kidToken}`);
    const eventBItems = await request(app)
      .get(`/api/events/${eventB}/routine-items`)
      .set('Authorization', `Bearer ${kidToken}`);

    expect(eventAItems.body[0].completed).toBe(1);
    expect(eventBItems.body[0].completed).toBe(0);

    const templateItem = db.prepare('SELECT completed FROM list_items WHERE id = ?').get('routine_item_1') as { completed: number };
    expect(templateItem.completed).toBe(0);
  });

  it('detaches events and clears event routine progress when an attached routine list is deleted', async () => {
    db.prepare('INSERT INTO lists (id, parentId, title, category, isRoutine, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('routine_list_1', parentId, 'Morning Routine', 'routine', 1, new Date().toISOString(), new Date().toISOString());
    db.prepare('INSERT INTO list_items (id, listId, text, completed) VALUES (?, ?, ?, ?)')
      .run('routine_item_1', 'routine_list_1', 'Brush Teeth', 0);

    const create = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        parentId,
        title: 'School Morning',
        startTime: new Date('2026-06-01T08:00:00').getTime(),
        endTime: new Date('2026-06-01T09:00:00').getTime(),
        color: '#ff0000',
        routineListId: 'routine_list_1'
      });
    const eventId = create.body.ids[0];

    await request(app)
      .put(`/api/events/${eventId}/routine-items/routine_item_1`)
      .set('Authorization', `Bearer ${kidToken}`)
      .send({ completed: true });

    const del = await request(app)
      .delete('/api/lists/routine_list_1')
      .set('Authorization', `Bearer ${token}`);

    expect(del.status).toBe(200);

    const events = await request(app)
      .get(`/api/parents/${parentId}/events`)
      .set('Authorization', `Bearer ${token}`);
    expect(events.body[0].routineListId).toBeNull();

    const progressRows = db.prepare('SELECT * FROM event_routine_item_completions WHERE listItemId = ?')
      .all('routine_item_1');
    expect(progressRows).toHaveLength(0);
  });

  it('should create a weekly recurring event and expand to multiple rows', async () => {
    const startTime = new Date('2026-06-01T09:00:00').getTime();
    const endTime = new Date('2026-06-01T10:00:00').getTime();
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        parentId,
        title: 'Weekly Standup',
        startTime,
        endTime,
        color: '#3b82f6',
        recurrence: 'weekly',
        recurrenceEnd: '2026-06-29'
      });
    expect(res.status).toBe(200);
    const events = await request(app).get(`/api/parents/${parentId}/events`).set('Authorization', `Bearer ${token}`);
    // June 1, 8, 15, 22, 29 = 5 Mondays
    expect(events.body.length).toBe(5);
    expect(events.body.every((e: any) => e.masterId === events.body[0].masterId)).toBe(true);
  });

  it('should clamp monthly recurrence on day 31', async () => {
    const startTime = new Date('2026-01-31T09:00:00').getTime();
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        parentId,
        title: 'Monthly end',
        startTime,
        endTime: startTime + 3600000,
        color: '#ff0000',
        recurrence: 'monthly',
        recurrenceEnd: '2026-04-30'
      });
    expect(res.status).toBe(200);
    const events = await request(app).get(`/api/parents/${parentId}/events`).set('Authorization', `Bearer ${token}`);
    const dates = events.body.map((e: any) => new Date(e.startTime).getDate());
    // Jan 31, Feb 28, Mar 31, Apr 30
    expect(dates).toContain(28); // Feb clamped
    expect(dates).toContain(30); // Apr clamped
  });

  it('should delete a single recurring instance with scope=one', async () => {
    // Create weekly recurring (5 instances)
    await request(app).post('/api/events').set('Authorization', `Bearer ${token}`)
      .send({ parentId, title: 'Weekly', startTime: new Date('2026-06-01T09:00:00').getTime(), endTime: new Date('2026-06-01T10:00:00').getTime(), color: '#000', recurrence: 'weekly', recurrenceEnd: '2026-06-29' });
    let events = await request(app).get(`/api/parents/${parentId}/events`).set('Authorization', `Bearer ${token}`);
    expect(events.body.length).toBe(5);
    const secondId = events.body[1]?.id || events.body[0].id;
  
    await request(app).delete(`/api/events/${secondId}?scope=one`).set('Authorization', `Bearer ${token}`);
    events = await request(app).get(`/api/parents/${parentId}/events`).set('Authorization', `Bearer ${token}`);
    expect(events.body.length).toBe(4);
  });
  
  it('should delete this-and-future recurring instances', async () => {
    await request(app).post('/api/events').set('Authorization', `Bearer ${token}`)
      .send({ parentId, title: 'Weekly', startTime: new Date('2026-06-01T09:00:00').getTime(), endTime: new Date('2026-06-01T10:00:00').getTime(), color: '#000', recurrence: 'weekly', recurrenceEnd: '2026-06-29' });
    let events = await request(app).get(`/api/parents/${parentId}/events`).set('Authorization', `Bearer ${token}`);
    expect(events.body.length).toBe(5);
    const thirdId = events.body[2]?.id; 
    if (thirdId) {
      await request(app).delete(`/api/events/${thirdId}?scope=future`).set('Authorization', `Bearer ${token}`);
      events = await request(app).get(`/api/parents/${parentId}/events`).set('Authorization', `Bearer ${token}`);
      expect(events.body.length).toBe(2); // June 1 + 8 remain
    }
  });

  it('adds attendees to an event and lists them', async () => {
    const create = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        parentId,
        title: 'Trip',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        color: '#6366f1'
      });
    expect(create.status).toBe(200);
    const eventId = create.body.ids[0];

    const add = await request(app)
      .post(`/api/events/${eventId}/attendees`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: parentId });
    expect(add.status).toBe(200);

    const list = await request(app)
      .get(`/api/parents/${parentId}/events`)
      .set('Authorization', `Bearer ${token}`);
    const found = list.body.find((event: any) => event.id === eventId);
    expect(found.attendees).toHaveLength(1);
    expect(found.attendees[0].userId).toBe(parentId);
  });

  it('updates attendee RSVP', async () => {
    const create = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        parentId,
        title: 'Party',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        color: '#6366f1'
      });
    const eventId = create.body.ids[0];
    await request(app)
      .post(`/api/events/${eventId}/attendees`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: parentId });

    const patch = await request(app)
      .patch(`/api/events/${eventId}/attendees/${parentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rsvp: 'yes' });
    expect(patch.status).toBe(200);
  });

  it('forbids a kid from RSVP update for another user', async () => {
    const create = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        parentId,
        title: 'Party',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        color: '#6366f1'
      });
    const eventId = create.body.ids[0];
    await request(app).post(`/api/events/${eventId}/attendees`).set('Authorization', `Bearer ${token}`).send({ userId: parentId });

    const patch = await request(app)
      .patch(`/api/events/${eventId}/attendees/${parentId}`)
      .set('Authorization', `Bearer ${kidToken}`)
      .send({ rsvp: 'no' });
    expect(patch.status).toBe(403);
  });

  it('allows parent to remove an attendee', async () => {
    const create = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        parentId,
        title: 'Trip',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        color: '#6366f1'
      });
    const eventId = create.body.ids[0];
    await request(app)
      .post(`/api/events/${eventId}/attendees`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: kidId });

    const del = await request(app)
      .delete(`/api/events/${eventId}/attendees/${kidId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const list = await request(app)
      .get(`/api/parents/${parentId}/events`)
      .set('Authorization', `Bearer ${token}`);
    const found = list.body.find((event: any) => event.id === eventId);
    expect(found.attendees).toHaveLength(0);
  });

  it('forbids kid attendee removal', async () => {
    const create = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        parentId,
        title: 'Trip',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        color: '#6366f1'
      });
    const eventId = create.body.ids[0];
    await request(app)
      .post(`/api/events/${eventId}/attendees`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: kidId });

    const del = await request(app)
      .delete(`/api/events/${eventId}/attendees/${kidId}`)
      .set('Authorization', `Bearer ${kidToken}`);
    expect(del.status).toBe(403);
  });

  it('forbids kid from adding attendees', async () => {
    const create = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        parentId,
        title: 'Trip',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        color: '#6366f1'
      });
    const eventId = create.body.ids[0];
    const add = await request(app)
      .post(`/api/events/${eventId}/attendees`)
      .set('Authorization', `Bearer ${kidToken}`)
      .send({ userId: kidId });
    expect(add.status).toBe(403);
  });

  it('rejects adding non-family attendee', async () => {
    const create = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        parentId,
        title: 'Trip',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        color: '#6366f1'
      });
    const eventId = create.body.ids[0];
    const add = await request(app)
      .post(`/api/events/${eventId}/attendees`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: otherParentId });
    expect(add.status).toBe(400);
  });

  it('rejects attendee add with missing userId', async () => {
    const create = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        parentId,
        title: 'Trip',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        color: '#6366f1'
      });
    const eventId = create.body.ids[0];
    const add = await request(app)
      .post(`/api/events/${eventId}/attendees`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(add.status).toBe(400);
  });

  it('forbids non-family parent from RSVP updates', async () => {
    const create = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        parentId,
        title: 'Trip',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        color: '#6366f1'
      });
    const eventId = create.body.ids[0];
    await request(app)
      .post(`/api/events/${eventId}/attendees`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: kidId });

    const patch = await request(app)
      .patch(`/api/events/${eventId}/attendees/${kidId}`)
      .set('Authorization', `Bearer ${otherParentToken}`)
      .send({ rsvp: 'yes' });
    expect(patch.status).toBe(403);
  });

  it('forbids cross-family reads of parent events', async () => {
    await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        parentId,
        title: 'Private Event',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        color: '#6366f1'
      });

    const get = await request(app)
      .get(`/api/parents/${parentId}/events`)
      .set('Authorization', `Bearer ${otherParentToken}`);
    expect(get.status).toBe(403);
  });
});
