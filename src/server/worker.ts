import { format, parse, isAfter, startOfDay, differenceInDays } from "date-fns";
import { db } from "./db.js";
import cron from "node-cron";
import { google } from "googleapis";
import { app } from "../../server.js";

function getIo() {
  return app ? app.get("io") : null;
}

export function startBackgroundWorker() {
  setInterval(() => {
    console.log("[Worker] Checking for overdue tasks...");
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const now = new Date();
      
      const tasks = db.prepare("SELECT * FROM tasks WHERE status = 'active'").all() as any[];

      for (const task of tasks) {
        if (!task.reminderTime) continue;

        // Frequency Check: Is this task scheduled for today?
        let scheduledForToday = false;
        if (task.frequency === 'daily' || task.frequency === 'twice-daily') {
          scheduledForToday = true;
        } else {
          const createdDate = new Date(task.createdAt);
          const daysSinceCreated = differenceInDays(startOfDay(now), startOfDay(createdDate));
          
          if (task.frequency === 'weekly') scheduledForToday = daysSinceCreated % 7 === 0;
          else if (task.frequency === 'bi-weekly') scheduledForToday = daysSinceCreated % 14 === 0;
          else if (task.frequency === 'custom' && task.customInterval) {
            scheduledForToday = daysSinceCreated % task.customInterval === 0;
          }
        }

        if (!scheduledForToday) continue;

        const reminderDate = parse(task.reminderTime, 'HH:mm', now);
        
        if (isAfter(now, reminderDate)) {
          const completions = db.prepare("SELECT * FROM completions WHERE taskId = ? AND dateString = ?").all(task.id, today);

          const isCompleted = task.frequency === 'twice-daily' 
            ? completions.length >= 2
            : completions.length >= 1;

          if (!isCompleted) {
            // Check if task is locked by prerequisites
            let isLocked = false;
            if (task.prerequisiteTaskIds) {
              try {
                const prereqIds = JSON.parse(task.prerequisiteTaskIds) as string[];
                for (const pid of prereqIds) {
                  const pTask = tasks.find(t => t.id === pid);
                  if (pTask) {
                    const reqCount = pTask.frequency === 'twice-daily' ? 2 : 1;
                    const pComps = db.prepare("SELECT * FROM completions WHERE taskId = ? AND dateString = ?").all(pid, today);
                    if (pComps.length < reqCount) {
                      isLocked = true;
                      break;
                    }
                  }
                }
              } catch (e) {
                // Ignore parse errors silently in worker
              }
            }

            if (isLocked) continue;

            const notifId = `overdue_${task.id}_${today}`;
            const existingNotif = db.prepare("SELECT id FROM notifications WHERE id = ?").get(notifId);

            if (!existingNotif) {
              const kid = db.prepare("SELECT name FROM users WHERE uid = ?").get(task.assignedKidId) as any;
              const kidName = kid ? kid.name : 'Cadet';

              db.prepare(`
                INSERT INTO notifications (id, parentId, kidId, taskId, taskTitle, kidName, type, status, createdAt, dateString)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(notifId, task.parentId, task.assignedKidId, task.id, task.title, kidName, 'overdue', 'unread', Date.now(), today);
              
              console.log(`[Worker] Created overdue notification for ${task.title} (Kid: ${kidName})`);
            }
          }
        }
      }
    } catch (error) {
      console.error("[Worker Error]", error);
    }
  }, 5 * 60 * 1000); 

  // New Cron Job for Calendar Sync
  cron.schedule("*/5 * * * *", async () => {
    console.log("[Worker] Start Google Calendar Sync...");
    try {
      const connections = db.prepare("SELECT * FROM sync_connections WHERE provider = 'google' AND refreshToken IS NOT NULL").all() as any[];
      
      for (const conn of connections) {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID || 'mock',
          process.env.GOOGLE_CLIENT_SECRET || 'mock'
        );
        oauth2Client.setCredentials({ refresh_token: conn.refreshToken });
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        
        try {
          const res = await calendar.events.list({
             calendarId: 'primary',
             timeMin: (new Date()).toISOString(),
             maxResults: 50,
             singleEvents: true,
             orderBy: 'startTime',
          });
          
          let changesMade = false;
          const events = res.data.items || [];
          for (const ev of events) {
             if (!ev.id || !ev.summary || !ev.start?.dateTime || !ev.end?.dateTime) continue;
             
             // Simple UPSERT via INSERT OR IGNORE and UPDATE
             const eId = "ext_" + ev.id;
             const startTs = new Date(ev.start.dateTime).getTime();
             const endTs = new Date(ev.end.dateTime).getTime();
             
             const exists = db.prepare("SELECT id FROM events WHERE externalId = ?").get(eId);
             if (!exists) {
                db.prepare(`
                  INSERT INTO events (id, parentId, title, description, startTime, endTime, assignedToId, color, externalId, source)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(eId, conn.parentId, ev.summary, ev.description || '', startTs, endTs, null, 'blue', eId, 'google');
                changesMade = true;
             } else {
                db.prepare(`
                  UPDATE events SET title = ?, description = ?, startTime = ?, endTime = ?
                  WHERE externalId = ?
                `).run(ev.summary, ev.description || '', startTs, endTs, eId);
                // In a perfect world we check diff, we'll just assume true for now
                changesMade = true; 
             }
          }
          
          if (changesMade) {
             const io = getIo();
             if (io) {
               io.to(conn.parentId).emit('stale-data', { type: 'events' });
             }
          }
        } catch (err: any) {
          console.error("[Worker] Sync failed for connection", conn.id, err.message);
          if (err.message.includes('invalid_grant')) {
             console.log("[Worker] Refresh token expired, deleting connection", conn.id);
             db.prepare("DELETE FROM sync_connections WHERE id = ?").run(conn.id);
          }
        }
      }
    } catch (err) {
      console.error("[Worker] Global Sync Error:", err);
    }
  });
}
