import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";
import { format, parse, isAfter, startOfToday } from "date-fns";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
// In Cloud Run, it should use Application Default Credentials automatically
try {
  admin.initializeApp();
} catch (e) {
  console.log("Firebase Admin already initialized or failed to init with ADC, trying with env...");
}

const db = admin.firestore();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Background Worker: Check for overdue tasks every 5 minutes
  setInterval(async () => {
    console.log("[Worker] Checking for overdue tasks...");
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const now = new Date();
      
      const tasksSnap = await db.collection('tasks')
        .where('status', '==', 'active')
        .get();

      for (const taskDoc of tasksSnap.docs) {
        const task = taskDoc.data();
        if (!task.reminderTime) continue;

        // Parse reminder time for today
        const reminderDate = parse(task.reminderTime, 'HH:mm', now);
        
        if (isAfter(now, reminderDate)) {
          // Check if completed today
          const completionsSnap = await db.collection('completions')
            .where('taskId', '==', task.id)
            .where('dateString', '==', today)
            .get();

          const isCompleted = task.frequency === 'twice-daily' 
            ? completionsSnap.docs.length >= 2
            : completionsSnap.docs.length >= 1;

          if (!isCompleted) {
            // Check if notification already exists for today
            const notifId = `overdue_${task.id}_${today}`;
            const notifDoc = await db.collection('notifications').doc(notifId).get();

            if (!notifDoc.exists) {
              // Get kid name
              const kidDoc = await db.collection('users').doc(task.assignedKidId).get();
              const kidName = kidDoc.exists ? kidDoc.data()?.name : 'Cadet';

              await db.collection('notifications').doc(notifId).set({
                id: notifId,
                parentId: task.parentId,
                kidId: task.assignedKidId,
                taskId: task.id,
                taskTitle: task.title,
                kidName: kidName,
                type: 'overdue',
                status: 'unread',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                dateString: today
              });
              console.log(`[Worker] Created overdue notification for ${task.title} (Kid: ${kidName})`);
            }
          }
        }
      }
    } catch (error) {
      console.error("[Worker Error]", error);
    }
  }, 5 * 60 * 1000); // 5 minutes

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
