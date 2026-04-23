import { format, parse, isAfter, startOfDay, differenceInDays } from "date-fns";
import { db } from "./db.js";

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
}
