import { format, parse, isAfter, startOfDay, differenceInDays } from "date-fns";
import { db } from "./db.js";
import cron from "node-cron";
import { google } from "googleapis";
import { app } from "../../server.js";
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import ical from 'node-ical';
import { magicService } from './modules/magic/service.js';

function getIo() {
  return app ? app.get("io") : null;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export function startBackgroundWorker() {
  setInterval(() => {
    console.log("[Worker] Checking for overdue tasks...");
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const now = new Date();
      
      const tasks = db.prepare("SELECT * FROM tasks WHERE status = 'active'").all() as any[];

      for (const task of tasks) {
        if (!task.reminderTime) continue;

        let scheduledForToday = false;
        if (task.frequency === 'daily' || task.frequency === 'twice-daily') {
          scheduledForToday = true;
        } else {
          const createdDate = new Date(task.createdAt);
          const daysSinceCreated = differenceInDays(startOfDay(now), startOfDay(createdDate));
          if (task.frequency === 'weekly') scheduledForToday = daysSinceCreated % 7 === 0;
          else if (task.frequency === 'bi-weekly') scheduledForToday = daysSinceCreated % 14 === 0;
          else if (task.frequency === 'custom' && task.customInterval) scheduledForToday = daysSinceCreated % task.customInterval === 0;
        }

        if (!scheduledForToday) continue;

        const reminderDate = parse(task.reminderTime, 'HH:mm', now);
        if (isAfter(now, reminderDate)) {
          const completions = db.prepare("SELECT * FROM completions WHERE taskId = ? AND dateString = ?").all(task.id, today);
          const isCompleted = task.frequency === 'twice-daily' ? completions.length >= 2 : completions.length >= 1;
          if (!isCompleted) {
            let isLocked = false;
            if (task.prerequisiteTaskIds) {
              try {
                const prereqIds = JSON.parse(task.prerequisiteTaskIds);
                for (const pid of prereqIds) {
                  const pTask = tasks.find(t => t.id === pid);
                  if (pTask) {
                    const reqCount = pTask.frequency === 'twice-daily' ? 2 : 1;
                    const pComps = db.prepare("SELECT * FROM completions WHERE taskId = ? AND dateString = ?").all(pid, today);
                    if (pComps.length < reqCount) { isLocked = true; break; }
                  }
                }
              } catch (e) {}
            }
            if (isLocked) continue;

            const notifId = `overdue_${task.id}_${today}`;
            if (!db.prepare("SELECT id FROM notifications WHERE id = ?").get(notifId)) {
              const kid = db.prepare("SELECT name FROM users WHERE uid = ?").get(task.assignedKidId) as any;
              db.prepare(`INSERT INTO notifications (id, parentId, kidId, taskId, taskTitle, kidName, type, status, createdAt, dateString) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(notifId, task.parentId, task.assignedKidId, task.id, task.title, kid ? kid.name : 'Cadet', 'overdue', 'unread', Date.now(), today);
            }
          }
        }
      }
    } catch (error) { console.error("[Worker Error]", error); }
  }, 5 * 60 * 1000); 

  cron.schedule("*/5 * * * *", async () => {
    console.log("[Worker] Start Multi-Source Sync...");
    
    try {
      const connections = db.prepare("SELECT * FROM sync_connections WHERE provider = 'google' AND refreshToken IS NOT NULL").all() as any[];
      for (const conn of connections) {
        const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID || 'mock', process.env.GOOGLE_CLIENT_SECRET || 'mock');
        oauth2Client.setCredentials({ refresh_token: conn.refreshToken });
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        try {
          const res = await calendar.events.list({ calendarId: 'primary', timeMin: (new Date()).toISOString(), maxResults: 50, singleEvents: true, orderBy: 'startTime' });
          let changes = false;
          for (const ev of (res.data.items || [])) {
             if (!ev.id || !ev.summary || !ev.start?.dateTime || !ev.end?.dateTime) continue;
             const eId = "ext_" + ev.id;
             if (!db.prepare("SELECT id FROM events WHERE externalId = ?").get(eId)) {
                 db.prepare(`INSERT INTO events (id, parentId, title, description, startTime, endTime, assignedToId, color, externalId, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(eId, conn.parentId, ev.summary, ev.description || '', new Date(ev.start.dateTime).getTime(), new Date(ev.end.dateTime).getTime(), null, 'blue', eId, 'google');
                 changes = true;
             }
          }
          if (changes) getIo()?.to(conn.parentId).emit('stale-data', { type: 'events' });
        } catch (err: any) { if (err.message.includes('invalid_grant')) db.prepare("DELETE FROM sync_connections WHERE id = ?").run(conn.id); }
      }
    } catch (err) { console.error("[Worker] Global OAuth Sync Error:", err); }

    try {
      const icalConns = db.prepare("SELECT * FROM sync_connections WHERE icalUrl IS NOT NULL").all() as any[];
      for (const conn of icalConns) {
        if (!conn.icalUrl) continue;
        const webEvents = await ical.fromURL(conn.icalUrl);
        let changes = false;
        for (const k in webEvents) {
          const ev: any = webEvents[k];
          if (!ev || ev.type !== 'VEVENT' || !ev.summary || !ev.start || !ev.end) continue;
          const eId = "ical_" + (ev.uid || k);
          if (!db.prepare("SELECT id FROM events WHERE externalId = ?").get(eId)) {
            db.prepare(`INSERT INTO events (id, parentId, title, description, startTime, endTime, assignedToId, color, externalId, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(eId, conn.parentId, ev.summary, ev.description || '', new Date(ev.start).getTime(), new Date(ev.end).getTime(), null, 'purple', eId, 'ical');
            changes = true;
          }
        }
        if (changes) getIo()?.to(conn.parentId).emit('stale-data', { type: 'events' });
      }
    } catch (err) { console.error("[Worker] iCal Sync Error", err); }

    if (GEMINI_API_KEY) {
      try {
        const manualConns = db.prepare("SELECT * FROM sync_connections WHERE provider = 'google_manual' AND appPassword IS NOT NULL AND email IS NOT NULL").all() as any[];
        for (const conn of manualConns) {
          const config = { imap: { user: conn.email, password: conn.appPassword, host: 'imap.gmail.com', port: 993, tls: true, authTimeout: 3000 } };
          const connection = await imaps.connect(config);
          await connection.openBox('INBOX');
          const messages = await connection.search(['UNSEEN'], { bodies: ['HEADER', 'TEXT'], markSeen: true });
          for (const msg of messages) {
            const all = msg.parts.find((p: any) => p.which === 'TEXT');
            if (all) {
              const parsed = await simpleParser(all.body);
              const extracted = await magicService.parseEventsFromText(parsed.text || parsed.html || '', GEMINI_API_KEY);
              if (extracted && extracted.title && extracted.date) {
                const startTs = new Date(`${extracted.date}T${extracted.startTime || '09:00'}:00`).getTime();
                db.prepare(`INSERT INTO events (id, parentId, title, description, startTime, endTime, assignedToId, color, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("magic_" + Date.now() + "_" + msg.attributes.uid, conn.parentId, extracted.title, `From email: ${extracted.location || ''}`, startTs, startTs + 3600000, null, 'amber', 'magic');
                getIo()?.to(conn.parentId).emit('stale-data', { type: 'events' });
              }
            }
          }
          connection.end();
        }
      } catch (err) { console.error("[Worker] IMAP Sync Error", err); }
    }
  });
}
