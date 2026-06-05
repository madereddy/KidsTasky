// src/server/modules/tasks/mappers.ts
export function mapTaskRow(t: any) {
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
}

export function mapCompletionRow(c: any) {
  let proofAnswers: Array<{ question: string; answer: string }> = [];
  try { proofAnswers = JSON.parse(c.proofAnswers || '[]'); } catch {}
  return { 
    ...c, 
    proofAnswers, 
    completedAt: { seconds: c.completedAt / 1000 } 
  };
}
