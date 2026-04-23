import { Router } from 'express';
import { db } from './db.js';
import { body, param, query, validationResult } from 'express-validator';

const router = Router();

// Validation middleware helper
const validate = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Simple Auth
router.post("/auth/login", [
  body('name').isString().trim().notEmpty(),
  validate
], (req: any, res: any) => {
  const { name } = req.body;
  let user = db.prepare("SELECT * FROM users WHERE name = ? COLLATE NOCASE").get(name) as any;
  if (user) {
    user.badges = JSON.parse(user.badges || "[]");
    return res.json({ user });
  }
  // Return a mock uninitialized user
  const mockUid = "user_" + Date.now().toString(36) + Math.random().toString(36).substr(2);
  res.json({ user: { uid: mockUid, name, role: null, email: name.toLowerCase() + "@example.com" } });
});

router.get("/auth/me", (req, res) => {
  const uid = req.headers['authorization'];
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  const user = db.prepare("SELECT * FROM users WHERE uid = ?").get(uid) as any;
  if (user) {
    user.badges = JSON.parse(user.badges || "[]");
    return res.json({ user });
  }
  res.status(401).json({ error: "User not found" });
});

// Users
router.get("/users/:uid", [
  param('uid').isString().notEmpty(),
  validate
], (req: any, res: any) => {
  const user = db.prepare("SELECT * FROM users WHERE uid = ?").get(req.params.uid) as any;
  if (user) {
     user.badges = JSON.parse(user.badges || "[]");
     return res.json(user);
  }
  res.status(404).json({ error: "Not found" });
});

router.post("/users", [
  body('uid').isString().notEmpty(),
  body('role').isString().optional(),
  body('name').isString().notEmpty(),
  body('email').isEmail().optional(),
  body('parentId').isString().optional(),
  body('xp').isInt({min: 0}).optional(),
  body('level').isInt({min: 1}).optional(),
  body('badges').isArray().optional(),
  body('themeId').isString().optional(),
  validate
], (req: any, res: any) => {
  const { uid, role, name, email, parentId, xp, level, badges, themeId } = req.body;
  db.prepare(`
    INSERT OR REPLACE INTO users (uid, role, name, email, parentId, xp, level, badges, themeId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uid, role, name, email, parentId || null, xp || 0, level || 1, JSON.stringify(badges || []), themeId || null);
  res.json({ success: true });
});

router.post("/users/:uid/badge", [
  param('uid').isString().notEmpty(),
  body('badgeId').isString().notEmpty(),
  validate
], (req: any, res: any) => {
  const { badgeId } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE uid = ?").get(req.params.uid) as any;
  if (user) {
    const badges = JSON.parse(user.badges || "[]");
    if (!badges.some((b: any) => b.id === badgeId)) {
      badges.push({ id: badgeId, earnedAt: Date.now() });
      db.prepare("UPDATE users SET badges = ? WHERE uid = ?").run(JSON.stringify(badges), req.params.uid);
    }
  }
  res.json({ success: true });
});

router.post("/users/:uid/xp", [
  param('uid').isString().notEmpty(),
  body('xpChange').isInt(),
  validate
], (req: any, res: any) => {
  const { xpChange } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE uid = ?").get(req.params.uid) as any;
  if (user) {
    const newXP = Math.max(0, (user.xp || 0) + xpChange);
    const newLevel = Math.floor(newXP / 100) + 1;
    db.prepare("UPDATE users SET xp = ?, level = ? WHERE uid = ?").run(newXP, newLevel, req.params.uid);
  }
  res.json({ success: true });
});

router.post("/users/:uid/theme", [
  param('uid').isString().notEmpty(),
  body('themeId').isString().notEmpty(),
  validate
], (req: any, res: any) => {
  const { themeId } = req.body;
  db.prepare("UPDATE users SET themeId = ? WHERE uid = ?").run(themeId, req.params.uid);
  res.json({ success: true });
});

router.get("/parents/:parentId/kids", [
  param('parentId').isString().notEmpty(),
  validate
], (req: any, res: any) => {
  const kids = db.prepare("SELECT * FROM users WHERE parentId = ? AND role = 'kid'").all(req.params.parentId) as any[];
  kids.forEach(k => k.badges = JSON.parse(k.badges || "[]"));
  res.json(kids);
});

// Tasks
router.post("/tasks", [
  body('title').isString().notEmpty(),
  body('assignedKidId').isString().notEmpty(),
  body('parentId').isString().notEmpty(),
  body('frequency').isString().notEmpty(),
  validate
], (req: any, res: any) => {
  const task = req.body;
  const id = "task_" + Date.now().toString(36) + Math.random().toString(36).substr(2);
  const prereqs = task.prerequisiteTaskIds ? JSON.stringify(task.prerequisiteTaskIds) : "[]";
  
  db.prepare(`
    INSERT INTO tasks (id, title, description, frequency, reminderTime, assignedKidId, parentId, categoryId, difficulty, status, createdAt, customInterval, prerequisiteTaskIds)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, task.title, task.description || null, task.frequency, task.reminderTime || null, task.assignedKidId, task.parentId, task.categoryId || null, task.difficulty || 'easy', 'active', Date.now(), task.customInterval || null, prereqs);
  res.json({ id });
});

router.get("/kids/:kidId/tasks", [
  param('kidId').isString().notEmpty(),
  validate
], (req: any, res: any) => {
  const tasks = db.prepare("SELECT * FROM tasks WHERE assignedKidId = ? AND status = 'active' ORDER BY createdAt DESC").all(req.params.kidId);
  res.json(tasks.map((t: any) => {
    let parsedPrereqs = [];
    try { parsedPrereqs = JSON.parse(t.prerequisiteTaskIds || "[]"); } catch (e) {}
    return { ...t, createdAt: { seconds: t.createdAt / 1000 }, prerequisiteTaskIds: parsedPrereqs };
  }));
});

router.get("/parents/:parentId/tasks", [
  param('parentId').isString().notEmpty(),
  validate
], (req: any, res: any) => {
  const tasks = db.prepare("SELECT * FROM tasks WHERE parentId = ? AND status = 'active' ORDER BY createdAt DESC").all(req.params.parentId);
  res.json(tasks.map((t: any) => {
    let parsedPrereqs = [];
    try { parsedPrereqs = JSON.parse(t.prerequisiteTaskIds || "[]"); } catch (e) {}
    return { ...t, createdAt: { seconds: t.createdAt / 1000 }, prerequisiteTaskIds: parsedPrereqs };
  }));
});

router.put("/tasks/:taskId/archive", [
  param('taskId').isString().notEmpty(),
  validate
], (req: any, res: any) => {
  db.prepare("UPDATE tasks SET status = 'archived' WHERE id = ?").run(req.params.taskId);
  res.json({ success: true });
});

// Completions
router.post("/completions", [
  body('taskId').isString().notEmpty(),
  body('kidId').isString().notEmpty(),
  body('dateString').isString().notEmpty(),
  body('count').isInt().optional(),
  validate
], (req: any, res: any) => {
  const { taskId, kidId, dateString, count } = req.body;
  const id = `${taskId}_${dateString}_${count || 1}`;
  db.prepare(`
    INSERT OR REPLACE INTO completions (id, taskId, kidId, completedAt, dateString, count)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, taskId, kidId, Date.now(), dateString, count || null);
  res.json({ id });
});

router.delete("/completions/:completionId", [
  param('completionId').isString().notEmpty(),
  validate
], (req: any, res: any) => {
  db.prepare("DELETE FROM completions WHERE id = ?").run(req.params.completionId);
  res.json({ success: true });
});

router.get("/kids/:kidId/completions", [
  param('kidId').isString().notEmpty(),
  query('dateString').isString().optional(),
  query('startDate').isString().optional(),
  query('endDate').isString().optional(),
  validate
], (req: any, res: any) => {
  const { dateString, startDate, endDate } = req.query;
  let completions;
  if (startDate && endDate) {
    completions = db.prepare("SELECT * FROM completions WHERE kidId = ? AND dateString >= ? AND dateString <= ?").all(req.params.kidId, startDate, endDate);
  } else if (dateString) {
    completions = db.prepare("SELECT * FROM completions WHERE kidId = ? AND dateString = ?").all(req.params.kidId, dateString);
  } else {
    res.status(400).json({ error: "Missing date query params" });
    return;
  }
  res.json(completions.map((c: any) => ({ ...c, completedAt: { seconds: c.completedAt / 1000 } })));
});

router.get("/kids/:kidId/history", [
  param('kidId').isString().notEmpty(),
  query('limit').isInt().optional(),
  validate
], (req: any, res: any) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const history = db.prepare("SELECT * FROM completions WHERE kidId = ? ORDER BY completedAt DESC LIMIT ?").all(req.params.kidId, limit);
  res.json(history.map((c: any) => ({ ...c, completedAt: { seconds: c.completedAt / 1000 } })));
});

// Categories
router.post("/categories", [
  body('name').isString().notEmpty(),
  body('icon').isString().optional(),
  body('color').isString().optional(),
  body('parentId').isString().notEmpty(),
  validate
], (req: any, res: any) => {
  const cat = req.body;
  const id = "cat_" + Date.now().toString(36);
  db.prepare("INSERT INTO categories (id, name, icon, color, parentId) VALUES (?, ?, ?, ?, ?)").run(id, cat.name, cat.icon, cat.color, cat.parentId);
  res.json({ id });
});

router.put("/categories/:id", [
  param('id').isString().notEmpty(),
  body('name').isString().notEmpty(),
  body('icon').isString().optional(),
  body('color').isString().optional(),
  body('parentId').isString().notEmpty(),
  validate
], (req: any, res: any) => {
  const cat = req.body;
  db.prepare("UPDATE categories SET name = ?, icon = ?, color = ?, parentId = ? WHERE id = ?").run(cat.name, cat.icon, cat.color, cat.parentId, req.params.id);
  res.json({ success: true });
});

router.delete("/categories/:id", [
  param('id').isString().notEmpty(),
  validate
], (req: any, res: any) => {
  db.prepare("DELETE FROM categories WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

router.get("/parents/:parentId/categories", [
  param('parentId').isString().notEmpty(),
  validate
], (req: any, res: any) => {
  const cats = db.prepare("SELECT * FROM categories WHERE parentId = ?").all(req.params.parentId);
  res.json(cats);
});

// Invites
router.post("/invites", [
  body('parentId').isString().notEmpty(),
  body('parentName').isString().notEmpty(),
  validate
], (req: any, res: any) => {
  const { parentId, parentName } = req.body;
  const id = Math.random().toString(36).substring(2, 8).toUpperCase();
  db.prepare("INSERT INTO invites (id, parentId, parentName, createdAt, status) VALUES (?, ?, ?, ?, ?)").run(id, parentId, parentName, Date.now(), 'active');
  res.json({ id });
});

router.get("/parents/:parentId/invites/active", [
  param('parentId').isString().notEmpty(),
  validate
], (req: any, res: any) => {
  const invite = db.prepare("SELECT * FROM invites WHERE parentId = ? AND status = 'active'").get(req.params.parentId);
  res.json(invite || null);
});

router.get("/invites/:code/validate", [
  param('code').isString().notEmpty(),
  validate
], (req: any, res: any) => {
  const invite = db.prepare("SELECT * FROM invites WHERE id = ? AND status = 'active'").get(req.params.code);
  res.json(invite || null);
});

// Notifications
router.get("/parents/:parentId/notifications", [
  param('parentId').isString().notEmpty(),
  validate
], (req: any, res: any) => {
  const notifs = db.prepare("SELECT * FROM notifications WHERE parentId = ? AND status = 'unread' ORDER BY createdAt DESC").all(req.params.parentId);
  res.json(notifs.map((n: any) => ({ ...n, createdAt: { seconds: n.createdAt / 1000 } })));
});

router.put("/notifications/:id/read", [
  param('id').isString().notEmpty(),
  validate
], (req: any, res: any) => {
  db.prepare("UPDATE notifications SET status = 'read' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// Rewards
router.get("/parents/:parentId/rewards", [
  param('parentId').isString().notEmpty(),
  validate
], (req: any, res: any) => {
  const rewards = db.prepare("SELECT * FROM rewards WHERE parentId = ?").all(req.params.parentId);
  res.json(rewards);
});

router.post("/rewards", [
  body('parentId').isString().notEmpty(),
  body('title').isString().notEmpty(),
  body('description').isString().optional(),
  body('xpCost').isInt({min: 0}),
  validate
], (req: any, res: any) => {
  const { parentId, title, description, xpCost } = req.body;
  const id = "reward_" + Date.now().toString(36) + Math.random().toString(36).substr(2);
  db.prepare("INSERT INTO rewards (id, parentId, title, description, xpCost) VALUES (?, ?, ?, ?, ?)").run(id, parentId, title, description, xpCost);
  res.json({ id });
});

router.delete("/rewards/:id", [
  param('id').isString().notEmpty(),
  validate
], (req: any, res: any) => {
  db.prepare("DELETE FROM rewards WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

router.get("/kids/:kidId/claimedRewards", [
  param('kidId').isString().notEmpty(),
  validate
], (req: any, res: any) => {
  const claimed = db.prepare("SELECT * FROM claimedRewards WHERE kidId = ?").all(req.params.kidId);
  res.json(claimed.map((c: any) => ({ ...c, createdAt: { seconds: c.createdAt / 1000 } })));
});

router.post("/claimedRewards", [
  body('kidId').isString().notEmpty(),
  body('rewardId').isString().notEmpty(),
  body('xpCost').isInt({min: 0}),
  validate
], (req: any, res: any) => {
  const { kidId, rewardId, xpCost } = req.body;
  const id = "claim_" + Date.now().toString(36) + Math.random().toString(36).substr(2);
  db.prepare("INSERT INTO claimedRewards (id, kidId, rewardId, createdAt) VALUES (?, ?, ?, ?)").run(id, kidId, rewardId, Date.now());
  
  // Consume XP
  const user = db.prepare("SELECT xp FROM users WHERE uid = ?").get(kidId) as any;
  if (user) {
    const newXP = Math.max(0, (user.xp || 0) - xpCost);
    const newLevel = Math.floor(newXP / 100) + 1;
    db.prepare("UPDATE users SET xp = ?, level = ? WHERE uid = ?").run(newXP, newLevel, kidId);
  }
  
  res.json({ id });
});

export const apiRouter = router;
