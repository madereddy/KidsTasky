// src/server/modules/events/api.test.ts
// @vitest-environment node
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app, db } from '../../../../server.js';

describe('Events API', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM events').run();
  });

  afterAll(() => {
    // We don't close the DB here if it's shared, but server.test.ts might
  });

  it('should POST and GET events for a parent', async () => {
    const postRes = await request(app)
      .post('/api/events')
      .send({
        parentId: 'parent_api_1',
        title: 'Dentist Appt',
        description: 'Teeth cleaning',
        startTime: 1713950000,
        endTime: 1713953600,
        assignedToId: 'kid_2',
        color: '#00FF00'
      });
      
    expect(postRes.status).toBe(200);
    expect(postRes.body.success).toBe(true);

    const getRes = await request(app).get('/api/parents/parent_api_1/events');
    expect(getRes.status).toBe(200);
    expect(getRes.body.length).toBe(1);
    expect(getRes.body[0].title).toBe('Dentist Appt');
  });
});
