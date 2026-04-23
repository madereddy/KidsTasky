import { Router } from 'express';
import { db } from './db.js';

const router = Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Simple Auth
router.post("/auth/login", (req, res) => {
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
router.get("/users/:uid", (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE uid = ?").get(req.params.uid) as any;
  if (user) {
     user.badges = JSON.parse(user.badges || "[]");
     return res.json(user);
  }
  res.status(404).json({ error: "Not found" });
});

router.post("/users", (req, res) => {
  const { uid, role, name, email, parentId, xp, level, badges, themeId } = req.body;
  db.prepare(`
    INSERT OR REPLACE INTO users (uid, role, name, email, parentId, xp, level, badges, themeId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uid, role, name, email, parentId || null, xp || 0, level || 1, JSON.stringify(badges || []), themeId || null);
  res.json({ success: true });
});

router.post("/users/:uid/badge", (req, res) => {
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

router.post("/users/:uid/xp", (req, res) => {
  const { xpChange } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE uid = ?").get(req.params.uid) as any;
  if (user) {
    const newXP = Math.max(0, (user.xp || 0) + xpChange);
    const newLevel = Math.floor(newXP / 100) + 1;
    db.prepare("UPDATE users SET xp = ?, level = ? WHERE uid = ?").run(newXP, newLevel, req.params.uid);
  }
  res.json({ success: true });
});

router.post("/users/:uid/theme", (req, res) => {
  const { themeId } = req.body;
  db.prepare("UPDATE users SET themeId = ? WHERE uid = ?").run(themeId, req.params.uid);
  res.json({ success: true });
});

router.get("/parents/:parentId/kids", (req, res) => {
  const kids = db.prepare("SELECT * FROM users WHERE parentId = ? AND role = 'kid'").all(req.params.parentId) as any[];
  kids.forEach(k => k.badges = JSON.parse(k.badges || "[]"));
  res.json(kids);
});

// Tasks
router.post("/tasks", (req, res) => {
  const task = req.body;
  const id = "task_" + Date.now().toString(36) + Math.random().toString(36).substr(2);
  db.prepare(`
    INSERT INTO tasks (id, title, description, frequency, reminderTime, assignedKidId, parentId, categoryId, difficulty, status, createdAt, customInterval)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, task.title, task.description || null, task.frequency, task.reminderTime || null, task.assignedKidId, task.parentId, task.categoryId || null, task.difficulty || 'easy', 'active', Date.now(), task.customInterval || null);
  res.json({ id });
});

router.get("/kids/:kidId/tasks", (req, res) => {
  const tasks = db.prepare("SELECT * FROM tasks WHERE assignedKidId = ? AND status = 'active' ORDER BY createdAt DESC").all(req.params.kidId);
  res.json(tasks.map((t: any) => ({ ...t, createdAt: { seconds: t.createdAt / 1000 } })));
});

router.get("/parents/:parentId/tasks", (req, res) => {
  const tasks = db.prepare("SELECT * FROM tasks WHERE parentId = ? AND status = 'active' ORDER BY createdAt DESC").all(req.params.parentId);
  res.json(tasks.map((t: any) => ({ ...t, createdAt: { seconds: t.createdAt / 1000 } })));
});

router.put("/tasks/:taskId/archive", (req, res) => {
  db.prepare("UPDATE tasks SET status = 'archived' WHERE id = ?").run(req.params.taskId);
  res.json({ success: true });
});

// Completions
router.post("/completions", (req, res) => {
  const { taskId, kidId, dateString, count } = req.body;
  const id = `${taskId}_${dateString}_${count || 1}`;
  db.prepare(`
    INSERT OR REPLACE INTO completions (id, taskId, kidId, completedAt, dateString, count)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, taskId, kidId, Date.now(), dateString, count || null);
  res.json({ id });
});

router.delete("/completions/:completionId", (req, res) => {
  db.prepare("DELETE FROM completions WHERE id = ?").run(req.params.completionId);
  res.json({ success: true });
});

router.get("/kids/:kidId/completions", (req, res) => {
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

router.get("/kids/:kidId/history", (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const history = db.prepare("SELECT * FROM completions WHERE kidId = ? ORDER BY completedAt DESC LIMIT ?").all(req.params.kidId, limit);
  res.json(history.map((c: any) => ({ ...c, completedAt: { seconds: c.completedAt / 1000 } })));
});

// Categories
router.post("/categories", (req, res) => {
  const cat = req.body;
  const id = "cat_" + Date.now().toString(36);
  db.prepare("INSERT INTO categories (id, name, icon, color, parentId) VALUES (?, ?, ?, ?, ?)").run(id, cat.name, cat.icon, cat.color, cat.parentId);
  res.json({ id });
});

router.put("/categories/:id", (req, res) => {
  const cat = req.body;
  db.prepare("UPDATE categories SET name = ?, icon = ?, color = ?, parentId = ? WHERE id = ?").run(cat.name, cat.icon, cat.color, cat.parentId, req.params.id);
  res.json({ success: true });
});

router.delete("/categories/:id", (req, res) => {
  db.prepare("DELETE FROM categories WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

router.get("/parents/:parentId/categories", (req, res) => {
  const cats = db.prepare("SELECT * FROM categories WHERE parentId = ?").all(req.params.parentId);
  res.json(cats);
});

// Invites
router.post("/invites", (req, res) => {
  const { parentId, parentName } = req.body;
  const id = Math.random().toString(36).substring(2, 8).toUpperCase();
  db.prepare("INSERT INTO invites (id, parentId, parentName, createdAt, status) VALUES (?, ?, ?, ?, ?)").run(id, parentId, parentName, Date.now(), 'active');
  res.json({ id });
});

router.get("/parents/:parentId/invites/active", (req, res) => {
  const invite = db.prepare("SELECT * FROM invites WHERE parentId = ? AND status = 'active'").get(req.params.parentId);
  res.json(invite || null);
});

router.get("/invites/:code/validate", (req, res) => {
  const invite = db.prepare("SELECT * FROM invites WHERE id = ? AND status = 'active'").get(req.params.code);
  res.json(invite || null);
});

// Notifications
router.get("/parents/:parentId/notifications", (req, res) => {
  const notifs = db.prepare("SELECT * FROM notifications WHERE parentId = ? AND status = 'unread' ORDER BY createdAt DESC").all(req.params.parentId);
  res.json(notifs.map((n: any) => ({ ...n, createdAt: { seconds: n.createdAt / 1000 } })));
});

router.put("/notifications/:id/read", (req, res) => {
  db.prepare("UPDATE notifications SET status = 'read' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

export const apiRouter = router;
