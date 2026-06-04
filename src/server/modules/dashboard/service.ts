import { db } from '../../db.js';
import { taskServiceServer } from '../tasks/service.js';
import { eventsService } from '../events/service.js';
import { homeworkService } from '../homework/service.js';

export const dashboardService = {
  getFamilyDashboardData: (parentId: string, dateString: string) => {
    // 1. Tasks for the whole family
    const rawTasks = taskServiceServer.getParentsTasks(parentId);
    const tasks = rawTasks.map((t: any) => {
      let parsedPrereqs = [];
      let completionQuestions: string[] = [];
      try { parsedPrereqs = JSON.parse(t.prerequisiteTaskIds || "[]"); } catch (e) {}
      try { completionQuestions = JSON.parse(t.completionQuestions || "[]"); } catch (e) {}
      return {
        ...t,
        createdAt: { seconds: t.createdAt / 1000 },
        prerequisiteTaskIds: parsedPrereqs,
        completionQuestions
      };
    });

    // 2. Completions for the whole family for the given date
    const rawCompletions = db.prepare(`
      SELECT c.* 
      FROM completions c 
      JOIN tasks t ON c.taskId = t.id 
      WHERE t.parentId = ? AND c.dateString = ?
    `).all(parentId, dateString);
    
    const completions = rawCompletions.map((c: any) => {
      let proofAnswers: Array<{ question: string; answer: string }> = [];
      try { proofAnswers = JSON.parse(c.proofAnswers || '[]'); } catch {}
      return { ...c, proofAnswers, completedAt: { seconds: c.completedAt / 1000 } };
    });

    // 3. Events — window: 14 days back to 90 days forward from requested date
    const dateBase = new Date(`${dateString}T00:00:00`);
    const fromMs = dateBase.getTime() - 14 * 24 * 60 * 60 * 1000;
    const toMs = dateBase.getTime() + 90 * 24 * 60 * 60 * 1000;
    const events = eventsService.getEventsByParentWindowed(parentId, fromMs, toMs);

    // 4. Homework — window: past 7 days to 90 days forward (skip old completed items)
    const hwFromDate = new Date(dateBase.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const hwToDate = new Date(dateBase.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const homework = homeworkService.getByParentWindowed(parentId, hwFromDate, hwToDate);

    return {
      tasks,
      completions,
      events,
      homework
    };
  }
};
