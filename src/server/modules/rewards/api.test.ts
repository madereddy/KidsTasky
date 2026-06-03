// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app, db } from '../../../../server.js';
import { getJwtSecret } from '../../config.js';

describe('Rewards API', () => {
  const parentId = 'rewards_api_parent';
  const kidId = 'rewards_api_kid';
  const otherKidId = 'rewards_api_other_kid';
  const parentToken = jwt.sign({ uid: parentId, role: 'parent', parentId }, getJwtSecret());
  const kidToken = jwt.sign({ uid: kidId, role: 'kid', parentId }, getJwtSecret());

  beforeEach(() => {
    db.prepare('DELETE FROM claimedRewards WHERE kidId IN (?, ?)').run(kidId, otherKidId);
    db.prepare('DELETE FROM rewards WHERE parentId = ?').run(parentId);
    db.prepare('DELETE FROM allowance_ledger WHERE parentId = ?').run(parentId);
    db.prepare('DELETE FROM users WHERE uid IN (?, ?, ?)').run(parentId, kidId, otherKidId);
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId, xp, level, earnedStars, spentStars) VALUES (?, 'parent', 'Parent', 'rewards@test.com', ?, 0, 1, 0, 0)").run(parentId, parentId);
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId, xp, level, earnedStars, spentStars) VALUES (?, 'kid', 'Kid', 'kid@test.com', ?, 200, 2, 50, 0)").run(kidId, parentId);
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId, xp, level, earnedStars, spentStars) VALUES (?, 'kid', 'Other Kid', 'other@test.com', ?, 200, 2, 50, 0)").run(otherKidId, parentId);
  });

  it('POST /claimedRewards returns claimed reward payload and authoritative balances', async () => {
    const createReward = await request(app)
      .post('/api/rewards')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ title: 'Extra Screen Time', description: '30 min', xpCost: 100, starCost: 10 });
    const rewardId = createReward.body.id as string;

    const claim = await request(app)
      .post('/api/claimedRewards')
      .set('Authorization', `Bearer ${kidToken}`)
      .send({ kidId, rewardId, xpCost: 0 });

    expect(claim.status).toBe(200);
    expect(claim.body).toMatchObject({
      claimedReward: expect.objectContaining({
        kidId,
        rewardId,
      }),
      balances: expect.objectContaining({
        xp: 100,
        spentStars: 10,
      }),
    });
    expect(claim.body.claimedReward.createdAt).toEqual(expect.objectContaining({ seconds: expect.any(Number) }));

    const kid = db.prepare('SELECT xp, spentStars FROM users WHERE uid = ?').get(kidId) as any;
    expect(kid.xp).toBe(100);
    expect(kid.spentStars).toBe(10);
  });

  it('forbids a kid from claiming a reward for a sibling', async () => {
    const createReward = await request(app)
      .post('/api/rewards')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ title: 'Extra Screen Time', description: '30 min', xpCost: 100 });
    const rewardId = createReward.body.id as string;

    const claim = await request(app)
      .post('/api/claimedRewards')
      .set('Authorization', `Bearer ${kidToken}`)
      .send({ kidId: otherKidId, rewardId, xpCost: 100 });

    expect(claim.status).toBe(403);
  });
});
