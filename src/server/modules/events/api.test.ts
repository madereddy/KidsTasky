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

  beforeEach(() => {
    db.prepare('DELETE FROM events').run();
    db.prepare('DELETE FROM users WHERE uid = ?').run(parentId);
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId) VALUES (?, ?, ?, ?, ?)").run(parentId, 'parent', 'Test Parent', 'events@test.com', parentId);
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
});
