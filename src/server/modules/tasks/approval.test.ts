// src/server/modules/tasks/approval.test.ts
// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../../server.js';
import { db } from '../../db.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../../config.js';
import { taskServiceServer } from './service.js';
import { levelForXp } from '../../../lib/xp.js';

describe('Task Completion Approval', () => {
  const parentId = 'approval_parent_test';
  const kidId = 'approval_kid_test';
  const parentToken = jwt.sign({ uid: parentId, role: 'parent', parentId }, getJwtSecret());

  beforeEach(() => {
    db.prepare("DELETE FROM completions WHERE taskId LIKE 'approval_task%'").run();
    db.prepare('DELETE FROM tasks WHERE parentId = ?').run(parentId);
    db.prepare('DELETE FROM users WHERE uid IN (?, ?)').run(parentId, kidId);
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId) VALUES (?, ?, ?, ?, ?)").run(parentId, 'parent', 'Test Parent', 'approval@test.com', parentId);
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId, earnedStars) VALUES (?, ?, ?, ?, ?, ?)").run(kidId, 'kid', 'Test Kid', 'kid@test.com', parentId, 0);
  });

  it('creates a pending completion when task requiresApproval=1', () => {
    db.prepare("INSERT INTO tasks (id, title, frequency, assignedKidId, parentId, status, createdAt, requiresApproval, starValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      'approval_task_1', 'Clean Room', 'daily', kidId, parentId, 'active', Date.now(), 1, 2
    );

    const result = taskServiceServer.createCompletion({
      taskId: 'approval_task_1',
      kidId,
      dateString: '2026-01-01',
    });

    expect(result.approvalStatus).toBe('pending');
    const row = db.prepare('SELECT * FROM completions WHERE id = ?').get(result.id) as any;
    expect(row.approvalStatus).toBe('pending');

    // Stars should NOT be awarded yet
    const kid = db.prepare('SELECT earnedStars FROM users WHERE uid = ?').get(kidId) as any;
    expect(kid.earnedStars).toBe(0);
  });

  it('createTask defaults requiresApproval to enabled', () => {
    const taskId = taskServiceServer.createTask({
      title: 'Default Approval Task',
      frequency: 'daily',
      assignedKidId: kidId,
      parentId,
      starValue: 1,
    });

    const task = db.prepare('SELECT requiresApproval FROM tasks WHERE id = ?').get(taskId) as any;
    expect(task.requiresApproval).toBe(1);

    const completion = taskServiceServer.createCompletion({
      taskId,
      kidId,
      dateString: '2026-01-07',
    });
    expect(completion.approvalStatus).toBe('pending');
  });

  it('createTask honors requiresApproval=false when provided', () => {
    const taskId = taskServiceServer.createTask({
      title: 'No Approval Task',
      frequency: 'daily',
      assignedKidId: kidId,
      parentId,
      starValue: 1,
      requiresApproval: false,
    });

    const task = db.prepare('SELECT requiresApproval FROM tasks WHERE id = ?').get(taskId) as any;
    expect(task.requiresApproval).toBe(0);

    const completion = taskServiceServer.createCompletion({
      taskId,
      kidId,
      dateString: '2026-01-08',
    });
    expect(completion.approvalStatus).toBe('approved');
  });

  it('creates an approved completion when task requiresApproval=0', () => {
    db.prepare("INSERT INTO tasks (id, title, frequency, assignedKidId, parentId, status, createdAt, requiresApproval, starValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      'approval_task_2', 'Brush Teeth', 'daily', kidId, parentId, 'active', Date.now(), 0, 1
    );

    const result = taskServiceServer.createCompletion({
      taskId: 'approval_task_2',
      kidId,
      dateString: '2026-01-01',
    });

    expect(result.approvalStatus).toBe('approved');
    const kid = db.prepare('SELECT earnedStars FROM users WHERE uid = ?').get(kidId) as any;
    expect(kid.earnedStars).toBe(1);
  });

  it('approves a pending completion and awards stars', () => {
    db.prepare("INSERT INTO tasks (id, title, frequency, assignedKidId, parentId, status, createdAt, requiresApproval, starValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      'approval_task_3', 'Do Homework', 'daily', kidId, parentId, 'active', Date.now(), 1, 3
    );

    const result = taskServiceServer.createCompletion({
      taskId: 'approval_task_3',
      kidId,
      dateString: '2026-01-02',
    });
    expect(result.approvalStatus).toBe('pending');

    taskServiceServer.approveCompletion(result.id);

    const row = db.prepare('SELECT * FROM completions WHERE id = ?').get(result.id) as any;
    expect(row.approvalStatus).toBe('approved');

    const kid = db.prepare('SELECT earnedStars FROM users WHERE uid = ?').get(kidId) as any;
    expect(kid.earnedStars).toBe(3);
  });

  it('rejects a pending completion and does not award stars', () => {
    db.prepare("INSERT INTO tasks (id, title, frequency, assignedKidId, parentId, status, createdAt, requiresApproval, starValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      'approval_task_4', 'Take Out Trash', 'weekly', kidId, parentId, 'active', Date.now(), 1, 2
    );

    const result = taskServiceServer.createCompletion({
      taskId: 'approval_task_4',
      kidId,
      dateString: '2026-01-03',
    });

    taskServiceServer.rejectCompletion(result.id);

    const row = db.prepare('SELECT * FROM completions WHERE id = ?').get(result.id) as any;
    expect(row.approvalStatus).toBe('rejected');

    const kid = db.prepare('SELECT earnedStars FROM users WHERE uid = ?').get(kidId) as any;
    expect(kid.earnedStars).toBe(0);
  });

  it('GET /parents/:parentId/pending-completions returns only pending', async () => {
    db.prepare("INSERT INTO tasks (id, title, frequency, assignedKidId, parentId, status, createdAt, requiresApproval, starValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      'approval_task_5', 'Walk Dog', 'daily', kidId, parentId, 'active', Date.now(), 1, 1
    );

    const result = taskServiceServer.createCompletion({
      taskId: 'approval_task_5',
      kidId,
      dateString: '2026-01-04',
    });
    expect(result.approvalStatus).toBe('pending');

    const res = await request(app)
      .get(`/api/parents/${parentId}/pending-completions`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: result.id, taskTitle: 'Walk Dog', approvalStatus: 'pending' }),
    ]));
  });

  it('PATCH /completions/:id/approve awards stars via API', async () => {
    db.prepare("INSERT INTO tasks (id, title, frequency, assignedKidId, parentId, status, createdAt, requiresApproval, starValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      'approval_task_6', 'Feed Cat', 'daily', kidId, parentId, 'active', Date.now(), 1, 2
    );

    const result = taskServiceServer.createCompletion({
      taskId: 'approval_task_6',
      kidId,
      dateString: '2026-01-05',
    });

    const res = await request(app)
      .patch(`/api/completions/${result.id}/approve`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const kid = db.prepare('SELECT earnedStars FROM users WHERE uid = ?').get(kidId) as any;
    expect(kid.earnedStars).toBe(2);
  });

  it('PATCH /completions/:id/reject marks rejected via API', async () => {
    db.prepare("INSERT INTO tasks (id, title, frequency, assignedKidId, parentId, status, createdAt, requiresApproval, starValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      'approval_task_7', 'Vacuum', 'weekly', kidId, parentId, 'active', Date.now(), 1, 1
    );

    const result = taskServiceServer.createCompletion({
      taskId: 'approval_task_7',
      kidId,
      dateString: '2026-01-06',
    });

    const res = await request(app)
      .patch(`/api/completions/${result.id}/reject`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    const row = db.prepare('SELECT approvalStatus FROM completions WHERE id = ?').get(result.id) as any;
    expect(row.approvalStatus).toBe('rejected');
  });

  it('awards XP server-side on an auto-approved completion (by difficulty)', () => {
    db.prepare("INSERT INTO tasks (id, title, frequency, assignedKidId, parentId, status, createdAt, requiresApproval, starValue, difficulty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      'approval_task_xp1', 'Hard Chore', 'daily', kidId, parentId, 'active', Date.now(), 0, 1, 'hard'
    );
    const before = db.prepare('SELECT xp FROM users WHERE uid = ?').get(kidId) as any;
    const result = taskServiceServer.createCompletion({ taskId: 'approval_task_xp1', kidId, dateString: '2026-02-01' });
    expect(result.approvalStatus).toBe('approved');
    const after = db.prepare('SELECT xp, level FROM users WHERE uid = ?').get(kidId) as any;
    expect(after.xp).toBe((before?.xp || 0) + 50);   // hard = 50
    expect(after.level).toBe(levelForXp(after.xp));  // RuneScape-style curve
  });

  it('does NOT award XP for a pending completion until approved', () => {
    db.prepare("INSERT INTO tasks (id, title, frequency, assignedKidId, parentId, status, createdAt, requiresApproval, starValue, difficulty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      'approval_task_xp2', 'Medium Chore', 'daily', kidId, parentId, 'active', Date.now(), 1, 1, 'medium'
    );
    const before = (db.prepare('SELECT xp FROM users WHERE uid = ?').get(kidId) as any)?.xp || 0;
    const result = taskServiceServer.createCompletion({ taskId: 'approval_task_xp2', kidId, dateString: '2026-02-02' });
    expect(result.approvalStatus).toBe('pending');
    expect((db.prepare('SELECT xp FROM users WHERE uid = ?').get(kidId) as any).xp ?? 0).toBe(before); // no XP yet

    taskServiceServer.approveCompletion(result.id);
    expect((db.prepare('SELECT xp FROM users WHERE uid = ?').get(kidId) as any).xp ?? 0).toBe(before + 25); // medium = 25
  });

  it('revokes XP when an approved completion is deleted, never below 0', () => {
    db.prepare("INSERT INTO tasks (id, title, frequency, assignedKidId, parentId, status, createdAt, requiresApproval, starValue, difficulty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      'approval_task_xp3', 'Easy Chore', 'daily', kidId, parentId, 'active', Date.now(), 0, 1, 'easy'
    );
    const result = taskServiceServer.createCompletion({ taskId: 'approval_task_xp3', kidId, dateString: '2026-02-03' });
    const awarded = (db.prepare('SELECT xp FROM users WHERE uid = ?').get(kidId) as any).xp;
    expect(awarded).toBeGreaterThanOrEqual(10); // easy = 10
    taskServiceServer.deleteCompletion(result.id);
    const afterDelete = (db.prepare('SELECT xp FROM users WHERE uid = ?').get(kidId) as any).xp;
    expect(afterDelete).toBe(awarded - 10);
    expect(afterDelete).toBeGreaterThanOrEqual(0);
  });

  it('blocks a kid completing a task assigned to a sibling', async () => {
    const sibling = 'approval_sibling_kid';
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, parentId, earnedStars) VALUES (?, 'kid', 'Sibling', ?, 0)").run(sibling, parentId);
    const siblingToken = jwt.sign({ uid: sibling, role: 'kid', parentId }, getJwtSecret());
    db.prepare("INSERT INTO tasks (id, title, frequency, assignedKidId, parentId, status, createdAt, requiresApproval, starValue, difficulty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      'approval_task_assign', 'Sibling Only', 'daily', kidId, parentId, 'active', Date.now(), 0, 1, 'easy'
    );

    const res = await request(app)
      .post('/api/completions')
      .set('Authorization', `Bearer ${siblingToken}`)
      .send({ taskId: 'approval_task_assign', kidId: sibling, dateString: '2026-03-01' });

    expect(res.status).toBe(403);
    const row = db.prepare("SELECT * FROM completions WHERE taskId = 'approval_task_assign'").get();
    expect(row).toBeFalsy();
    db.prepare('DELETE FROM users WHERE uid = ?').run(sibling);
  });

  it('allows any kid to complete an up-for-grabs (assignedKidId="all") task', async () => {
    const kidToken = jwt.sign({ uid: kidId, role: 'kid', parentId }, getJwtSecret());
    db.prepare("INSERT INTO tasks (id, title, frequency, assignedKidId, parentId, status, createdAt, requiresApproval, starValue, difficulty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      'approval_task_grab', 'Up For Grabs', 'daily', 'all', parentId, 'active', Date.now(), 0, 1, 'easy'
    );
    const res = await request(app)
      .post('/api/completions')
      .set('Authorization', `Bearer ${kidToken}`)
      .send({ taskId: 'approval_task_grab', kidId, dateString: '2026-03-02' });
    expect(res.status).toBe(200);
  });

  it('persists task verification questions and question kid scope', () => {
    const taskId = taskServiceServer.createTask({
      title: 'Room Cleanup',
      frequency: 'daily',
      assignedKidId: kidId,
      parentId,
      starValue: 1,
      completionQuestions: ['Are clothes in hamper?', 'Is floor clean?'],
      completionQuestionsKidId: kidId,
    });

    const row = db.prepare('SELECT completionQuestions, completionQuestionsKidId FROM tasks WHERE id = ?').get(taskId) as any;
    expect(row.completionQuestionsKidId).toBe(kidId);
    expect(JSON.parse(row.completionQuestions)).toEqual(['Are clothes in hamper?', 'Is floor clean?']);
  });

  it('stores proof answers on completion and exposes them in kid completions API', async () => {
    db.prepare("INSERT INTO tasks (id, title, frequency, assignedKidId, parentId, status, createdAt, requiresApproval, starValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      'approval_task_8', 'Daily Tidy', 'daily', kidId, parentId, 'active', Date.now(), 1, 1
    );

    const dateString = '2026-01-09';
    const completeRes = await request(app)
      .post('/api/completions')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        taskId: 'approval_task_8',
        kidId,
        dateString,
        proofAnswers: [
          { question: 'Are clothes in hamper?', answer: 'Yes' },
          { question: 'Is floor clean?', answer: 'Yes' },
        ],
      });

    expect(completeRes.status).toBe(200);
    const row = db.prepare('SELECT proofAnswers FROM completions WHERE id = ?').get(completeRes.body.id) as any;
    expect(JSON.parse(row.proofAnswers)).toEqual([
      { question: 'Are clothes in hamper?', answer: 'Yes' },
      { question: 'Is floor clean?', answer: 'Yes' },
    ]);

    const listRes = await request(app)
      .get(`/api/kids/${kidId}/completions?dateString=${dateString}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    const completion = listRes.body.find((c: any) => c.id === completeRes.body.id);
    expect(completion).toBeTruthy();
    expect(completion.proofAnswers).toEqual([
      { question: 'Are clothes in hamper?', answer: 'Yes' },
      { question: 'Is floor clean?', answer: 'Yes' },
    ]);
  });

  it('POST /completions returns created=false on duplicate completion instead of re-awarding', async () => {
    const kidToken = jwt.sign({ uid: kidId, role: 'kid', parentId }, getJwtSecret());
    db.prepare("INSERT INTO tasks (id, title, frequency, assignedKidId, parentId, status, createdAt, requiresApproval, starValue, difficulty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      'approval_task_duplicate', 'Morning Routine', 'daily', kidId, parentId, 'active', Date.now(), 0, 2, 'medium'
    );

    const payload = {
      taskId: 'approval_task_duplicate',
      kidId,
      dateString: '2026-01-10',
    };

    const firstRes = await request(app)
      .post('/api/completions')
      .set('Authorization', `Bearer ${kidToken}`)
      .send(payload);

    expect(firstRes.status).toBe(200);
    expect(firstRes.body).toMatchObject({
      approvalStatus: 'approved',
      created: true,
    });

    const secondRes = await request(app)
      .post('/api/completions')
      .set('Authorization', `Bearer ${kidToken}`)
      .send(payload);

    expect(secondRes.status).toBe(200);
    expect(secondRes.body).toMatchObject({
      id: firstRes.body.id,
      approvalStatus: 'approved',
      created: false,
    });

    const kid = db.prepare('SELECT earnedStars, xp FROM users WHERE uid = ?').get(kidId) as any;
    expect(kid.earnedStars).toBe(2);
    expect(kid.xp).toBe(25);
    const completionCount = db.prepare("SELECT COUNT(*) as count FROM completions WHERE taskId = 'approval_task_duplicate'").get() as any;
    expect(completionCount.count).toBe(1);
  });

  it('PATCH /tasks/:taskId updates editable task fields for parent', async () => {
    const createdId = taskServiceServer.createTask({
      title: 'Original',
      frequency: 'daily',
      assignedKidId: kidId,
      parentId,
      starValue: 1,
    });

    const res = await request(app)
      .patch(`/api/tasks/${createdId}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        title: 'Updated Mission',
        frequency: 'weekdays',
        starValue: 3,
        completionQuestions: ['Did you actually do it?'],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const row = db.prepare('SELECT title, frequency, starValue, completionQuestions FROM tasks WHERE id = ?').get(createdId) as any;
    expect(row.title).toBe('Updated Mission');
    expect(row.frequency).toBe('weekdays');
    expect(row.starValue).toBe(3);
    expect(JSON.parse(row.completionQuestions)).toEqual(['Did you actually do it?']);
  });
});
